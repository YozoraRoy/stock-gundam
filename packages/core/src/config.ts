export interface AppConfig {
  llmProvider: string
  deepThinkModel: string
  quickThinkModel: string
  backendUrl?: string
  temperature?: number
  maxDebateRounds: number
  maxRiskRounds: number
  outputLanguage: string
  /** 台幣兌美元匯率（zh-TW 模式下換算美股金額用） */
  twdUsdRate?: number
  memoryLogPath?: string
  dataCacheDir?: string
  resultsDir?: string
}

export const DEFAULT_CONFIG: AppConfig = {
  llmProvider: process.env.LLM_PROVIDER ?? 'openai',
  deepThinkModel: process.env.DEEP_THINK_MODEL ?? 'big-pickle',
  quickThinkModel: process.env.QUICK_THINK_MODEL ?? 'big-pickle',
  temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
  maxDebateRounds: 2,
  maxRiskRounds: 2,
  outputLanguage: 'zh-TW',
  twdUsdRate: Number(process.env.TWD_USD_RATE) || 32,
  backendUrl: process.env.LLM_BACKEND_URL ?? 'https://opencode.ai/zen/v1',
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}
