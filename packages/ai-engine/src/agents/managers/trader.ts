import { z } from 'zod'
import type { AnalysisState } from '@stock/core'
import type { LLMClient } from '../../llm/client.js'

const PositionSizingSchema = z.union([
  z.string(),
  z.object({
    total_allocation_pct: z.number().optional(),
    total_allocation: z.number().optional(),
    phased_entry: z.array(
      z.object({
        tranche: z.number().optional(),
        percentage_of_total: z.number().optional(),
        trigger: z.string().optional(),
        price: z.number().optional(),
      }),
    ).optional(),
    risk_per_trade_pct: z.number().optional(),
  }).passthrough(),
])

function formatPositionSizing(value: string | object | undefined): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  const obj = value as Record<string, any>
  const lines: string[] = []
  const allocation =
    obj.total_allocation_pct ??
    obj.total_allocation ??
    obj.allocation_pct ??
    obj.percent
  if (allocation != null) lines.push(`Total allocation: ${allocation}%`)
  if (obj.risk_per_trade_pct != null) lines.push(`Risk per trade: ${obj.risk_per_trade_pct}%`)
  if (Array.isArray(obj.phased_entry) && obj.phased_entry.length > 0) {
    const tranches = obj.phased_entry
      .map((t: Record<string, any>) => {
        const pct = t.percentage_of_total ?? t.percent ?? t.weight
        const trigger = t.trigger ?? t.condition
        const price = t.price ?? t.target_price
        return [
          t.tranche != null ? `Tranche ${t.tranche}` : 'Tranche',
          pct != null ? `(${pct}%)` : null,
          trigger ? `: ${trigger}` : null,
          price != null ? ` @ ${price}` : null,
        ].filter(Boolean).join(' ')
      })
      .join('; ')
    lines.push(`Phased entry: ${tranches}`)
  }
  return lines.length > 0 ? lines.join(', ') : JSON.stringify(obj)
}

const TraderProposalSchema = z.object({
  action: z.enum(['Buy', 'Hold', 'Sell']),
  reasoning: z.string(),
  entryPrice: z.number().optional(),
  entry_price: z.number().optional(),
  stopLoss: z.number().optional(),
  stop_loss: z.number().optional(),
  positionSizing: z.union([z.string(), PositionSizingSchema]).optional(),
  position_sizing: z.union([z.string(), PositionSizingSchema]).optional(),
}).transform((data) => ({
  action: data.action,
  reasoning: data.reasoning,
  entryPrice: data.entryPrice ?? data.entry_price,
  stopLoss: data.stopLoss ?? data.stop_loss,
  positionSizing: formatPositionSizing(data.positionSizing ?? data.position_sizing),
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
