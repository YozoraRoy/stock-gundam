import { getDb } from './db.js'

console.log('==== [指定個股單價精準度驗證流程] ====')

const db = getDb()
if (!db) {
  console.error('❌ 無法開啟 SQLite 資料庫')
  process.exit(1)
}

const targetCodes = [
  { code: '006203', name: '元大MSCI台灣' },
  { code: '2344', name: '華邦電', expectedPrice: 21.00 },
  { code: '6770', name: '力積電', expectedPrice: 25.30 },
  { code: '8039', name: '台虹', expectedPrice: 54.20 }
]

console.log('\n--- 抽驗標的物市場單價結果 ---')

for (const target of targetCodes) {
  const row = db.prepare(`
    SELECT stock_id, stock_name, price, volume, date, bid_price, ask_price
    FROM odd_lot_trades
    WHERE stock_id = ?
    ORDER BY date DESC
    LIMIT 1
  `).get(target.code) as any

  if (row) {
    console.log(`\n股票代碼: ${row.stock_id} (${row.stock_name})`)
    console.log(`  日期: ${row.date}`)
    console.log(`  1股成交價 (price): NT$ ${row.price}`)
    console.log(`  買進/賣出盤口: $${row.bid_price} / $${row.ask_price}`)
    console.log(`  零股成交量 (volume): ${row.volume}`)
    
    if (target.expectedPrice !== undefined) {
      if (row.price === target.expectedPrice) {
        console.log(`  ✅ 價格完全相符預期精準單價 ($${target.expectedPrice})`)
      } else {
        console.log(`  ⚠️ 價格為 $${row.price}，預期單價為 $${target.expectedPrice}`)
      }
    } else {
      console.log(`  ✅ 價格核對成功: $${row.price}`)
    }
  } else {
    console.log(`\n❌ 未能在資料庫中找到股票 ${target.code} (${target.name})`)
  }
}
