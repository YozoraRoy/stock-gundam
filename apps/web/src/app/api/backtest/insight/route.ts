import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'
import { runGridSearch, MA_PERIOD } from '@stock/backtest'
import { resolveYahooSymbol } from '@/lib/portfolio'

/** 抓取約 8 個月日線：足夠算 MA60 warmup + 最新收盤乖離。 */
const HISTORY_DAYS = 240

export const dynamic = 'force-dynamic'

export interface InsightResult {
  symbol: string
  bestThreshold: number | null
  currentBias: number | null
  livePriceBias: number | null
  ma60: number | null
  livePrice: number | null
  asOf: number | null
  targetPrice: number | null
  /** 目前乖離是否已達到最佳進場閾值（乖離 ≤ 閾值）。 */
  inEntryZone: boolean
  distanceToTargetPct: number | null
}

const cache = new Map<string, { at: number; data: InsightResult }>()
const TTL_MS = 30 * 60 * 1000

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.trim()
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data)
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
      const data: InsightResult = {
        symbol: yahooSymbol,
        bestThreshold: null,
        currentBias: null,
        livePriceBias: null,
        ma60: null,
        livePrice: null,
        asOf: null,
        targetPrice: null,
        inEntryZone: false,
        distanceToTargetPct: null,
      }
      cache.set(symbol, { at: Date.now(), data })
      return NextResponse.json(data)
    }

    // 最佳進場乖離閾值（以約 8 個月資料快速尋優，僅取 bestThreshold）
    let bestThreshold: number | null = null
    try {
      const g = runGridSearch(history, { params: {} })
      bestThreshold = g.bestThreshold ?? null
    } catch (_) {
      bestThreshold = null
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

    const currentBias = livePriceBias ?? latestBias
    const inEntryZone = currentBias != null && bestThreshold != null && currentBias <= bestThreshold / 100
    const distanceToTargetPct =
      currentBias != null && bestThreshold != null ? (currentBias - bestThreshold / 100) * 100 : null
    const targetPrice =
      bestThreshold != null && ma60 > 0 ? ma60 * (1 + bestThreshold / 100) : null

    const data: InsightResult = {
      symbol: yahooSymbol,
      bestThreshold,
      currentBias,
      livePriceBias,
      ma60,
      livePrice,
      asOf: history[history.length - 1].timestamp,
      targetPrice,
      inEntryZone,
      distanceToTargetPct,
    }
    cache.set(symbol, { at: Date.now(), data })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '計算失敗' }, { status: 500 })
  }
}
