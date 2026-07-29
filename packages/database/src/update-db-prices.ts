import { getDb } from './db.js'
import { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'

async function run() {
  console.log('[Update DB] Fetching fresh odd lots from TWSE OpenAPI...')
  const count = await fetchTwseOddLots()
  console.log(`[Update DB] Fetched and updated ${count} rows from TWSE OpenAPI`)

  const db = getDb()
  if (db) {
    // 刪除舊過期的測試資料列，讓資料庫保持最新TWSE真實行情
    const latestDateObj = db.prepare('SELECT date FROM odd_lot_trades ORDER BY date DESC LIMIT 1').get() as { date: string } | undefined
    if (latestDateObj) {
      db.prepare('DELETE FROM odd_lot_trades WHERE date < ?').run(latestDateObj.date)
      console.log(`[Update DB] Cleaned up obsolete data before date ${latestDateObj.date}`)
    }

    const check2409 = db.prepare(`
      SELECT date, stock_id, stock_name, price, volume
      FROM odd_lot_trades
      WHERE stock_id = '2409'
      ORDER BY date DESC
    `).all()

    console.log('[Update DB] 清理後 2409 (友達) 資料庫資料:', JSON.stringify(check2409, null, 2))
  }
}

run().catch(console.error)
