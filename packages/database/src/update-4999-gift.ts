import { getDb } from './db.js'

const db = getDb()
if (db) {
  db.prepare("DELETE FROM shareholder_gifts WHERE stock_id = '4999'").run()

  db.prepare(`
    INSERT INTO shareholder_gifts (stock_id, stock_name, gift_name, last_buy_date, distribution_method)
    VALUES ('4999', '鑫禾', '超商咖啡兌換券 (電子商品卡)', '04/22', '領取日期')
  `).run()

  console.log('[Update Gift] Successfully updated stock 4999 (鑫禾) gift_name to 超商咖啡兌換券 (電子商品卡)')
}
