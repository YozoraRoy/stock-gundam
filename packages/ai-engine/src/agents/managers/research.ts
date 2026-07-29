import { z } from 'zod'
import type { AnalysisState, Rating } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const ResearchPlanSchema = z.object({
  recommendation: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  rating: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  rationale: z.string(),
  strategicActions: z.union([z.string(), z.array(z.string())]).optional(),
  strategic_actions: z.union([z.string(), z.array(z.string())]).optional(),
}).transform((data) => {
  const normalizeActions = (actions: string | string[] | undefined): string => {
    if (!actions) return ''
    if (Array.isArray(actions)) {
      return actions.map(act => act.trim()).filter(Boolean).map(act => `- ${act}`).join('\n')
    }
    return actions
  }

  return {
    recommendation: data.recommendation ?? data.rating ?? 'Hold',
    rationale: data.rationale,
    strategicActions: normalizeActions(data.strategicActions ?? data.strategic_actions),
  }
})

export function createResearchManager(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = [
      `You are the Research Manager. Synthesize the bull/bear debate and produce an investment plan.`,
      '',
      state.instrumentContext,
      `Bull arguments: ${state.investDebate.bullHistory}`,
      `Bear arguments: ${state.investDebate.bearHistory}`,
      '',
      `Rate: Buy / Overweight / Hold / Underweight / Sell`,
      `Provide rationale and strategic actions.`,
    ].join('\n')

    const plan = await llm.generateObject<{ recommendation: Rating; rationale: string; strategicActions: string }>(
      'You synthesize investment research debates into clear recommendations.',
      prompt,
      ResearchPlanSchema,
    )

    const investmentPlan = [
      `**Recommendation**: ${plan.recommendation}`,
      `**Rationale**: ${plan.rationale}`,
      `**Strategic Actions**: ${plan.strategicActions}`,
    ].join('\n')

    return { investmentPlan }
  }
}
