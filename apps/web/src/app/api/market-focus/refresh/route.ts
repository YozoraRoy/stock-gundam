import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { migrate } from '@stock/database'
import { refreshMarketFocus } from '@/lib/market-focus'
import { authorizeSync } from '@/lib/sync-auth'

export async function POST(req: Request) {
  if (!authorizeSync(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await migrate()
    const items = await refreshMarketFocus()
    revalidateTag('market-focus')
    return NextResponse.json({
      success: true,
      count: items.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[API/market-focus/refresh] Failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refresh market focus' },
      { status: 500 },
    )
  }
}