export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  /** 覆寫全域 LLM_MAX_TOKENS 的輸出 token 上限（例如辨識只輸出小 JSON 時壓低以避開 TPM）。 */
  maxTokens?: number
}

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
}

export interface LLMCallInfo {
  /** The model that actually served this call (primary or fallback). */
  model: string
  /** Whether this call fell back to the secondary model due to an error. */
  usedFallback: boolean
}

export interface LLMClient {
  generate(systemPrompt: string, userPrompt: string): Promise<string>
  generateObject<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T>
  /** Generate a reply given an image (data URI, e.g. screenshot) plus optional text prompt. */
  generateWithImage?(systemPrompt: string, userPrompt: string, imageDataUrl: string): Promise<string>
  /** Model that served the most recent successful call (primary unless fallback engaged). */
  readonly model: string
  /** Optional hook invoked after each successful LLM call with token usage. */
  onUsage?: (usage: LLMUsage) => void
  /** Optional hook invoked after each successful LLM call with model attribution. */
  onCall?: (info: LLMCallInfo) => void
  /** Optional hook invoked when the client is about to wait before retrying (e.g. 429 rate-limit). */
  onRetry?: (retryAfterMs: number) => void
}
