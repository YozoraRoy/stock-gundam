import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'
import { MA_PERIOD } from '@stock/backtest'
import { resolveYahooSymbol } from '@/lib/portfolio'

/** 抓取約 8 個月的日線，足夠算 MA60 warmup + 最新收盤。 */
const HISTORY_DAYS = 240

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.trim()
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  try {
    const provider = registry.get('yahoo-finance')
    const yahooSymbol = await resolveYahooSymbol(symbol, 'tw')

    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - HISTORY_DAYS)

    const history = await provider.getHistory(
      yahooSymbol,
      'TW',
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    )
    if (history.length < MA_PERIOD) {
      return NextResponse.json({ error: '資料不足，無法計算目前乖離率' }, { status: 422 })
    }

    const closes = history.map((v) => v.close)
    const ma60 = closes.slice(-MA_PERIOD).reduce((s, c) => s + c, 0) / MA_PERIOD
    const latestClose = closes[closes.length - 1]
    const latestBias = ma60 > 0 ? latestClose / ma60 - 1 : null

    let livePrice: number | null = null
    let livePriceBias: number | null = null
    try {
      const quote = await provider.getQuote(yahooSymbol, 'TW')
      livePrice = quote.price > 0 ? quote.price : null
      if (livePrice != null && ma60 > 0) livePriceBias = livePrice / ma60 - 1
    } catch (_) {}

    return NextResponse.json(
      {
        symbol: yahooSymbol,
        ma60,
        latestClose,
        latestBias,
        livePrice,
        livePriceBias,
        asOf: history[history.length - 1].timestamp,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '計算失敗' }, { status: 500 })
  }
}
