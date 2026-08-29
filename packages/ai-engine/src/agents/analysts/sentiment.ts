import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const SYSTEM_PROMPT = `You are a Sentiment Analyst. Analyze market sentiment from social media and news.

Provide:
1. Overall sentiment direction (Bullish/Bearish/Neutral/Mixed)
2. Sentiment score (0-10)
3. Confidence level
4. Source-by-source breakdown
5. Dominant narrative themes`

export function createSentimentAnalyst(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = `Analyze sentiment for ${state.ticker} around ${state.tradeDate}. ${state.instrumentContext}

${state.outputInstruction}`
    const report = await llm.generate(SYSTEM_PROMPT, prompt)
    return { sentimentReport: report }
  }
}
