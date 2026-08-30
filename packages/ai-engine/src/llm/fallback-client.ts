import type { LLMCallInfo, LLMClient, LLMUsage } from './client.js'

export class FallbackClient implements LLMClient {
  private _onCall?: (info: LLMCallInfo) => void
  private lastModel = ''

  /** Total number of calls that fell back to the secondary model. */
  fallbackCalls = 0

  constructor(
    private primary: LLMClient,
    private fallback: LLMClient,
  ) {}

  get model(): string {
    return this.lastModel || this.primary.model
  }

  get onUsage(): ((usage: LLMUsage) => void) | undefined {
    return this.primary.onUsage
  }

  set onUsage(cb: ((usage: LLMUsage) => void) | undefined) {
    this.primary.onUsage = cb
    this.fallback.onUsage = cb
  }

  get onCall(): ((info: LLMCallInfo) => void) | undefined {
    return this._onCall
  }

  // 不要轉發給 primary/fallback，由本層統一以正確的 usedFallback 旗標發出
  set onCall(cb: ((info: LLMCallInfo) => void) | undefined) {
    this._onCall = cb
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const out = await this.primary.generate(systemPrompt, userPrompt)
      this.lastModel = this.primary.model
      this._onCall?.({ model: this.primary.model, usedFallback: false })
      return out
    } catch (e: any) {
      console.warn(`[Fallback] Primary failed: ${e.message}`)
      this.fallbackCalls++
      const out = await this.fallback.generate(systemPrompt, userPrompt)
      this.lastModel = this.fallback.model
      this._onCall?.({ model: this.fallback.model, usedFallback: true })
      return out
    }
  }

  async generateObject<T>(systemPrompt: string, userPrompt: string, schema: any): Promise<T> {
    try {
      const out = await this.primary.generateObject<T>(systemPrompt, userPrompt, schema)
      this.lastModel = this.primary.model
      this._onCall?.({ model: this.primary.model, usedFallback: false })
      return out
    } catch (e: any) {
      console.warn(`[Fallback] Primary failed: ${e.message}`)
      this.fallbackCalls++
      const out = await this.fallback.generateObject<T>(systemPrompt, userPrompt, schema)
      this.lastModel = this.fallback.model
      this._onCall?.({ model: this.fallback.model, usedFallback: true })
      return out
    }
  }

  async generateWithImage(systemPrompt: string, userPrompt: string, imageDataUrl: string): Promise<string> {
    if (this.primary.generateWithImage) {
      try {
        const out = await this.primary.generateWithImage(systemPrompt, userPrompt, imageDataUrl)
        this.lastModel = this.primary.model
        this._onCall?.({ model: this.primary.model, usedFallback: false })
        return out
      } catch (e: any) {
        console.warn(`[Fallback] Primary image call failed: ${e.message}`)
      }
    }
    if (!this.fallback.generateWithImage) {
      throw new Error('Neither primary nor fallback LLM supports image input')
    }
    this.fallbackCalls++
    const out = await this.fallback.generateWithImage(systemPrompt, userPrompt, imageDataUrl)
    this.lastModel = this.fallback.model
    this._onCall?.({ model: this.fallback.model, usedFallback: true })
    return out
  }
}
