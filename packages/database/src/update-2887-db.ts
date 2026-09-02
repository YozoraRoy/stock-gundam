import { getDb } from './db.js'

// 注意：過去此腳本會把 2887 (台新金) 的價格/成交量「硬塞」成固定值 (34.15 / 19443 ...)，
// 造成該股資料停滯在假值、與 TWSE 官方盤後行情脫節。
// 現已改為唯讀診斷：2887 的盤後零股資料應一律來自 TWSE 官方 TWT53U 的每日抓取。
const db = getDb()
if (db) {
  const row = db
    .prepare(`SELECT date, stock_id, stock_name, price, volume, bid_price, ask_price FROM odd_lot_trades WHERE stock_id = '2887' ORDER BY date DESC LIMIT 1`)
    .get() as any
  if (row) {
    console.log(`[Diagnose] 2887 ${row.stock_name} 最新零股資料: date=${row.date} price=${row.price} volume=${row.volume} bid=${row.bid_price} ask=${row.ask_price}`)
    console.log('[Diagnose] 本腳本為唯讀，未修改任何資料。如價量明顯異於 TWSE 官方盤後行情，請執行 fetchTwseOddLots 重新抓取。')
  } else {
    console.log('[Diagnose] 未找到 2887 資料。')
  }
}