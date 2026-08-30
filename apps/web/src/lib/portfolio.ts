import { yahooFinanceProvider } from '@stock/market-data'

export type Market = 'tw' | 'us'

export interface PortfolioInput {
  market: Market
  symbol: string
  shares: number
  cost: number
  currentPrice: number
  dividend: number
  symbolName?: string
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function validatePortfolioInput(body: any): { ok: true; data: PortfolioInput } | { ok: false; error: string } {
  const market: Market | null = body?.market === 'tw' || body?.market === 'us' ? body.market : null
  const symbol = typeof body?.symbol === 'string' ? body.symbol.trim().toUpperCase() : ''
  const shares = toNum(body?.shares)
  const cost = toNum(body?.cost)
  const currentPrice = toNum(body?.currentPrice)
  const dividend = toNum(body?.dividend) ?? 0
  const symbolName = typeof body?.symbolName === 'string' ? body.symbolName : undefined

  if (!market || !symbol) return { ok: false, error: 'market 與 symbol 為必填' }
  if (shares == null || !(shares > 0)) return { ok: false, error: '持有股數需大於 0' }
  if (cost == null || cost < 0) return { ok: false, error: '每股成本需 >= 0' }
  if (currentPrice == null || !(currentPrice > 0)) return { ok: false, error: '每股現價需大於 0' }
  if (dividend == null || dividend < 0) return { ok: false, error: '股息總額需 >= 0' }

  return { ok: true, data: { market, symbol, shares, cost, currentPrice, dividend, symbolName } }
}

export interface PnLInput {
  market: Market
  shares: number
  cost: number
  currentPrice: number
  dividend: number
}

export interface PnLResult {
  costBasis: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  totalReturn: number
  totalReturnPct: number
  yieldOnCost: number
}

export function computePnL(input: PnLInput): PnLResult {
  const costBasis = input.shares * input.cost
  const marketValue = input.shares * input.currentPrice
  const unrealizedPnl = marketValue - costBasis
  const totalReturn = unrealizedPnl + input.dividend
  return {
    costBasis,
    marketValue,
    unrealizedPnl,
    unrealizedPnlPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
    totalReturn,
    totalReturnPct: costBasis > 0 ? (totalReturn / costBasis) * 100 : 0,
    yieldOnCost: costBasis > 0 ? (input.dividend / costBasis) * 100 : 0,
  }
}

/** 依市場解析 Yahoo 代號：台股純數字 → .TW/.TWO，美股直接用代號。 */
export async function resolveYahooSymbol(raw: string, market: Market): Promise<string> {
  const trimmed = raw.trim().toUpperCase()
  if (market === 'us') return trimmed

  if (/^\d{4,6}\.(TW|TWO)$/.test(trimmed)) return trimmed
  if (/^\d{4,6}$/.test(trimmed)) {
    try {
      const q = await yahooFinanceProvider.getQuote(`${trimmed}.TW`, 'TW')
      if (q.price > 0) return `${trimmed}.TW`
    } catch (_) {}
    try {
      const q = await yahooFinanceProvider.getQuote(`${trimmed}.TWO`, 'TW')
      if (q.price > 0) return `${trimmed}.TWO`
    } catch (_) {}
  }
  return trimmed
}

export interface LiveQuote {
  symbol: string
  price: number
  name: string | null
}

/** 抓取即時報價；失敗回 null（呼叫端自行決定是否以手輸值取代）。 */
export async function fetchLiveQuote(rawSymbol: string, market: Market): Promise<LiveQuote | null> {
  try {
    const symbol = await resolveYahooSymbol(rawSymbol, market)
    const quote = await yahooFinanceProvider.getQuote(symbol, market === 'tw' ? 'TW' : 'US')
    if (!quote.price || quote.price <= 0) return null
    let name: string | null = null
    try {
      const profile = await yahooFinanceProvider.getProfile(symbol, market === 'tw' ? 'TW' : 'US')
      name = profile.name && profile.name !== symbol ? profile.name : null
    } catch (_) {}
    return { symbol, price: quote.price, name }
  } catch (e) {
    console.error('[Portfolio] fetchLiveQuote failed:', e)
    return null
  }
}

/** 給 AI 用的市場上下文簡述。 */
export async function buildMarketContext(rawSymbol: string, market: Market): Promise<string> {
  try {
    const symbol = await resolveYahooSymbol(rawSymbol, market)
    const quote = await yahooFinanceProvider.getQuote(symbol, market === 'tw' ? 'TW' : 'US')
    const profile = await yahooFinanceProvider.getProfile(symbol, market === 'tw' ? 'TW' : 'US').catch(() => null)
    const lines = [
      `即時報價 ${symbol}: ${quote.price}（成交量 ${quote.volume}）`,
      profile?.name ? `公司名稱: ${profile.name}` : '',
      profile?.sector ? `產業: ${profile.sector}${profile.industry ? ` / ${profile.industry}` : ''}` : '',
      profile?.description ? `公司簡介: ${profile.description.slice(0, 800)}` : '',
    ].filter(Boolean)
    return lines.join('\n')
  } catch (e) {
    console.error('[Portfolio] buildMarketContext failed:', e)
    return ''
  }
}