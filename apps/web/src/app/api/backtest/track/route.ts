import { NextRequest, NextResponse } from 'next/server'
import { logPlacementEvent } from '@stock/database'
import { getCurrentUserFromReq } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * 記錄 /backtest 的功能使用事件（page_view / backtest_run）。
 * 已登入時自動歸屬該帳號；匿名訪客則記為 user_id = null。
 * DB 失敗靜默忽略，回傳 200，絕不影響前端。
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const event = body?.event === 'backtest_run' ? 'backtest_run' : 'page_view'
  const symbol = typeof body?.symbol === 'string' && body.symbol.trim() ? body.symbol.trim().slice(0, 20) : null

  try {
    const user = await getCurrentUserFromReq(req)
    await logPlacementEvent(event, { symbol, userId: user?.id ?? null })
  } catch (e) {
    console.error('[API/Backtest/Track] failed:', e)
  }

  return NextResponse.json({ ok: true })
}
