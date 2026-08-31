import { z } from 'zod'
import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import { loadConfig } from '@stock/core'
import { createQuickLLM } from './llm/quick.js'
import { FallbackClient } from './llm/fallback-client.js'

export interface RecognizedPosition {
  market: 'tw' | 'us'
  symbol: string
  symbolName?: string
  shares: number
  cost: number
  currentPrice: number
  dividend: number
}

export interface RecognizePortfolioImageResult {
  positions: RecognizedPosition[]
  modelPlan: { primary: string; fallback: string | null }
  usedFallback: boolean
  /** 本次辨識方式：vision = LLM 直接看圖；ocr = LLM 看 OCR 文字 */
  method: 'vision' | 'ocr'
}

const RecognizedPositionSchema = z.object({
  market: z.enum(['tw', 'us']),
  symbol: z.string().min(1),
  symbolName: z.string().optional(),
  shares: z.number().positive(),
  cost: z.number().nonnegative(),
  currentPrice: z.number().positive(),
  dividend: z.number().nonnegative().optional().default(0),
})

/**
 * 以 AI 辨識圖片中的股票持有部位（支援券商 App 截圖與對帳單/庫存表照片）。
 * 圖片以 data URI（base64）傳入，回傳多檔辨識結果。
 */

const IMAGE_MAX_W = Number(process.env.RECOGNIZE_IMAGE_MAX_W) || 1280
const IMAGE_MAX_H = Number(process.env.RECOGNIZE_IMAGE_MAX_H) || 1600
const IMAGE_JPEG_QUALITY = Number(process.env.RECOGNIZE_IMAGE_QUALITY) || 82
const OCR_LANG = process.env.RECOGNIZE_OCR_LANG || 'eng+chi_sim'
// OCR 文字送給 LLM 的上限（字元數）。Groq 等 fallback 的 TPM 上限極低（如 8000/min），
// 若不截斷，光文字就可能觸發 Request too large / TPM 限制（API 413）。
const OCR_MAX_CHARS = Number(process.env.RECOGNIZE_OCR_MAX_CHARS) || 2400
// 每次上傳最多嘗試的辨識次數；失敗時會把前一次的輸出與驗證錯誤回饋給 LLM 修正重試。
const RECOGNIZE_MAX_ATTEMPTS = (() => {
  const n = Number(process.env.RECOGNIZE_MAX_ATTEMPTS)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : 3
})()
// 輸出 token 上限：辨識只輸出小 JSON，壓低可避免 Groq 等低 TPM（8000/min）fallback
// 因為 max_tokens 預算過大而直接 413 Request too large。
const RECOGNIZE_MAX_TOKENS = (() => {
  const n = Number(process.env.RECOGNIZE_MAX_TOKENS)
  return Number.isFinite(n) && n >= 256 ? Math.round(n) : 1500
})()

/**
 * 壓縮上傳圖片：縮到合理解析度並轉 JPEG，盡量減少 vision LLM 的
 * token 用量（避免 TPM 超過模型上限，例如 Groq qwen 限 8000/min）。
 * 回傳新的 data URL（data:image/jpeg;base64,...）。
 */
async function compressImage(imageDataUrl: string): Promise<string> {
  const m = imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i)
  const b64 = m ? m[2] : imageDataUrl
  const buf = Buffer.from(b64, 'base64')

  const out = await sharp(buf)
    .resize({ width: IMAGE_MAX_W, height: IMAGE_MAX_H, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  return `data:image/jpeg;base64,${out.toString('base64')}`
}

let ocrWorkerPromise: Promise<Tesseract.Worker> | null = null

async function getOcrWorker(): Promise<Tesseract.Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker(OCR_LANG, 1, {
      cacheMethod: 'none',
      gzip: true,
      logger: (m) => {
        if (m.status === 'recognizing text' && (m.progress === 0.5 || m.progress === 1))
          console.log(`[OCR] ${m.workerId} ${Math.round(m.progress * 100)}%`)
      },
    }).catch((e) => {
      ocrWorkerPromise = null
      throw e
    })
  }
  return ocrWorkerPromise
}

/**
 * 本機 OCR 擷取圖片文字（vision LLM 失敗時的 fallback）。
 * 使用接收到的原圖（前後端都已限制在長邊 ≤1600px），保留小字解析度。
 */
