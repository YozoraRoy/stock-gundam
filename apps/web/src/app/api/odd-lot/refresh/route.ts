import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { fetchTwseOddLots, fetchStockGift, migrate } from '@stock/database'
import { getLastMarketTradingDay, isTaiwanMarketTradingDay } from '@/utils/taiwan-calendar'

function formatDateCompact(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function POST() {
  try {
    await migrate()
    const today = new Date()
    const targetDate = isTaiwanMarketTradingDay(today) ? today : getLastMarketTradingDay(today)
    const dateStr = formatDateCompact(targetDate)
    const oddLotCount = await fetchTwseOddLots(dateStr)
    const giftCount = await fetchStockGift()
    revalidateTag('odd-lot')
    return NextResponse.json({
      success: true,
      oddLotCount,
      giftCount,
      targetDate: dateStr,
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
