import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

export function createNeutralDebator(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const { riskDebate, traderProposal } = state
    const history = riskDebate.history

    const prompt = [
      `You are a NEUTRAL risk analyst. You seek balance between risk and reward.`,
      '',
      state.instrumentContext,
      `Trader Proposal: ${traderProposal}`,
      `Debate history: ${history}`,
      '',
      'Find middle ground between aggressive and conservative positions. Suggest a balanced approach with moderate position sizing.',
    ].join('\n')

    const response = `Neutral Analyst: ${await llm.generate('You are a balanced, neutral risk analyst seeking middle ground.', prompt)}`

    return {
      riskDebate: {
        ...riskDebate,
        history: history + '\n' + response,
        neutralHistory: riskDebate.neutralHistory + '\n' + response,
        latestSpeaker: 'Neutral',
      },
    }
  }
}
