export type AnalysisLanguage = 'zh-TW' | 'en'

export const DEFAULT_ANALYSIS_LANGUAGE: AnalysisLanguage = 'zh-TW'

export const ANALYSIS_LANGUAGE_OPTIONS: { id: AnalysisLanguage; label: string; labelEn: string }[] = [
  { id: 'zh-TW', label: '繁體中文', labelEn: 'Traditional Chinese' },
  { id: 'en', label: 'English', labelEn: 'English' },
]

/**
 * 8 個 AI Agent 的執行順序與節點名稱。
 * 引擎、API 與前端共用同一份金鑰，避免名稱不一致。
 */
export const AGENT_KEYS = [
  'Market Analyst',
  'Sentiment Analyst',
  'News Analyst',
  'Fundamentals Analyst',
  'Bull Researcher',
  'Research Manager',
  'Trader',
  'Portfolio Manager',
] as const

export type AgentKey = (typeof AGENT_KEYS)[number]

export const AGENT_KEY_SET: ReadonlySet<string> = new Set<string>(AGENT_KEYS)

const DEFAULT_TWD_USD_RATE = 32

/**
 * 依照語言產出輸出指令，注入每個 Agent 的 prompt。
 * zh-TW：全程使用繁體中文，貨幣計算一律以新台幣 (NTD) 呈現；
 * en：全程使用英文並以標的本身幣別呈現。
 */
export function buildAnalysisLanguageInstruction(
  language: AnalysisLanguage,
  twdUsdRate?: number,
): string {
  const rate = twdUsdRate && twdUsdRate > 0 ? twdUsdRate : DEFAULT_TWD_USD_RATE

  if (language === 'zh-TW') {
    return [
      'Language & Currency Instructions:',
      '- Write your entire report in Traditional Chinese (繁體中文).',
      '- Present and calculate every monetary amount in New Taiwan Dollars (NTD / TWD, symbol NT$).',
      `- If the source data is quoted in another currency (e.g., US stocks in USD), keep the original currency labeled, and also convert USD figures to NTD using 1 USD ≈ NT$ ${rate}.`,
    ].join('\n')
  }

  return [
    'Language & Currency Instructions:',
    '- Write your entire report in English.',
    "- Present monetary amounts in the listing's native currency (NTD for Taiwan stocks, USD for US stocks) and always label the currency clearly.",
  ].join('\n')
}