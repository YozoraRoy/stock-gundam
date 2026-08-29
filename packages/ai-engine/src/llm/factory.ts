import type { LLMClient, LLMConfig } from './client.js'
import { OpenAICompatibleClient } from './openai-client.js'
import { GoogleClient } from './google-client.js'

export class LLMFactory {
  static create(config: LLMConfig): LLMClient {
    const provider = config.provider.toLowerCase()

    if (provider === 'google') {
      return new GoogleClient({
        ...config,
        apiKey: config.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
        baseUrl: config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta',
      })
    }

    if (provider === 'openai') {
      return new OpenAICompatibleClient({
        ...config,
        // 顯式傳入的 apiKey（例如 fallback 專用 key）優先於全域 OPENAI_API_KEY
        apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
      })
    }

    return new OpenAICompatibleClient(config)
  }
}
