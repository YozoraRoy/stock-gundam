import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const market = searchParams.get('market') ?? 'TW'
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  try {
    const provider = registry.get('yahoo-finance')
    const quote = await provider.getQuote(symbol, market)
    const profile = await provider.getProfile(symbol, market)
    return NextResponse.json({ quote, profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
