import { getDb } from './db.js'

const db = getDb()
if (db) {
  // 先清理 2340 舊資料
  db.prepare("DELETE FROM shareholder_gifts WHERE stock_id = '2340'").run()

  // 寫入確鑿修正
  db.prepare(`
    INSERT INTO shareholder_gifts (stock_id, stock_name, gift_name, last_buy_date, distribution_method)
    VALUES ('2340', '台亞', '50元超商商品卡（7-11商品卡）', '04/22', '領取日期')
  `).run()

  console.log('✅ SQLite shareholder_gifts 已成功將 2340 (台亞) 更正為 50元超商商品卡（7-11商品卡）！')
}
