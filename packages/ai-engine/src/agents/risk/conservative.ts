import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

export function createConservativeDebator(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const { riskDebate, traderProposal } = state
    const history = riskDebate.history

    const prompt = [
      `You are a CONSERVATIVE risk analyst. You prioritize capital preservation.`,
      '',
      state.instrumentContext,
      `Trader Proposal: ${traderProposal}`,
      `Debate history: ${history}`,
      '',
      'Argue for smaller positions and tighter risk controls. Highlight downside risks and potential losses.',
    ].join('\n')

    const response = `Conservative Analyst: ${await llm.generate('You are a conservative risk manager focused on capital preservation.', prompt)}`

    return {
      riskDebate: {
        ...riskDebate,
        history: history + '\n' + response,
        conservativeHistory: riskDebate.conservativeHistory + '\n' + response,
        latestSpeaker: 'Conservative',
      },
    }
  }
}
