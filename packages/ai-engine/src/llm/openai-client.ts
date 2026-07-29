import type { LLMClient, LLMConfig } from './client.js'
import { AIError } from '@stock/core'

export class OpenAICompatibleClient implements LLMClient {
  constructor(private config: LLMConfig) {}

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    return this.callAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  async generateObject<T>(_systemPrompt: string, _userPrompt: string, schema: any): Promise<T> {
    const prompt = `${_systemPrompt}\n\n${_userPrompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
    const raw = await this.callAPI([
      { role: 'system', content: 'You output valid JSON matching the requested schema. Never include markdown or extra text.' },
      { role: 'user', content: prompt },
    ])

    let cleaned = ''
    try {
      cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return schema.parse(parsed) as T
    } catch (e: any) {
      console.error('[OpenAIClient] failed to parse or validate JSON object.')
      console.error('[OpenAIClient] raw response:', raw)
      console.error('[OpenAIClient] cleaned response:', cleaned)
      throw new AIError(`LLM structured generation failed: ${e.message}. Raw output: ${raw}`)
    }
  }

  private async callAPI(messages: { role: string; content: string }[]): Promise<string> {
    const maxRetries = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      try {
        const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            temperature: this.config.temperature,
            max_tokens: 4096,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          const errText = await res.text()
          if (res.status === 429 || res.status >= 500) {
            throw new AIError(`API ${res.status}: ${errText}`)
          }
          throw new AIError(`API ${res.status}: ${errText}`)
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (!content) {
          throw new AIError('No content in model response')
        }
        return content

      } catch (e: any) {
        clearTimeout(timeoutId)
        lastError = e

        const isTimeout = e.name === 'AbortError'
        const isRetryable = isTimeout || e.message?.includes('fetch failed') || e.message?.includes('network error') || e instanceof AIError

        console.warn(`[OpenAIClient] Attempt ${attempt}/${maxRetries} failed: ${e.message || e}`)

        if (attempt < maxRetries && isRetryable) {
          await new Promise(r => setTimeout(r, 1500 * attempt))
          continue
        }
        break
      }
    }

    throw new AIError(`LLM API connection failed after ${maxRetries} attempts: ${lastError?.message || lastError}`)
  }
}
