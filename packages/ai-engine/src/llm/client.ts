export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
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
}
