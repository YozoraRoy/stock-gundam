import { NextResponse } from 'next/server'
import { dbQueryAll, dbQueryFirst, ensureSeedData, hasDb } from '@stock/database'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const stockId = searchParams.get('stock_id')
  const date = searchParams.get('date')

  if (!hasDb()) {
    return NextResponse.json({ trades: [], gift: null })
  }

  await ensureSeedData()

  if (stockId) {
    const trades = await dbQueryAll(`
      SELECT date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume
      FROM odd_lot_trades
      WHERE stock_id = @stock_id
      ORDER BY date DESC
      LIMIT 30
    `, { stock_id: stockId })

    const gift = await dbQueryFirst(`
      SELECT stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method,
             gift_status, claim_rule, claim_rule_source, mops_gift_text
      FROM shareholder_gifts
      WHERE stock_id = @stock_id
      ORDER BY meeting_date DESC
      LIMIT 1
    `, { stock_id: stockId })

    return NextResponse.json({ trades, gift: gift ?? null })
  }

  const latestDate = date ?? (await dbQueryFirst<{ date: string }>(
    'SELECT date FROM odd_lot_trades ORDER BY date DESC LIMIT 1',
  ))?.date

  if (!latestDate) {
    return NextResponse.json({ trades: [], latestDate: null })
  }

  const trades = await dbQueryAll(`
    SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume,
           t.bid_price, t.bid_volume, t.ask_price, t.ask_volume,
           g.gift_name, g.meeting_date, g.distribution_method,
           g.last_buy_date, g.gift_status, g.claim_rule, g.claim_rule_source, g.mops_gift_text
    FROM odd_lot_trades t
    LEFT JOIN (
      SELECT stock_id, gift_name, meeting_date, distribution_method, last_buy_date,
             gift_status, claim_rule, claim_rule_source, mops_gift_text,
             ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY meeting_date DESC) AS rn
      FROM shareholder_gifts
    ) g ON g.stock_id = t.stock_id AND g.rn = 1
    WHERE t.date = @date
    ORDER BY t.volume DESC
    LIMIT 1500
  `, { date: latestDate })

  return NextResponse.json({ trades, latestDate })
}
