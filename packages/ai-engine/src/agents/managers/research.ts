import { z } from 'zod'
import type { AnalysisState, Rating } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'
import { truncateField } from '../../context.js'

const ActionObjectSchema = z.object({
  action: z.string().optional(),
  details: z.string().optional(),
  priority: z.string().optional(),
}).passthrough()

type ActionInput = string | string[] | z.infer<typeof ActionObjectSchema>[] | undefined

const ResearchPlanSchema = z.object({
  recommendation: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  rating: z.enum(['Buy', 'Overweight', 'Hold', 'Underweight', 'Sell']).optional(),
  rationale: z.string(),
  strategicActions: z.union([z.string(), z.array(z.string()), z.array(ActionObjectSchema)]).optional(),
  strategic_actions: z.union([z.string(), z.array(z.string()), z.array(ActionObjectSchema)]).optional(),
}).transform((data) => {
  const normalizeActions = (actions: ActionInput): string => {
    if (!actions) return ''
    if (typeof actions === 'string') return actions
    if (Array.isArray(actions)) {
      return actions.map(act => {
        if (typeof act === 'string') return act
        const parts: string[] = []
        if (act.action) parts.push(act.action)
        if (act.details) parts.push(act.details)
        return parts.join('：')
      }).filter(Boolean).map(act => `- ${act}`).join('\n')
    }
    return String(actions)
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
      truncateField(state.instrumentContext, 'Resources:', undefined, state.outputLanguage),
      truncateField(state.investDebate.bullHistory, `Bull arguments:`, undefined, state.outputLanguage),
      truncateField(state.investDebate.bearHistory, `Bear arguments:`, undefined, state.outputLanguage),
      '',
      `Rate: Buy / Overweight / Hold / Underweight / Sell`,
      `Provide rationale and strategic actions.`,
      '',
      state.outputInstruction,
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
