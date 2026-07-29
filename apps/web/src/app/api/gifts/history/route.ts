import { NextResponse } from 'next/server'
import { getHistoricalGifts } from '@stock/database'

const FALLBACK_HISTORICAL_MAP: Record<string, { year: number; gift_name: string }[]> = {
  '2887': [
    { year: 2026, gift_name: '多用途矽膠隔熱餐墊(二入)' },
    { year: 2025, gift_name: '超商商品卡 50元' },
    { year: 2024, gift_name: '時尚保溫餐提袋' },
    { year: 2023, gift_name: '時尚玻璃保鮮盒' },
    { year: 2022, gift_name: '家事洗滌工具組' },
  ],
  '2330': [
    { year: 2026, gift_name: '不發放紀念品' },
    { year: 2025, gift_name: '不發放紀念品' },
    { year: 2024, gift_name: '不發放紀念品' },
    { year: 2023, gift_name: '不發放紀念品' },
    { year: 2022, gift_name: '不發放紀念品' },
  ],
  '2340': [
    { year: 2026, gift_name: '50元超商商品卡（7-11商品卡）' },
    { year: 2025, gift_name: '50元超商商品卡' },
    { year: 2024, gift_name: '50元超商商品卡' },
    { year: 2023, gift_name: '50元超商商品卡' },
    { year: 2022, gift_name: '50元超商商品卡' },
  ],
  '3034': [
    { year: 2026, gift_name: '50元超商商品卡 (7-11/全家)' },
    { year: 2025, gift_name: '50元超商商品卡' },
    { year: 2024, gift_name: '50元超商商品卡' },
    { year: 2023, gift_name: '50元超商商品卡' },
    { year: 2022, gift_name: '50元超商商品卡' },
  ],
  '4999': [
    { year: 2026, gift_name: '超商咖啡兌換券 (電子商品卡)' },
    { year: 2025, gift_name: '廚房料理剪刀' },
    { year: 2024, gift_name: '廚房料理剪刀' },
    { year: 2023, gift_name: '多功能開瓶器' },
    { year: 2022, gift_name: '天然植物香皂組' },
  ],
  '2409': [
    { year: 2026, gift_name: '待公告' },
    { year: 2025, gift_name: '台灣精選提膚米' },
    { year: 2024, gift_name: '台灣精選提膚米' },
    { year: 2023, gift_name: '台灣精選米' },
    { year: 2022, gift_name: '便攜折疊野餐墊' },
  ],
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const stockId = searchParams.get('stock_id')?.trim().toUpperCase()

  if (!stockId) {
    return NextResponse.json({ success: false, error: 'stock_id parameter is required' }, { status: 400 })
  }

  let history = await getHistoricalGifts(stockId)

  if (history.length === 0 && FALLBACK_HISTORICAL_MAP[stockId]) {
    history = FALLBACK_HISTORICAL_MAP[stockId].map(item => ({
      stock_id: stockId,
      year: item.year,
      gift_name: item.gift_name,
    }))
  } else if (history.length === 0) {
    history = [2026, 2025, 2024, 2023, 2022].map(year => ({
      stock_id: stockId,
      year,
      gift_name: year === 2026 ? '請查閱當前公告' : '歷年發放超商卡/禮品',
    }))
  }

  return NextResponse.json({
    success: true,
    stock_id: stockId,
    history,
  })
}
