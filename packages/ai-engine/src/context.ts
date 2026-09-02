/**
 * 限制提供給 LLM 的 prompt 大小，避免單一請求超過模型的 input 限制。
 * 背景：免費 fallback（如 Groq qwen/qwen3.8-27b）單一請求 token 上限僅約 8000，
 * 後期 Agent（Bull Researcher / 各 Manager）會把前段所有報告整併進 prompt，
 * 積累後容易觸發上游回 413 Request too large / 429（TPM 超過）。
 * 因此對每個「被整併帶入」的報告/context 欄位做有界截斷。
 */

/** 單一 report / context 欄位帶入後續 Agent 的最大字元數。 */
export const CONTEXT_FIELD_LIMIT = Number(process.env.CONTEXT_FIELD_LIMIT) || 1400

/**
 * 截斷字串到指定長度，並附註已省略的內容量，讓 LLM 知道資訊不完整。
 */
export function truncateField(value: string | undefined, fieldPrefix: string, limit = CONTEXT_FIELD_LIMIT): string {
  const text = value?.trim() ?? ''
  if (!text) return fieldPrefix
  if (text.length <= limit) return `${fieldPrefix}\n${text}`
  const head = text.slice(0, limit)
  return `${fieldPrefix}\n${head}\n…（已截斷 ${text.length - limit} 字元）`
}

/** 用於 Bull/Bear Researcher：整併前段分析報告並套用各自預算。 */
export function buildSynthesizedReports(reports: {
  instrumentContext?: string
  marketReport?: string
  sentimentReport?: string
  newsReport?: string
  fundamentalsReport?: string
}): string {
  const parts: string[] = []
  parts.push(truncateField(reports.instrumentContext, 'Resources:'))
  parts.push(truncateField(reports.marketReport, 'Market Report:'))
  parts.push(truncateField(reports.sentimentReport, 'Sentiment:'))
  parts.push(truncateField(reports.newsReport, 'News:'))
  parts.push(truncateField(reports.fundamentalsReport, 'Fundamentals:'))
  return parts.join('\n\n')
}