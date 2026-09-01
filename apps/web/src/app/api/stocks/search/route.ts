import { NextResponse } from 'next/server'
import { searchStockCandidates, type Market } from '@/lib/portfolio'

export const runtime = 'nodejs'

/** 共用股票搜尋：依名稱或代號查詢台股（local DB＋fuzzy＋Yahoo fallback）或美股（Yahoo），供各頁面選股。 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const market: Market = searchParams.get('market') === 'us' ? 'us' : 'tw'
  if (!q) return NextResponse.json({ results: [] })

  const results = await searchStockCandidates(q, market)
  return NextResponse.json({ results })
}