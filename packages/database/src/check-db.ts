import { getDb } from './db.js'

const db = getDb()
if (db) {
  const rows = db.prepare(`
    SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume, g.gift_name
    FROM odd_lot_trades t
    LEFT JOIN shareholder_gifts g ON g.stock_id = t.stock_id
    WHERE t.stock_id = '2409' OR t.stock_name LIKE '%友達%'
    ORDER BY t.date DESC
  `).all()

  console.log('Query Result for 2409 (友達):', JSON.stringify(rows, null, 2))

  const sampleRows = db.prepare(`
    SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume
    FROM odd_lot_trades t
    ORDER BY t.date DESC
    LIMIT 10
  `).all()

  console.log('Sample latest 10 rows in DB:', JSON.stringify(sampleRows, null, 2))
}
