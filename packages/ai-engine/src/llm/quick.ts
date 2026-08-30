import type { AppConfig } from '@stock/core'
import { LLMFactory } from './factory.js'
import { FallbackClient } from './fallback-client.js'
import type { LLMClient } from './client.js'

/**
 * Build a "quick" LLM client with an optional fallback chain (shared by
 * portfolio analysis and image recognition). Uses QUICK group models.
 */
export function createQuickLLM(config: AppConfig): { llm: LLMClient; fallbackModel: string | null } {
  let llm = LLMFactory.create({
    provider: config.llmProvider,
    model: config.quickThinkModel,
    temperature: config.temperature,
    baseUrl: config.llmProvider !== 'google' ? config.backendUrl : undefined,
  })

  const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER
  let fallbackModel: string | null = null
  if (fallbackProvider) {
    fallbackModel = process.env.FALLBACK_QUICK_THINK_MODEL ?? 'gemini-2.5-flash'
    const baseUrl =
      process.env.FALLBACK_QUICK_LLM_BACKEND_URL?.trim() ||
      process.env.FALLBACK_LLM_BACKEND_URL?.trim() ||
      (fallbackProvider !== 'google' ? config.backendUrl : '') ||
      undefined
    const apiKey =
      process.env.FALLBACK_QUICK_LLM_API_KEY?.trim() ||
      process.env.FALLBACK_QUICK_OPENAI_API_KEY?.trim() ||
      process.env.FALLBACK_LLM_API_KEY?.trim() ||
      process.env.FALLBACK_OPENAI_API_KEY?.trim() ||
      undefined
    const fallback = LLMFactory.create({
      provider: fallbackProvider,
      model: fallbackModel,
      apiKey,
      baseUrl,
      temperature: config.temperature,
    })
    llm = new FallbackClient(llm, fallback)
  }

  return { llm, fallbackModel }
}