async function ocrImage(imageDataUrl: string): Promise<string> {
  const m = imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i)
  const b64 = m ? m[2] : imageDataUrl
  const buf = Buffer.from(b64, 'base64')

  const worker = await getOcrWorker()
  const { data } = await worker.recognize(buf)
  return (data.text || '').trim()
}

const ZOD_TYPE_LABELS: Record<string, string> = {
  string: '字串',
  number: '數字',
  boolean: '布林',
  null: 'null',
  array: '陣列',
  object: '物件',
}

/** 把 zod 驗證錯誤轉成易懂的欄位問題描述（同時作為 retry 時 prompt 的修正依據）。 */
function summarizeIssues(error: z.ZodError): string[] {
  return error.issues.map((iss): string => {
    const where = iss.path.length ? `positions[].${iss.path.join('.')}` : 'positions[]'
    switch (iss.code) {
      case 'invalid_type': {
        const expected = ZOD_TYPE_LABELS[iss.expected] ?? iss.expected
        const received = iss.received === 'undefined' ? '欄位缺少' : `得到 ${ZOD_TYPE_LABELS[iss.received] ?? JSON.stringify(iss.received)}`
        return `${where}: 型態錯誤，應為 ${expected}（${received}）`
      }
      case 'invalid_enum_value': {
        const opts = (Array.isArray(iss.options) ? iss.options : []).map((o) => JSON.stringify(o)).join(' 或 ')
        return `${where}: 只能填 ${opts}，得到 ${JSON.stringify(iss.received)}`
      }
      case 'too_small': {
        if (iss.type === 'string') return `${where}: 內容不可為空`
        return `${where}: 數值超出下限（${iss.inclusive ? `需 ≥ ${iss.minimum}` : `需 > ${iss.minimum}`}）`
      }
      default:
        return `${where}: ${iss.message}`
    }
  })
}

/** 壓縮 OCR 文字：去掉空白行與連續空格，再截斷到 OCR_MAX_CHARS。
 *  Groq 等 fallback 的 TPM 極低，文字過多會直接 413 Request too large。 */
function normalizeOcrText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
  const joined = lines.join('\n')
  if (joined.length <= OCR_MAX_CHARS) return joined
  return `${joined.slice(0, OCR_MAX_CHARS)}\n[OCR 文字過長已截斷，只取前 ${OCR_MAX_CHARS} 字元；缺漏的欄位寧可省略也不要亂填]`
}

