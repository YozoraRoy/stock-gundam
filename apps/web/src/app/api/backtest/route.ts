import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'
import { runGridSearch } from '@stock/backtest'
import { resolveYahooSymbol } from '@/lib/portfolio'

/** 一個交易年約多少交易日。 */
const TRADING_DAYS_PER_YEAR = 250

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

  const holdingDays = parseNum(searchParams.get('holdingDays'), 252, 1, 252)
  const targetPct = parseNum(searchParams.get('target'), 25, 1, 100)
  const stopPct = parseNum(searchParams.get('stop'), 12, 1, 100)
  const years = parseNum(searchParams.get('years'), 15, 1, 15)

  try {
    const provider = registry.get('yahoo-finance')
    const yahooSymbol = await resolveYahooSymbol(symbol, 'tw')
    const end = new Date()
    const start = new Date(end)
    start.setFullYear(start.getFullYear() - years)

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

    // 圖表序列長度隨所選年數調整（勝率回測亦以該年數為準）。
    const chartLookback = years * TRADING_DAYS_PER_YEAR
    return NextResponse.json(
      {
        ...result,
        series: result.series.slice(-chartLookback),
        usage: { ...result.usage, holdingDays, targetPct, stopPct, years },
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '回測失敗' }, { status: 500 })
  }
}
