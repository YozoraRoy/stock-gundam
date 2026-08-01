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

export interface LLMClient {
  generate(systemPrompt: string, userPrompt: string): Promise<string>
  generateObject<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T>
  /** Optional hook invoked after each successful LLM call with token usage. */
  onUsage?: (usage: LLMUsage) => void
}