/** 截斷送入 prompt 的長內容（如修正重試時附上的上一輪輸出），避免 prompt 暴漲。 */
function truncateForPrompt(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…（內容過長已截斷）` : text
}

/** 以 AI 辨識圖片中的股票持有部位（支援券商 App 截圖與對帳單/庫存表照片）。 */
export async function recognizePortfolioImage(imageDataUrl: string): Promise<RecognizePortfolioImageResult> {
  const config = loadConfig()
  const { llm, primary, fallbackModel } = createQuickLLM(config, { maxTokens: RECOGNIZE_MAX_TOKENS })

  const systemPrompt = [
    '你是股票持有部位辨識專家，擅長從券商 App 截圖、對帳單或庫存表照片中準確讀出每檔股票的持有資料。',
    '請只依圖片內容回答，看不清楚就不要亂猜，寧可省略也不杜撰。',
    '輸出必須是單一 JSON 物件：{ "positions": [ { "market": "tw"|"us", "symbol": "代號", "symbolName": "名稱", "shares": 股數(數字), "cost": 每股成本(數字), "currentPrice": 每股現價(數字), "dividend": 累計股息(數字, 無則 0) } ] }。',
    'market 判斷：股號為 4~6 位數字視為 tw，英文代號（如 AAPL）視為 us。',
  ].join('\n')

  const schema = z.object({ positions: z.array(RecognizedPositionSchema) })

  const canVision = !!primary.generateWithImage
  // 壓縮圖片與 OCR 文字都只做一次，之後各次修正重試直接沿用。
  const compressedImage = canVision ? await compressImage(imageDataUrl) : null
  let ocrText: string | null = null
  async function getOcrText(): Promise<string> {
    if (ocrText === null) {
      const text = await ocrImage(imageDataUrl)
      if (!text) throw new Error('OCR 無法讀取圖片文字，請換一張更清楚的圖片')
      ocrText = normalizeOcrText(text)
    }
    return ocrText
  }

  let method: 'vision' | 'ocr' = canVision ? 'vision' : 'ocr'

  const baseUserPrompt = (): string => {
    if (method === 'ocr') {
      return [
        '請依下方 OCR 從圖片擷取的文字辨識每一檔股票，依照規定的 JSON 格式輸出，不要有任何額外文字或 markdown。',
        'OCR 可能誤讀數字或破壞表格對齊，請依欄位語意（股號/名稱/股數/成本/現價/股息）合理判斷，不確定的欄位省略也不可亂填。',
        '===== OCR 文字 =====',
        ocrText ?? '',
      ].join('\n')
    }
    return '請辨識圖片中的每一檔股票，依照規定的 JSON 格式輸出，不要有任何額外文字或 markdown。'
  }

  // 依「上一次的回應內容 + 具體驗證錯誤」修正 prompt，引導 LLM 重新輸出合法 JSON。
  const buildUserPrompt = (attemptIndex: number, previousRaw: string | null, issues: readonly string[] | null): string => {
    const base = baseUserPrompt()
    if (attemptIndex === 0 || !previousRaw || !issues?.length) return base
    return [
      base,
      '',
      '===== 上次的輸出與修正指示 =====',
      `上一輪你輸出的 JSON（未通過驗證）：\n${truncateForPrompt(previousRaw, 600)}`,
      '',
      '驗證失敗原因：',
      ...issues.map((s) => `- ${s}`),
      '',
      '請依上述原因修正後，重新輸出「完整」的合法 JSON。注意：',
      '- market 只能是 "tw" 或 "us"。',
      '- shares / cost / currentPrice 必須是純數字，不要夾帶逗號、$ 或「股/元/張」等文字（例如 1000 而非 "1,000"）。',
      '- shares 必須 ≥1，currentPrice 必須 >0；不確定的欄位（如 dividend）省略即可。',
      '- 只輸出 JSON，不要 markdown 或任何備註。',
    ].join('\n')
  }

  let lastRaw: string | null = null
  let lastIssues: string[] | null = null

  for (let attempt = 0; attempt < RECOGNIZE_MAX_ATTEMPTS; attempt++) {
    let raw: string
    try {
      if (method === 'vision') {
        try {
          // 只把圖片送給 primary（本家）模型；Groq 等 fallback 的 TPM 上限太低，
          // 不適合吃整張圖。fallback 一律走「OCR 文字」路徑，永不送圖。
          raw = await primary.generateWithImage!(systemPrompt, buildUserPrompt(attempt, lastRaw, lastIssues), compressedImage!)
        } catch (e: any) {
          console.warn(`[RecognizeImage] vision LLM 失敗（${e.message}），改走 OCR fallback`)
          method = 'ocr'
          await getOcrText()
          raw = await llm.generate(systemPrompt, buildUserPrompt(attempt, lastRaw, lastIssues))
        }
      } else {
        await getOcrText()
        raw = await llm.generate(systemPrompt, buildUserPrompt(attempt, lastRaw, lastIssues))
      }
    } catch (e: any) {
      const msg = e?.message || ''
      if (/Request too large|tokens per minute|TPM|rate_limit_exceeded/i.test(msg)) {
        throw new Error('圖片辨識的文字量超出辨識模型的單分鐘 Token 限制（TPM）。請換成更精簡的截圖（如單一庫存頁面）後再試')
      }
      throw e
    }

    lastRaw = raw

    try {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const obj = JSON.parse(cleaned)
      const parsed = Array.isArray(obj) ? { positions: obj } : obj
      const result = schema.safeParse(parsed)
      if (result.success) {
        const usedFallback = llm instanceof FallbackClient ? llm.fallbackCalls > 0 : false
        return {
          positions: result.data.positions,
          modelPlan: {
            primary: config.quickThinkModel,
            fallback: fallbackModel,
          },
          usedFallback,
          method,
        }
      }
      lastIssues = summarizeIssues(result.error)
      console.warn(`[RecognizeImage] 第 ${attempt + 1} 次嘗試未通過驗證：${lastIssues.join('；')}`)
    } catch {
      lastIssues = ['輸出不為合法的 JSON 格式（可能被 markdown 或其他文字包圍）']
      console.warn(`[RecognizeImage] 第 ${attempt + 1} 次嘗試解析 JSON 失敗`)
    }
  }

  console.error('[RecognizeImage] 所有嘗試皆失敗。最後輸出:', lastRaw, '問題:', lastIssues)
  const detail = lastIssues?.length ? `（${lastIssues.slice(0, 3).join('；')}）` : ''
  throw new Error(`AI 辨識結果欄位不完整${detail}，請確認圖片清楚後重試`)
}