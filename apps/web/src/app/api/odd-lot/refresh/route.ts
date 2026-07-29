import { NextResponse } from 'next/server'
import { fetchTwseOddLots, fetchStockGift, migrate } from '@stock/database'

export async function POST() {
  try {
    await migrate()
    const oddLotCount = await fetchTwseOddLots()
    const giftCount = await fetchStockGift()
    return NextResponse.json({
      success: true,
      oddLotCount,
      giftCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[API/odd-lot/refresh] Failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refresh data' },
      { status: 500 },
    )
  }
}
