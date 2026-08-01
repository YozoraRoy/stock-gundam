import type { LLMClient, LLMConfig, LLMUsage } from './client.js'
import { AIError } from '@stock/core'

export class OpenAICompatibleClient implements LLMClient {
  onUsage?: (usage: LLMUsage) => void

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
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 180_000
    const maxTokens = Number(process.env.LLM_MAX_TOKENS) || 8192
    const disableThinking = (process.env.LLM_DISABLE_THINKING ?? 'true').toLowerCase() !== 'false'

    let lastError: any = null

    const requestBody: Record<string, any> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: maxTokens,
    }

    // 推理型模型（如 big-pickle/deepseek-v4-flash）會把 token 預算全燒在
    // reasoning_content，導致 content 為空或逾時。OpenCode Zen 支援停用
    // thinking，讓模型直接輸出答案，避免「No content」與 60s abort。
    if (disableThinking && this.config.baseUrl?.includes('opencode.ai')) {
      requestBody.thinking = { type: 'disabled' }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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

        const data: any = await res.json()

        if (this.onUsage && data.usage) {
          this.onUsage({
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          })
        }

        const message = data.choices?.[0]?.message
        if (message?.content) {
          return message.content
        }
        if (message?.reasoning_content) {
          return message.reasoning_content
        }
        throw new AIError('No content in model response')

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
