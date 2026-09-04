import { dbExecute, dbQueryAll, migrate } from './db.js'
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

// 以「日期 + 內容」二維交叉驗證單一列。
function validateGift(
  row: GiftRow,
  twseDates: string[],
): ValidateResult {
  const giftName = row.gift_name?.trim()
  const hasGiftName = Boolean(giftName && giftName !== '-' && giftName !== 'null')
  const mopsNoGift = row.mops_gift_text?.includes('未發放紀念品') ?? false
  const twseDate = twseDates.length > 0 ? twseDates[0] : null
  const dateConfirmed =
    (row.meeting_date && twseDate && row.meeting_date === twseDate) ||
    (row.meeting_date && row.mops_meeting_date && row.meeting_date === row.mops_meeting_date)

  // 內容驗證：MOPS 明說未發放紀念品，但 stock.gift 卻有贈品名 → 衝突
  if (mopsNoGift) {
    if (hasGiftName) {
      return { status: 'GIFT_CONFLICT', reason: 'MOPS 公告未發放紀念品，但 stock.gift 標示有贈品', twseDate }
    }
    return { status: 'NO_GIFT', reason: 'MOPS 公告確認未發放紀念品', twseDate }
  }

  // 日期衝突：stock.gift 日期與 TWSE 官方日期不符
  if (twseDate && row.meeting_date && row.meeting_date !== twseDate) {
    return { status: 'DATE_MISMATCH', reason: `stock.gift 日期 ${row.meeting_date} 與 TWSE 官方 ${twseDate} 不符`, twseDate }
  }

  // 有贈品名，且官方日期吻合（或無官方可比對）
  if (hasGiftName) {
    if (dateConfirmed) {
      return { status: 'OK', reason: '官方日期與贈品內容皆符合', twseDate }
    }
    return { status: 'OK', reason: '贈品內容正常；官方日期無差異可比對', twseDate }
  }

  // 只在有官方日期時可判定「未驗證」，否則 UNVERIFIED
  return { status: 'UNVERIFIED', reason: '無贈品資訊且無官方可比對資料', twseDate }
}

async function main() {
  await migrate()
  console.log('[sync:validate-gifts] Fetching TWSE official meetings...')
  const twseMap = await fetchTwseMeetings()
  console.log(`[sync:validate-gifts] TWSE meetings for ${Object.keys(twseMap).length} companies`)

  const rows = await dbQueryAll<GiftRow>(
    `SELECT id, stock_id, meeting_date, last_buy_date, gift_name, claim_rule,
            mops_gift_text, mops_meeting_date, twse_meeting_date
       FROM shareholder_gifts`,
  )
  console.log(`[sync:validate-gifts] Validating ${rows.length} gift rows...`)

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
      console.log(`[sync:validate-gifts] progress ${done}/${rows.length} ${JSON.stringify(counts)}`)
    }
  }

  console.log(`[sync:validate-gifts] done. summary=${JSON.stringify(counts)}`)
  process.exit(0)
}

main().catch(e => {
  console.error('[sync:validate-gifts] fatal:', e)
  process.exit(1)
})