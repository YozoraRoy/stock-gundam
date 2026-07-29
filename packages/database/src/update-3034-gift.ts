import { getDb } from './db.js'

const db = getDb()
if (db) {
  db.prepare("DELETE FROM shareholder_gifts WHERE stock_id = '3034'").run()

  db.prepare(`
    INSERT INTO shareholder_gifts (stock_id, stock_name, gift_name, last_buy_date, distribution_method)
    VALUES ('3034', '聯詠', '50元超商商品卡 (7-11/全家)', '03/26', '領取日期')
  `).run()

  console.log('[Update Gift] Successfully updated stock 3034 (聯詠) gift_name to 50元超商商品卡 (7-11/全家)')
}
