import { NextResponse } from 'next/server'
import { getCurrentUserFromCookies } from '../../../../lib/auth'
import { getPortfolioRecords } from '@stock/database'

export async function GET(req: Request) {
  const user = await getCurrentUserFromCookies()
  if (!user) {
    return NextResponse.json({ error: 'login required' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit')) || 20

  try {
    const records = await getPortfolioRecords(user.id, Math.min(Math.max(limit, 1), 100))
    return NextResponse.json({ success: true, records })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}