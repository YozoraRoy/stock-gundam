import { NextResponse } from 'next/server'
import { migrate, fetchTwseOddLots, fetchStockGift } from '@stock/database'

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
    const oddLotCount = await fetchTwseOddLots()

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
