import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const SYSTEM_PROMPT = `You are a Market Technical Analyst. Your job is to analyze price action, trends, and technical indicators.

Write a detailed technical analysis report covering:
1. Trend direction and strength
2. Key support/resistance levels
3. Volume patterns
4. Notable technical formations
5. Actionable insights for traders`

export function createMarketAnalyst(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = `Analyze ${state.ticker} as of ${state.tradeDate}. ${state.instrumentContext}`
    const report = await llm.generate(SYSTEM_PROMPT, prompt)
    return { marketReport: report }
  }
}
