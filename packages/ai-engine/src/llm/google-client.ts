import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, generateObject } from 'ai'
import type { LLMClient, LLMConfig, LLMUsage } from './client.js'
import { AIError } from '@stock/core'

function parseRetryDelay(msg: string): number | null {
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i)
  return m ? Math.ceil(parseFloat(m[1])) : null
}

const RETRYABLE = [
  'quota exceeded', 'exceeded your current quota', 'current quota',
  'high demand', 'rate limit', 'too many requests',
  'resource exhausted', '429', '503', '500',
]

function isRetryable(err: any): boolean {
  const msg = err?.message?.toLowerCase() ?? ''
  return RETRYABLE.some(k => msg.includes(k))
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e: any) {
      if (i === maxRetries - 1) {
        throw new AIError(`Google LLM failed after ${maxRetries} retries: ${e.message}`)
      }
      if (!isRetryable(e)) throw e

      const msg = e.message ?? ''
      const suggested = parseRetryDelay(msg)
      const delay = (suggested ?? Math.min(3 * 2 ** i + Math.random() * 2, 30)) * 1000

      console.log(`[Google] retry ${i + 1}/${maxRetries} after ${Math.round(delay / 1000)}s: ${msg.slice(0, 80)}`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

export class GoogleClient implements LLMClient {
  onUsage?: (usage: LLMUsage) => void
  private provider: ReturnType<typeof createGoogleGenerativeAI>
  private lastCallTime = 0
  private readonly minInterval = 6000

  constructor(private config: LLMConfig) {
    this.provider = createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
  }

  private async waitForQuota() {
    const now = Date.now()
    const elapsed = now - this.lastCallTime
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed))
    }
    this.lastCallTime = Date.now()
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    return withRetry(async () => {
      await this.waitForQuota()
      const { text, usage } = await generateText({
        model: this.provider(this.config.model),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: this.config.temperature,
        maxRetries: 0,
      })
      this.reportUsage(usage)
      return text
    })
  }

  async generateObject<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T> {
    return withRetry(async () => {
      await this.waitForQuota()
      const { object, usage } = await generateObject({
        model: this.provider(this.config.model),
        system: systemPrompt,
        prompt: userPrompt,
        schema,
        temperature: this.config.temperature,
        maxRetries: 0,
      })
      this.reportUsage(usage)
      return object as T
    })
  }

  private reportUsage(usage: { promptTokens?: number; completionTokens?: number } | undefined) {
    this.onUsage?.({
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
    })
  }
}
