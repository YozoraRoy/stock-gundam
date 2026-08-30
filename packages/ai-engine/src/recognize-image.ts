import { z } from 'zod'
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
export async function recognizePortfolioImage(imageDataUrl: string): Promise<RecognizePortfolioImageResult> {
  const config = loadConfig()
  const { llm, fallbackModel } = createQuickLLM(config)

  if (!llm.generateWithImage) {
    throw new Error('目前 LLM 不支援圖片輸入，無法辨識')
  }

  const systemPrompt = [
    '你是股票持有部位辨識專家，擅長從券商 App 截圖、對帳單或庫存表照片中準確讀出每檔股票的持有資料。',
    '請只依圖片內容回答，看不清楚就不要亂猜，寧可省略也不杜撰。',
    '輸出必須是單一 JSON 物件：{ "positions": [ { "market": "tw"|"us", "symbol": "代號", "symbolName": "名稱", "shares": 股數(數字), "cost": 每股成本(數字), "currentPrice": 每股現價(數字), "dividend": 累計股息(數字, 無則 0) } ] }。',
    'market 判斷：股號為 4~6 位數字視為 tw，英文代號（如 AAPL）視為 us。',
  ].join('\n')

  const userPrompt = [
    '請辨識圖片中的每一檔股票，依照規定的 JSON 格式輸出，不要有任何額外文字或 markdown。',
  ].join('\n')

  const raw = await llm.generateWithImage(systemPrompt, userPrompt, imageDataUrl)

  let parsed: unknown
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const obj = JSON.parse(cleaned)
    parsed = Array.isArray(obj) ? { positions: obj } : obj
  } catch (e) {
    console.error('[RecognizeImage] failed to parse LLM output:', raw)
    throw new Error('AI 辨識結果無法解析，請再試一次或改用截圖上傳')
  }

  const schema = z.object({ positions: z.array(RecognizedPositionSchema) })
  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error('[RecognizeImage] validation failed:', result.error.message, raw)
    throw new Error('AI 辨識結果欄位不完整，請確認圖片清楚後重試')
  }

  const usedFallback = llm instanceof FallbackClient ? llm.fallbackCalls > 0 : false

  return {
    positions: result.data.positions,
    modelPlan: {
      primary: config.quickThinkModel,
      fallback: fallbackModel,
    },
    usedFallback,
  }
}