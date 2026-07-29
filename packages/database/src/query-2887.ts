import { getDb } from './db.js'

const db = getDb()
if (db) {
  const row = db.prepare(`
    SELECT date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume
    FROM odd_lot_trades
    WHERE stock_id = '2887'
    ORDER BY date DESC
  `).get() as any

  console.log('QUERY_RESULT_2887:', JSON.stringify(row, null, 2))

  const giftRow = db.prepare(`
    SELECT stock_id, stock_name, gift_name, last_buy_date, distribution_method
    FROM shareholder_gifts
    WHERE stock_id = '2887'
  `).get() as any

  console.log('QUERY_RESULT_2887_GIFT:', JSON.stringify(giftRow, null, 2))
} else {
  console.error('Failed to get database connection')
}
