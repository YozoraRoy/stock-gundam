import { NextResponse } from 'next/server'
import { searchStockCandidates } from '@/lib/portfolio'

export const runtime = 'nodejs'

/** 依中文名稱或代號搜尋台股候選（本地 DB + fuzzy + Yahoo fallback），供回測頁選股。 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const results = await searchStockCandidates(q, 'tw')
  return NextResponse.json({ results })
}
