import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'
import { runGridSearch } from '@stock/backtest'
import { resolveYahooSymbol } from '@/lib/portfolio'

/** 近 2 年圖表序列長度（約 500 個交易日）。 */
const CHART_LOOKBACK = 500
/** 回測資料回溯年數。 */
const YEARS_OF_HISTORY = 10

export const dynamic = 'force-dynamic'

function parseNum(v: string | null, fallback: number, min: number, max: number): number {
  if (v == null || v.trim() === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.trim()
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  const holdingDays = parseNum(searchParams.get('holdingDays'), 40, 1, 252)
  const targetPct = parseNum(searchParams.get('target'), 8, 1, 100)
  const stopPct = parseNum(searchParams.get('stop'), 5, 1, 100)

  try {
    const provider = registry.get('yahoo-finance')
    const yahooSymbol = await resolveYahooSymbol(symbol, 'tw')
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(start.getFullYear() - YEARS_OF_HISTORY)

    const history = await provider.getHistory(
      yahooSymbol,
      'TW',
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    )
    if (history.length < 61) {
      return NextResponse.json({ error: '資料不足，無法執行回測' }, { status: 422 })
    }

    const result = runGridSearch(history, {
      params: {
        holdingDays,
        targetProfit: targetPct / 100,
        maxDrawdown: stopPct / 100,
      },
    })

    // Payload 防護：只回傳近 2 年圖表序列給前端，勝率回測仍以 10 年為準。
    return NextResponse.json(
      {
        ...result,
        series: result.series.slice(-CHART_LOOKBACK),
        usage: { ...result.usage, holdingDays, targetPct, stopPct },
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '回測失敗' }, { status: 500 })
  }
}
