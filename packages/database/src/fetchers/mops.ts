const API_BASE = 'https://mops.twse.com.tw/mops/api'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export interface MopsMeeting {
  date: string
  serial: string
  title: string
  detailUrl: string
}

export type ClaimRule = 'ONE_SHARE' | 'FULL_LOT' | 'NO_GIFT' | 'MEETING_ONLY' | 'UNKNOWN'

export interface ClaimResult {
  rule: ClaimRule
  evidence: string
}

export function fetchMopsMeetings(stockId: string): Promise<MopsMeeting[]> {
  return fetch(`${API_BASE}/t108sb16_q1`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': UA,
      'referer': 'https://mops.twse.com.tw/mops/',
    },
    body: JSON.stringify({
      companyId: stockId,
      dataType: '1',
      year: '',
      month: 'all',
      firstDay: '',
      lastDay: '',
    }),
  })
    .then(async res => {
      if (!res.ok) throw new Error(`MOPS t108sb16_q1 HTTP ${res.status}`)
      return res.json()
    })
    .then((j: any) => {
      const out: MopsMeeting[] = []
      const r: any = j?.result ?? {}
      for (const key of ['regularMeeting', 'extraordinaryMeeting', 'beneficiaryMeeting', 'TDRshareholdersMeeting']) {
        const rows = r[key]?.data ?? []
        for (const row of rows) {
          if (Array.isArray(row) && row.length >= 5) {
            out.push({
              date: String(row[0] ?? ''),
              serial: String(row[1] ?? ''),
              title: String(row[2] ?? '').replace(/&#\d+;/g, ''),
              detailUrl: String(row[4] ?? ''),
            })
          }
        }
      }
      return out
    })
}

function htmlToText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t\r\n]+/g, ' ')
  const start = cleaned.indexOf('一、公告序號')
  const end = cleaned.indexOf('特此公告')
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 5)
  }
  return cleaned
}

export function fetchMopsAnnouncementText(detailUrl: string): Promise<string> {
  return fetch(detailUrl, {
    headers: {
      'user-agent': UA,
      'referer': 'https://mops.twse.com.tw/mops/',
    },
  }).then(async res => {
    if (!res.ok) throw new Error(`MOPS announcement HTTP ${res.status}`)
    return htmlToText(await res.text())
  })
}

// 從公告全文抽取與紀念品相關的句子（作為 evidence）
export function extractGiftEvidence(text: string): string {
  const sentences: string[] = []
  const re = /[^。；\n]{0,50}紀念品[^。；\n]{0,80}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    sentences.push(m[0].trim().replace(/\s+/g, ' '))
    if (sentences.length >= 4) break
  }
  return sentences.join('；').slice(0, 500)
}

const FULL_LOT_PATTERNS = [
  /持股\s*(未滿|不足|未達)\s*(一千|1,?000|仟)\s*股[^。；]{0,40}(不予|不|恕不)(發放|發給|提供|發予)紀念品/,
  /(不予|不|恕不)(發放|提供).{0,10}紀念品.{0,30}(未滿|不足|未達)\s*(一千|1,?000|仟)\s*股/,
]

// 未滿千股者，除「親自出席」或「電子投票/電子方式行使表決權」者得領取外，不予發放 → 需出席/電投
const MEETING_ONLY_PATTERNS = [
  /持股\s*(未滿|不足|未達)\s*(一千|1,?000|仟)\s*股[^。；]{0,40}(親自出席|出席股東會|電子方式行使表決權|電子投票|電投|親自到場)[^。；]{0,25}(得領取|領取|可領取)/,
  /除[^。；]{0,30}(親自出席|出席股東會|電子方式行使表決權|電子投票)[^。；]{0,30}(得領取|得領取紀念品|領取)/,
  /(親自出席|出席股東會|電子方式行使表決權|電子投票).{0,25}得領取/,
]

const ONE_SHARE_PATTERNS = [
  /(持股\s*(一|1)\s*股|一股以上|持有\s*(一|1)\s*股)[^。；]*?(可|能|均|亦|仍|皆|不限)/,
  /(含|包括|不限)\s*(零股|一股|1股)[^。；]*?(可|能|均|亦|仍|皆|發放)/,
  /(未滿|不足)\s*(一千|1,?000|仟)\s*股[^。；]*?(仍|亦|均|可|照常|一樣)(發放|領取|提供)/,
]

export function classifyClaimRule(text: string): ClaimResult {
  const evidence = extractGiftEvidence(text)
  if (evidence) {
    // 整體未發放紀念品（主詞為「本次/股東常會/股東會」）
    if (/本次(股東)?(常會|臨時會|股東會)?(未|不)發放紀念品/.test(text)) {
      return { rule: 'NO_GIFT', evidence }
    }
    // 需出席/電投才能領（未滿千股但有出席/電投例外）
    if (MEETING_ONLY_PATTERNS.some(p => p.test(text))) {
      return { rule: 'MEETING_ONLY', evidence }
    }
    // 未滿千股一律不予發放（無例外）
    if (FULL_LOT_PATTERNS.some(p => p.test(text))) {
      return { rule: 'FULL_LOT', evidence }
    }
    if (/發放紀念品|發放股東會紀念品|發放股東紀念品|紀念品發放原則/.test(text)) {
      if (ONE_SHARE_PATTERNS.some(p => p.test(text))) {
        return { rule: 'ONE_SHARE', evidence }
      }
      // 有發放紀念品但無任何排除條款 → 一般零股亦在發放範圍
      return { rule: 'ONE_SHARE', evidence }
    }
    return { rule: 'UNKNOWN', evidence }
  }
  return { rule: 'UNKNOWN', evidence: '' }
}

// ROC 年月日 "115/06/04" → "06/04"
export function rocToMonthDay(rocDate: string): string {
  const m = /^(\d{3})\/(\d{1,2})\/(\d{1,2})$/.exec(rocDate || '')
  if (!m) return rocDate
  return `${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`
}
