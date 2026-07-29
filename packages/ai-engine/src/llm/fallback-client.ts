import type { LLMClient } from './client.js'

export class FallbackClient implements LLMClient {
  constructor(
    private primary: LLMClient,
    private fallback: LLMClient,
  ) {}

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      return await this.primary.generate(systemPrompt, userPrompt)
    } catch (e: any) {
      console.warn(`[Fallback] Primary failed: ${e.message}`)
      return this.fallback.generate(systemPrompt, userPrompt)
    }
  }

  async generateObject<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T> {
    try {
      return await this.primary.generateObject(systemPrompt, userPrompt, schema)
    } catch (e: any) {
      console.warn(`[Fallback] Primary failed: ${e.message}`)
      return this.fallback.generateObject(systemPrompt, userPrompt, schema)
    }
  }
}
