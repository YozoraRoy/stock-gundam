import { z } from 'zod'
import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const TraderProposalSchema = z.object({
  action: z.enum(['Buy', 'Hold', 'Sell']),
  reasoning: z.string(),
  entryPrice: z.number().optional(),
  entry_price: z.number().optional(),
  stopLoss: z.number().optional(),
  stop_loss: z.number().optional(),
  positionSizing: z.string().optional(),
  position_sizing: z.string().optional(),
}).transform((data) => ({
  action: data.action,
  reasoning: data.reasoning,
  entryPrice: data.entryPrice ?? data.entry_price,
  stopLoss: data.stopLoss ?? data.stop_loss,
  positionSizing: data.positionSizing ?? data.position_sizing,
}))

export function createTrader(llm: LLMClient) {
  return async (state: AnalysisState): Promise<Partial<AnalysisState>> => {
    const prompt = [
      `You are the Trader. Convert the Research Manager's plan into a concrete trade proposal.`,
      '',
      state.instrumentContext,
      `Investment Plan: ${state.investmentPlan}`,
      '',
      `Specify: action (Buy/Hold/Sell), reasoning, entry price, stop loss, and position sizing.`,
    ].join('\n')

    const proposal = await llm.generateObject<z.infer<typeof TraderProposalSchema>>(
      'You convert investment plans into concrete trade orders with specific prices and sizing.',
      prompt,
      TraderProposalSchema,
    )

    const traderPlan = [
      `**Action**: ${proposal.action}`,
      `**Reasoning**: ${proposal.reasoning}`,
      proposal.entryPrice ? `**Entry Price**: ${proposal.entryPrice}` : '',
      proposal.stopLoss ? `**Stop Loss**: ${proposal.stopLoss}` : '',
      proposal.positionSizing ? `**Position Sizing**: ${proposal.positionSizing}` : '',
      `FINAL TRANSACTION PROPOSAL: **${proposal.action.toUpperCase()}**`,
    ].filter(Boolean).join('\n')

    return { traderProposal: traderPlan }
  }
}
