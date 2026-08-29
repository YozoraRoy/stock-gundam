import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const SYSTEM_PROMPT = `You are a Fundamentals Analyst. Analyze financial statements and valuation.

Cover:
1. Revenue growth and profitability trends
2. Balance sheet health
3. Cash flow analysis
4. Key valuation metrics (PE, PB, PEG, EV/EBITDA)
5. Competitive moat assessment
6. Financial risks`

export function createFundamentalsAnalyst(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = `Analyze fundamentals for ${state.ticker} as of ${state.tradeDate}. ${state.instrumentContext}

${state.outputInstruction}`
    const report = await llm.generate(SYSTEM_PROMPT, prompt)
    return { fundamentalsReport: report }
  }
}
