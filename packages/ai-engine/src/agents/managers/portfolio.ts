import { z } from 'zod'
import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'
import { truncateField } from '../../context.js'

const PortfolioDecisionSchema = z.object({
  rating: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  final_decision: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  decision: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  executiveSummary: z.string().optional(),
  executive_summary: z.string().optional(),
  investmentThesis: z.string().optional(),
  investment_thesis: z.string().optional(),
  rationale: z.string().optional(),
  priceTarget: z.number().optional(),
  price_target: z.number().optional(),
  timeHorizon: z.string().optional(),
  time_horizon: z.string().optional(),
}).transform((data) => ({
  rating: data.rating ?? data.final_decision ?? data.decision ?? 'Hold',
  executiveSummary: data.executiveSummary ?? data.executive_summary ?? '',
  investmentThesis: data.investmentThesis ?? data.investment_thesis ?? data.rationale ?? '',
  priceTarget: data.priceTarget ?? data.price_target,
  timeHorizon: data.timeHorizon ?? data.time_horizon,
}))

export function createPortfolioManager(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = [
      `You are the Portfolio Manager. Synthesize the risk debate into the final trading decision.`,
      '',
      truncateField(state.instrumentContext, 'Resources:'),
      truncateField(state.pastContext, `Past lessons:`),
      truncateField(state.investmentPlan, `Investment Plan:`),
      truncateField(state.traderProposal, `Trader Proposal:`),
      truncateField(state.riskDebate.history, `Risk Debate:`),
      '',
      `Rating scale: Buy / Overweight / Hold / Underweight / Sell`,
      'Be decisive and ground every conclusion in specific evidence.',
      '',
      state.outputInstruction,
    ].join('\n')

    const decision = await llm.generateObject<z.infer<typeof PortfolioDecisionSchema>>(
      'You are a portfolio manager making final investment decisions.',
      prompt,
      PortfolioDecisionSchema,
    )

    const finalDecision = [
      `**Rating**: ${decision.rating}`,
      `**Executive Summary**: ${decision.executiveSummary}`,
      `**Investment Thesis**: ${decision.investmentThesis}`,
      decision.priceTarget ? `**Price Target**: ${decision.priceTarget}` : '',
      decision.timeHorizon ? `**Time Horizon**: ${decision.timeHorizon}` : '',
    ].filter(Boolean).join('\n')

    return {
      riskDebate: {
        ...state.riskDebate,
        judgeDecision: finalDecision,
      },
      finalDecision,
    }
  }
}
