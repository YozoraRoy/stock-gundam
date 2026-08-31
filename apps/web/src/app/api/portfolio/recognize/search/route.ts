import { NextResponse } from 'next/server'
import { searchStockCandidates, type Market } from '../../../../../lib/portfolio'
import { getCurrentUserFromCookies } from '../../../../../lib/auth'

export const runtime = 'nodejs'

/** 依名稱或代號搜尋股票候選清單（台股用本地 DB 中文名稱、美股用 Yahoo），供辨識確認表格手動補齊。 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromCookies()
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const market: Market | null = body?.market === 'tw' || body?.market === 'us' ? body.market : null
  const q = typeof body?.q === 'string' ? body.q.trim() : ''
  if (!market || !q) {
    return NextResponse.json({ results: [], error: 'q 與 market 為必填' }, { status: 400 })
  }

  const results = await searchStockCandidates(q, market)
  return NextResponse.json({ results })
}