import { getDb } from './db.js'

const db = getDb()
if (db) {
  db.prepare(`
    INSERT OR REPLACE INTO shareholder_gifts (stock_id, stock_name, gift_name, last_buy_date, distribution_method)
    VALUES ('2340', '台亞', '50元超商商品卡（7-11商品卡）', '04/22', '領取日期')
  `).run()

  console.log('[Update Gift] Successfully updated stock 2340 (台亞) gift_name to 50元超商商品卡（7-11商品卡）')
}
