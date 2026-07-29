import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const SYSTEM_PROMPT = `You are a News & Macro Analyst. Analyze recent news and macroeconomic factors.

Cover:
1. Company-specific news
2. Industry/sector developments
3. Macroeconomic indicators
4. Geopolitical factors
5. Insider transactions
6. Key catalysts and risks`

export function createNewsAnalyst(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = `Research latest news for ${state.ticker} as of ${state.tradeDate}. ${state.instrumentContext}`
    const report = await llm.generate(SYSTEM_PROMPT, prompt)
    return { newsReport: report }
  }
}
