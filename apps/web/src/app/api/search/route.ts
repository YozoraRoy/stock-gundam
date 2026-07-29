import { NextResponse } from 'next/server'
import { registry } from '@stock/market-data'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ results: [] })

  try {
    const provider = registry.get('yahoo-finance')
    const results = await provider.searchSymbols(query)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
