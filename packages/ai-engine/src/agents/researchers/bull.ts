import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'
import { buildSynthesizedReports } from '../../context.js'

export function createBullResearcher(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const { investDebate, marketReport, sentimentReport, newsReport, fundamentalsReport } = state
    const history = investDebate.history
    const lastBear = investDebate.currentResponse

    const prompt = [
      `You are a Bull Analyst advocating FOR investing in ${state.ticker}.`,
      '',
      `Resources:`,
      buildSynthesizedReports({
        instrumentContext: state.instrumentContext,
        marketReport,
        sentimentReport,
        newsReport,
        fundamentalsReport,
      }),
      `Debate history: ${history}`,
      `Last bear argument: ${lastBear}`,
      '',
      `Build a strong bull case addressing the bear's concerns. Focus on growth potential, competitive advantages, and positive catalysts.`,
      '',
      state.outputInstruction,
    ].join('\n')

    const argument = `Bull Analyst: ${await llm.generate('You are a bullish stock analyst arguing for investment.', prompt)}`

    return {
      investDebate: {
        ...investDebate,
        history: history + '\n' + argument,
        bullHistory: investDebate.bullHistory + '\n' + argument,
        currentResponse: argument,
        round: investDebate.round + 1,
      },
    }
  }
}
