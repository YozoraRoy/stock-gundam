import { NextResponse } from 'next/server'
import { migrate, fetchTwseOddLots, fetchStockGift } from '@stock/database'
import { getLastMarketTradingDay, isTaiwanMarketTradingDay } from '@/utils/taiwan-calendar'

function formatDateCompact(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const secret = process.env.CRON_SECRET || 'stock123'

  if (process.env.CRON_SECRET && key !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Invalid cron key' }, { status: 401 })
  }

  try {
    await migrate()
    console.log('[API/Cron/Seed] Starting TWSE odd lots seed...')
    // TWT53U 無 date 參數，回傳最近一交易日盤後資料。於非交易日執行時會誤標日期，
    // 因此一律以「最近開市日」作為該批資料的 date，確保資料與交易日一致。
    const today = new Date()
    const targetDate = isTaiwanMarketTradingDay(today) ? today : getLastMarketTradingDay(today)
    const dateStr = formatDateCompact(targetDate)
    const oddLotCount = await fetchTwseOddLots(dateStr)

    console.log('[API/Cron/Seed] Starting shareholder gifts seed...')
    const giftCount = await fetchStockGift()

    return NextResponse.json({
      success: true,
      message: 'Daily seed executed successfully',
      timestamp: new Date().toISOString(),
      results: {
        oddLotCount,
        giftCount,
      },
    })
  } catch (error: any) {
    console.error('[API/Cron/Seed] Failed to run cron seed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute seed cron',
      },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
