import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

export function createAggressiveDebator(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const { riskDebate, traderProposal } = state
    const history = riskDebate.history

    const prompt = [
      `You are an AGGRESSIVE risk analyst. You believe in taking calculated risks for higher returns.`,
      '',
      state.instrumentContext,
      `Trader Proposal: ${traderProposal}`,
      `Debate history: ${history}`,
      '',
      'Argue for a more aggressive position sizing and risk tolerance. Point out missed opportunities from being too conservative.',
    ].join('\n')

    const response = `Aggressive Analyst: ${await llm.generate('You are an aggressive risk-taker who pushes for larger positions.', prompt)}`

    return {
      riskDebate: {
        ...riskDebate,
        history: history + '\n' + response,
        aggressiveHistory: riskDebate.aggressiveHistory + '\n' + response,
        latestSpeaker: 'Aggressive',
      },
    }
  }
}
