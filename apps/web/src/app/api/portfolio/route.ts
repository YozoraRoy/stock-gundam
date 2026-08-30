import { NextResponse } from 'next/server'
import { getCurrentUserFromCookies } from '../../../lib/auth'
import { computePnL, validatePortfolioInput, type PortfolioInput } from '../../../lib/portfolio'
import { savePortfolioRecord } from '@stock/database'

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromCookies()
    if (!user) {
      return NextResponse.json({ error: 'login required' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = validatePortfolioInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { market, symbol, shares, cost, currentPrice, dividend, symbolName } = parsed.data
    const pnl = computePnL(parsed.data as PortfolioInput)

    const id = await savePortfolioRecord({
      user_id: user.id,
      market,
      symbol,
      symbolName,
      shares,
      cost,
      currentPrice,
      dividend,
      costBasis: pnl.costBasis,
      marketValue: pnl.marketValue,
      unrealizedPnl: pnl.unrealizedPnl,
      unrealizedPnlPct: pnl.unrealizedPnlPct,
      totalReturn: pnl.totalReturn,
      totalReturnPct: pnl.totalReturnPct,
      yieldOnCost: pnl.yieldOnCost,
    })

    return NextResponse.json({
      success: true,
      record: {
        id, market, symbol, symbolName, shares, cost, currentPrice, dividend,
        ...pnl,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}