import { getDb } from './db.js'

const db = getDb()
if (db) {
  db.prepare(`
    UPDATE odd_lot_trades
    SET price = 34.15, volume = 19443, bid_price = 34.15, bid_volume = 8943, ask_price = 34.20, ask_volume = 6092
    WHERE stock_id = '2887'
  `).run()

  db.prepare(`
    INSERT OR REPLACE INTO shareholder_gifts (stock_id, stock_name, gift_name, last_buy_date, distribution_method)
    VALUES ('2887', '台新新光金', '多用途矽膠隔熱餐墊(二入)', '08/14', '領取日期')
  `).run()

  console.log('[Update DB] Successfully updated stock 2887 (台新新光金) price = 34.15, volume = 19443 (Total = 66.4萬)')
}
