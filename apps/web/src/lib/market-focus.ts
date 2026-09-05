import { LLMFactory } from '@stock/ai-engine'
import { loadConfig } from '@stock/core'
import type { MarketFocusItem } from '@stock/database'
import { saveMarketFocus } from '@stock/database'

// Google News RSS (台灣繁體中文)。用兩組關鍵字墊出候選池,交給 LLM 依價值投資精神過濾。
const NEWS_QUERIES = [
  '台股 大盤',
  '台股 除息 股利 OR 價值投資 OR 基本面 財報',
]

const USER_AGENT = 'Mozilla/5.0 (Vestential MarketFocus/1.0)'
const MAX_CANDIDATES = 30
const RECENT_DAYS = 2

export interface NewsCandidate {
  title: string
  url: string
  source: string
  publishedAt: string
}

/** 轉成可排序的 ISO 字串;無法解析時回傳空字串。 */
function toIsoDate(publishedAt: string): string {
  const dt = new Date(publishedAt)
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString()
}

function decodeEntity(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

function extractTag(re: RegExp, block: string): string {
  const m = block.match(re)
  return m ? m[1] : ''
}

/** 用最小且穩定的 RegExp 解析 RSS <item> 區塊(Google News RSS 結構固定,不需 XML 依賴)。 */
function parseRssItems(xml: string): NewsCandidate[] {
  const items: NewsCandidate[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && items.length < MAX_CANDIDATES) {
    const block = m[1]
    const title = decodeEntity(extractTag(/<title>([\s\S]*?)<\/title>/, block))
    const link = decodeEntity(extractTag(/<link[^>]*>([\s\S]*?)<\/link>/, block))
    if (!title || !link) continue
    items.push({
      title,
      url: link,
      source: decodeEntity(extractTag(/<source[^>]*>([\s\S]*?)<\/source>/, block)) || 'Google News',
      publishedAt: decodeEntity(extractTag(/<pubDate>([\s\S]*?)<\/pubDate>/, block)),
    })
  }
  return items
}

async function fetchGoogleNews(query: string): Promise<NewsCandidate[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Google News RSS failed (${res.status})`)
  const xml = await res.text()
  return parseRssItems(xml)
}

const SYSTEM_PROMPT = `你是 Vestential(台灣股票投資資訊平台)的總編輯。Vestential 的精神是「價值投資」:重視基本面、長期累積、投資紀律、以及用簡單指標(如季線乖離)判斷市場位置。你負責為首頁「市場焦點」挑選新聞。

規則:
1. 從候選清單中挑選「最符合價值投資精神」的最多 6 則。
2. 偏好:基本面/財報/股利與除息/總體經濟/市場週期(指數、季線乖離)/長期資產配置相關新聞。
3. 排除:短線明牌、個股炒作、小道消息、未證實的利多利空、娛樂/八卦,或與台灣投資無關的新聞。
4. 每則給一句 30 字以內的繁體中文理由,說明它為何值得看。
5. 只輸出 JSON,不要任何其他文字:
{"selected":[{"index":0,"reason":"..."}]}`

function buildUserPrompt(candidates: NewsCandidate[]): string {
  const list = candidates
    .map((c, i) => `${i}. [${c.source}] ${c.title}`)
    .join('\n')
  return `以下是候選新聞(共 ${candidates.length} 則):\n${list}\n\n請選出最多 6 則。`
}

interface SelectEntry {
  index: number
  reason: string
}

/** 依「價值投資」精神用 LLM 過濾候選新聞;失敗時回傳原始前 6 則(理由為空)當兜底。 */
export async function filterNewsByAI(candidates: NewsCandidate[]): Promise<MarketFocusItem[]> {
  if (candidates.length === 0) return []
  try {
    const config = loadConfig()
    const llm = LLMFactory.create({
      provider: config.llmProvider,
      model: config.quickThinkModel,
      temperature: config.temperature,
      baseUrl: config.llmProvider !== 'google' ? config.backendUrl : undefined,
      maxTokens: 2048,
    })
    const raw = await llm.generate(SYSTEM_PROMPT, buildUserPrompt(candidates))
    const parsed = JSON.parse(raw.replace(/```json[\s\S]*?```/g, (m) => m.slice(7, -3)).trim()) as {
      selected: SelectEntry[]
    }
    const selected = Array.isArray(parsed?.selected) ? parsed.selected : []
    const items: MarketFocusItem[] = []
    for (const s of selected) {
      const c = candidates[s.index]
      if (!c) continue
      items.push({
        title: c.title,
        url: c.url,
        source: c.source,
        published_at: c.publishedAt,
        reason: typeof s.reason === 'string' ? s.reason.trim() : null,
      })
      if (items.length >= 6) break
    }
    if (items.length > 0) return items
  } catch (e) {
    console.error('[MarketFocus] LLM filter failed, falling back to raw headlines:', e)
  }
  return candidates.slice(0, 6).map((c) => ({
    title: c.title,
    url: c.url,
    source: c.source,
    published_at: c.publishedAt,
    reason: null,
  }))
}

/** 抓取候選新聞 → 保留近 2 天且依發布時間新到舊排序 → AI 過濾 → 寫入 DB。回傳儲存後的清單。 */
export async function refreshMarketFocus(): Promise<MarketFocusItem[]> {
  const seen = new Set<string>()
  const candidates: NewsCandidate[] = []
  for (const q of NEWS_QUERIES) {
    const batch = await fetchGoogleNews(q)
    for (const c of batch) {
      if (seen.has(c.url)) continue
      seen.add(c.url)
      candidates.push(c)
    }
  }

  const now = Date.now()
  const cutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000
  const recent = candidates
    .map((c) => ({ c, t: Date.parse(c.publishedAt) }))
    .filter((x) => !Number.isNaN(x.t) && x.t >= cutoff)
    .sort((a, b) => b.t - a.t)
    .map((x) => x.c)

  const items = (await filterNewsByAI(recent))
    .map((it) => ({ ...it, published_at: it.published_at ? toIsoDate(it.published_at) : '' }))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, 6)

  await saveMarketFocus(items)
  return items
}