import { AssetType, type AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const SYSTEM_PROMPT = `You are a Fundamentals Analyst. Analyze financial statements and valuation.

Cover:
1. Revenue growth and profitability trends
2. Balance sheet health
3. Cash flow analysis
4. Key valuation metrics (PE, PB, PEG, EV/EBITDA)
5. Competitive moat assessment
6. Financial risks`

const ETF_SYSTEM_PROMPT = `You are an ETF Analyst. Analyze the exchange-traded fund as a basket of underlying securities.

Cover (ETF-specific, NOT single-company fundamentals):
1. Underlying index/benchmark and what it tracks
2. Top holdings and sector/geographic composition
3. Tracking error and the fund's deviation from its benchmark
4. Expense ratio and fees
5. Premium/discount of market price to NAV (net asset value)
6. Distribution/yield characteristics and dividend policy
7. Risks specific to ETFs (concentration, liquidity, tracking, market risk)
IMPORTANT: Do NOT apply single-company metrics like PE, PB, or competitive moat to an ETF.`

export function createFundamentalsAnalyst(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const isETF = state.assetType === AssetType.ETF
    const systemPrompt = isETF ? ETF_SYSTEM_PROMPT : SYSTEM_PROMPT
    const prompt = `Analyze fundamentals for ${state.ticker} as of ${state.tradeDate}. ${state.instrumentContext}

${state.outputInstruction}`
    const report = await llm.generate(systemPrompt, prompt)
    return { fundamentalsReport: report }
  }
}
