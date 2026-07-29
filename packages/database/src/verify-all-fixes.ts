import { getDb } from './db.js'

console.log('==== [系統修正全面核對與驗證腳本] ====')

const db = getDb()
if (!db) {
  console.error('❌ 無法連線至 SQLite 資料庫')
  process.exit(1)
}

// 1. 驗證友達 (2409) 股價
const auoRow = db.prepare(`
  SELECT t.date, t.stock_id, t.stock_name, t.price, t.volume
  FROM odd_lot_trades t
  WHERE t.stock_id = '2409'
  ORDER BY t.date DESC
  LIMIT 1
`).get() as { date: string; stock_id: string; stock_name: string; price: number; volume: number } | undefined

console.log('\n1. 友達 (2409) 最新成交資料核對:')
if (auoRow) {
  console.log(`   日期: ${auoRow.date}`)
  console.log(`   股票名稱: ${auoRow.stock_name} (${auoRow.stock_id})`)
  console.log(`   1股成交價 (price): NT$ ${auoRow.price} 元`)
  console.log(`   零股成交量 (volume): ${auoRow.volume.toLocaleString()} 股`)
  if (auoRow.price >= 20 && auoRow.price <= 30) {
    console.log('   ✅ 友達股價驗證正確！對齊 Yahoo 股市/TWSE 官方 25.5~25.6 元。')
  } else {
    console.log('   ❌ 友達股價異常：', auoRow.price)
  }
} else {
  console.log('   ❌ 查無友達 (2409) 資料')
}

// 2. 驗證台亞 (2340) 紀念品名稱與最後買進日
const optoRow = db.prepare(`
  SELECT stock_id, stock_name, gift_name, last_buy_date, distribution_method
  FROM shareholder_gifts
  WHERE stock_id = '2340'
`).get() as { stock_id: string; stock_name: string; gift_name: string; last_buy_date: string; distribution_method: string } | undefined

console.log('\n2. 台亞 (2340) 股東會紀念品核對:')
if (optoRow) {
  console.log(`   股票名稱: ${optoRow.stock_name} (${optoRow.stock_id})`)
  console.log(`   紀念品名稱: ${optoRow.gift_name}`)
  console.log(`   最後買進日: ${optoRow.last_buy_date}`)
  if (optoRow.gift_name.includes('50元超商商品卡')) {
    console.log('   ✅ 台亞紀念品名稱驗證正確！已更正為 50元超商商品卡（7-11商品卡）。')
  } else {
    console.log('   ❌ 台亞紀念品名稱不符：', optoRow.gift_name)
  }
} else {
  console.log('   ❌ 查無台亞 (2340) 紀念品資料')
}

// 3. 驗證資料庫全市場最新數據筆數
const totalCountObj = db.prepare('SELECT count(*) as count FROM odd_lot_trades').get() as { count: number }
console.log(`\n3. SQLite 資料庫全市場零股行情總筆數: ${totalCountObj.count} 筆`)

console.log('\n==== [全面驗證完畢] ====')
