import { NextResponse } from 'next/server'
import { getPlacementEventStats } from '@stock/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 回測頁使用統計（造訪/啟動次數、依 symbol、依登入帳號）。 */
export async function GET() {
  try {
    const stats = await getPlacementEventStats()
    return NextResponse.json(stats)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? '讀取統計失敗' }, { status: 500 })
  }
}
