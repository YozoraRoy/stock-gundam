import { dbQueryAll, dbQueryFirst, ensureSeedData, hasDb } from '@stock/database'
import { OddLotView, type OddLotItem } from '@/components/odd-lot-view'
import { Gift, Sparkles, TrendingUp } from 'lucide-react'

import SEEDED_ODD_LOTS from '@/data/seeded-odd-lots.json'

const FALLBACK_ODD_LOTS: OddLotItem[] = SEEDED_ODD_LOTS as OddLotItem[]

import {
  formatTradingDayWithWeekday,
  isCurrentlyHolidayOrWeekend,
} from '@/utils/taiwan-calendar'

export default async function OddLotPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stock_id?: string }>
}) {
  const params = await searchParams
  try {
    await ensureSeedData()
  } catch (e) {
    console.error('[OddLotPage] ensureSeedData failed:', e)
  }

  let trades: OddLotItem[] = []
  let latestDateStr = ''

  if (hasDb()) {
    try {
      const latestDate = await dbQueryFirst<{ date: string }>(
        'SELECT date FROM odd_lot_trades ORDER BY date DESC LIMIT 1',
      )

      if (latestDate) {
        latestDateStr = latestDate.date

        if (params.stock_id) {
          const sid = params.stock_id.toUpperCase()
          trades = await dbQueryAll<OddLotItem>(
            `
            SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume, t.bid_price, t.bid_volume, t.ask_price, t.ask_volume,
                   g.gift_name, g.meeting_date, g.last_buy_date, g.distribution_method
            FROM odd_lot_trades t
            LEFT JOIN (
              SELECT stock_id, gift_name, meeting_date, last_buy_date, distribution_method
              FROM shareholder_gifts
              GROUP BY stock_id
            ) g ON g.stock_id = t.stock_id
            WHERE t.stock_id = @stock_id
            ORDER BY t.date DESC
            LIMIT 30
          `,
            { stock_id: sid },
          )
        } else {
          trades = await dbQueryAll<OddLotItem>(
            `
            SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume, t.bid_price, t.bid_volume, t.ask_price, t.ask_volume,
                   g.gift_name, g.meeting_date, g.last_buy_date, g.distribution_method
            FROM odd_lot_trades t
            LEFT JOIN (
              SELECT stock_id, gift_name, meeting_date, last_buy_date, distribution_method
              FROM shareholder_gifts
              GROUP BY stock_id
            ) g ON g.stock_id = t.stock_id
            WHERE t.date = @date
            ORDER BY t.volume DESC
            LIMIT 1500
          `,
            { date: latestDateStr },
          )
        }
      }
    } catch (e) {
      console.error('[OddLotPage] Failed to query database:', e)
    }
  }

  const displayItems = trades.length > 0 ? trades : FALLBACK_ODD_LOTS
  if (!latestDateStr && displayItems.length > 0) {
    latestDateStr = displayItems[0].date
  }

  const holidayInfo = isCurrentlyHolidayOrWeekend()
  const formattedLatestDate = formatTradingDayWithWeekday(latestDateStr)

  return (
    <div className="w-full min-h-screen px-4 md:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <TrendingUp className="w-6 h-6 text-[var(--accent)]" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">台灣零股行情與股東會紀念品情報</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            即時整合 TWSE 盤後零股交易數據與股東會紀念品領取最後期限
            {latestDateStr && (
              <span className="ml-2 font-medium text-[var(--accent)]">
                · 最新開盤數據：{formattedLatestDate}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {holidayInfo.isHoliday && (
            <div className="bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs text-amber-300">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                目前逢【{holidayInfo.reason}】，已自動顯示最新開市上班日價位
              </span>
            </div>
          )}
          <div className="bg-[var(--bg-card)] border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-xs">
            <Gift className="w-4 h-4 text-[var(--accent-green)]" />
            <span>內建紀念品自動分類與篩選</span>
          </div>
        </div>
      </div>

      <OddLotView
        initialItems={displayItems}
        latestDate={latestDateStr}
        initialQuery={params.stock_id ?? params.q ?? ''}
      />
    </div>
  )
}
