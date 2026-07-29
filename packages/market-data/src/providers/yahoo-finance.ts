import type { MarketDataProvider } from '../provider.js'
import type { OHLCV, Quote, Fundamentals, CompanyProfile } from '../types.js'
import { MarketDataError } from '@stock/core'

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
    const period = start && end ? `${start}&period2=${Math.floor(new Date(end).getTime() / 1000)}` : 'max'
    const range = start ? `period1=${Math.floor(new Date(start).getTime() / 1000)}&${period}` : 'range=1y'
    const data: YahooResult = await yahooFetch(`/chart/${symbol}?${range}&interval=1d`)

    const result = data.chart?.result?.[0]
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return []

    const quote = result.indicators.quote[0]
    const adjclose = result.indicators.adjclose?.[0]?.adjclose

    return result.timestamp
      .map((ts, i) => ({
        timestamp: ts * 1000,
        open: quote.open?.[i] ?? 0,
        high: quote.high?.[i] ?? 0,
        low: quote.low?.[i] ?? 0,
        close: adjclose?.[i] ?? quote.close?.[i] ?? 0,
        volume: quote.volume?.[i] ?? 0,
      }))
      .filter((v) => v.timestamp && v.close > 0)
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
    }
  },

  async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; market: string }>> {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data: any = await res.json()
    return (data.quotes ?? []).map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      market: q.exchange ?? 'US',
    }))
  },
}
