import type { MarketDataProvider } from '../provider.js'
import type { OHLCV, Quote, Fundamentals, CompanyProfile } from '../types.js'
import { MarketDataError } from '@stock/core'
import { TTLCache } from '../cache.js'

/** 歷史日線快取：盤中資料不劇烈變動，擋掉重複請求避免觸發 Yahoo Rate Limit。 */
const historyCache = new TTLCache<OHLCV[]>(15 * 60 * 1000)

/** 標的類型（ETF / EQUITY）快取：很少變動，重用避免重複呼叫 Yahoo。 */
const assetTypeCache = new TTLCache<string>(60 * 60 * 1000)

interface YahooResult {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketVolume?: number; symbol?: string }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: number[]
          high?: number[]
          low?: number[]
          close?: number[]
          volume?: number[]
        }>
        adjclose?: Array<{ adjclose?: number[] }>
      }
    }>
  }
}

async function yahooFetch(path: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new MarketDataError(`Yahoo Finance API error: ${res.status}`)
    return await res.json()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new MarketDataError(`Yahoo Finance request timeout for ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 偵測標的類型（"ETF" / "EQUITY" / ...），使用 Yahoo search 的 quoteType 欄位。
 * 用 search 而非 chart 或 quoteSummary，因為 ETF 的 quoteSummary modules（如 price）常回 404。
 * 有 1 小時 TTL 快取；查無結果回空白字串。
 */
async function detectQuoteType(symbol: string): Promise<string> {
  const cached = assetTypeCache.get(symbol)
  if (cached !== undefined) return cached

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=3`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data: any = await res.json()
    const match = (data?.quotes ?? []).find(
      (q: any) => (q.symbol ?? '').toUpperCase() === symbol.toUpperCase(),
    )
    const quoteType: string = match?.quoteType ?? ''
    assetTypeCache.set(symbol, quoteType)
    return quoteType
  } catch (_) {
    return ''
  }
}

export const yahooFinanceProvider: MarketDataProvider = {
  name: 'yahoo-finance',

  async getQuote(symbol: string): Promise<Quote> {
    const data: YahooResult = await yahooFetch(`/chart/${symbol}?range=1d&interval=1d`)
    const result = data.chart?.result?.[0]
    const meta = result?.meta
    if (!meta) throw new MarketDataError(`No quote data for ${symbol}`)

    return {
      symbol: meta.symbol ?? symbol,
      price: meta.regularMarketPrice ?? 0,
      change: 0,
      changePercent: 0,
      volume: meta.regularMarketVolume ?? 0,
      timestamp: Date.now(),
    }
  },

  async getHistory(symbol: string, _market: string, start?: string, end?: string): Promise<OHLCV[]> {
    const cacheKey = `${symbol}|${start ?? ''}|${end ?? ''}`
    const cached = historyCache.get(cacheKey)
    if (cached) return cached

    // start/end 為 ISO 日期字串（YYYY-MM-DD）；未給時維持預設 range=1y。
    let query = 'range=1y&interval=1d'
    if (start) {
      const p1 = Math.floor(new Date(start).getTime() / 1000)
      const p2 = end ? Math.floor(new Date(end).getTime() / 1000) : ''
      query = `period1=${p1}${p2 ? `&period2=${p2}` : ''}&interval=1d`
    }

    const data: YahooResult = await yahooFetch(`/chart/${symbol}?${query}`)

    const result = data.chart?.result?.[0]
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return []

    const quote = result.indicators.quote[0]
    const adjclose = result.indicators.adjclose?.[0]?.adjclose

    // 全域等比例還原：Ratio = AdjClose / Close，將 Open/High/Low 全乘上 Ratio，
    // 確保回傳序列是完全還原價格（引擎只吃全還原數據）。
    const rows: OHLCV[] = result.timestamp
      .map((ts, i) => {
        const rawClose = quote.close?.[i] ?? 0
        const adj = adjclose?.[i] ?? rawClose
        const ratio = rawClose > 0 ? adj / rawClose : 1
        return {
          timestamp: ts * 1000,
          open: (quote.open?.[i] ?? 0) * ratio,
          high: (quote.high?.[i] ?? 0) * ratio,
          low: (quote.low?.[i] ?? 0) * ratio,
          close: adj,
          volume: quote.volume?.[i] ?? 0,
        }
      })
      .filter((v) => v.timestamp && v.close > 0)

    if (rows.length > 0) historyCache.set(cacheKey, rows)
    return rows
  },

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const data: any = await yahooFetch(`/chart/${symbol}?range=1d&interval=1d`)
    return { symbol }
  },

  async getProfile(symbol: string): Promise<CompanyProfile> {
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=assetProfile`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data: any = await res.json()

    const profile = data?.quoteSummary?.result?.[0]?.assetProfile
    return {
      symbol,
      name: profile?.companyName ?? symbol,
      sector: profile?.sector,
      industry: profile?.industry,
      exchange: profile?.exchange,
      description: profile?.longBusinessSummary,
      quoteType: await detectQuoteType(symbol),
    }
  },

  async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; market: string; quoteType?: string }>> {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data: any = await res.json()
    return (data.quotes ?? []).map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      market: q.exchange ?? 'US',
      quoteType: q.quoteType,
    }))
  },
}
