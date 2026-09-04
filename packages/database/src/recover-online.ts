// 一次性線上資料收復腳本：清空交易/贈品兩表後，重抓一份乾淨資料並補 trace 欄。
// 僅作為 recovery 使用，非例行流程。
//
// 用法：DATABASE_URL=... npm run recover-online --workspace=packages/database
// 步驟：
//   1. DELETE FROM odd_lot_trades / shareholder_gifts（清空）
//   2. migrate()（確保 migration 005 與 trace 欄位在位）
//   3. fetchTwseOddLots()（TWSE 只回最近交易日盤後資料）
//   4. fetchStockGift()（重抓全量贈品）
//   5. 對每列更新 trace 欄（validation_status / validation_reason / twse_meeting_date）

import { dbExecute, dbQueryAll, migrate } from './db.js'
import { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'
import { fetchStockGift } from './fetchers/stock-gift.js'
import { fetchTwseMeetings } from './fetchers/twse-meetings.js'

interface GiftRow {
  id: number
  stock_id: string
  meeting_date: string | null
  last_buy_date: string | null
  gift_name: string | null
  claim_rule: string | null
  mops_gift_text: string | null
  mops_meeting_date: string | null
  twse_meeting_date: string | null
}

interface ValidateResult {
  status: string
  reason: string
  twseDate: string | null
}

// 以「日期 + 內容」二維交叉驗證單一列（與 sync-validate-gifts 邏輯一致）。
function validateGift(row: GiftRow, twseDates: string[]): ValidateResult {
  const giftName = row.gift_name?.trim()
  const hasGiftName = Boolean(giftName && giftName !== '-' && giftName !== 'null')
  const mopsNoGift = row.mops_gift_text?.includes('未發放紀念品') ?? false
  const twseDate = twseDates.length > 0 ? twseDates[0] : null
  const dateConfirmed =
    (row.meeting_date && twseDate && row.meeting_date === twseDate) ||
    (row.meeting_date && row.mops_meeting_date && row.meeting_date === row.mops_meeting_date)

  if (mopsNoGift) {
    if (hasGiftName) {
      return { status: 'GIFT_CONFLICT', reason: 'MOPS 公告未發放紀念品，但 stock.gift 標示有贈品', twseDate }
    }
    return { status: 'NO_GIFT', reason: 'MOPS 公告確認未發放紀念品', twseDate }
  }

  if (twseDate && row.meeting_date && row.meeting_date !== twseDate) {
    return { status: 'DATE_MISMATCH', reason: `stock.gift 日期 ${row.meeting_date} 與 TWSE 官方 ${twseDate} 不符`, twseDate }
  }

  if (hasGiftName) {
    if (dateConfirmed) {
      return { status: 'OK', reason: '官方日期與贈品內容皆符合', twseDate }
    }
    return { status: 'OK', reason: '贈品內容正常；官方日期無差異可比對', twseDate }
  }

  return { status: 'UNVERIFIED', reason: '無贈品資訊且無官方可比對資料', twseDate }
}

async function main() {
  console.log('[recover-online] Step 1/5: Clearing odd_lot_trades and shareholder_gifts...')
  await dbExecute('DELETE FROM odd_lot_trades')
  await dbExecute('DELETE FROM shareholder_gifts')

  await migrate()
  console.log('[recover-online] Step 2/5: Migration applied')

  console.log('[recover-online] Step 3/5: Fetching TWSE odd lots (latest trading day)...')
  const oddLotCount = await fetchTwseOddLots()
  console.log(`[recover-online] odd lots upserted: ${oddLotCount}`)

  console.log('[recover-online] Step 4/5: Fetching shareholder gifts...')
  const giftCount = await fetchStockGift()
  console.log(`[recover-online] gifts upserted: ${giftCount}`)

  console.log('[recover-online] Step 5/5: Filling validation trace columns...')
  const twseMap = await fetchTwseMeetings()
  console.log(`[recover-online] TWSE meetings for ${Object.keys(twseMap).length} companies`)

  const rows = await dbQueryAll<GiftRow>(
    `SELECT id, stock_id, meeting_date, last_buy_date, gift_name, claim_rule,
            mops_gift_text, mops_meeting_date, twse_meeting_date
       FROM shareholder_gifts`,
  )
  console.log(`[recover-online] Validating ${rows.length} gift rows...`)

  const counts: Record<string, number> = {}
  let done = 0
  for (const row of rows) {
    const twseDates = (twseMap[row.stock_id] ?? []).map(m => m.meetingDateMd)
    const { status, reason, twseDate } = validateGift(row, twseDates)
    await dbExecute(
      `UPDATE shareholder_gifts
         SET validation_status = @s, validation_reason = @r, twse_meeting_date = COALESCE(twse_meeting_date, @td)
       WHERE id = @id`,
      { s: status, r: reason, td: twseDate ?? null, id: row.id },
    )
    counts[status] = (counts[status] || 0) + 1
    done++
    if (done % 500 === 0) {
      console.log(`[recover-online] progress ${done}/${rows.length} ${JSON.stringify(counts)}`)
    }
  }

  console.log(`[recover-online] done. validation summary=${JSON.stringify(counts)}`)
  console.log(`[recover-online] oddLotCount=${oddLotCount} giftCount=${giftCount}`)
  process.exit(0)
}

main().catch(e => {
  console.error('[recover-online] fatal:', e)
  process.exit(1)
})