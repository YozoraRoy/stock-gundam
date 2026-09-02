import { getDb } from './db.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEEDED_JSON_PATH = join(__dirname, '../../../apps/web/src/data/seeded-odd-lots.json')

// 注意：本腳本只負責「診斷 / 回報」資料異常，不再以硬編碼常數覆寫真實成交價。
// 過去這裡會用 KNOWN_STOCK_PRICES 等常數把 price 直接塞值，造成上千檔價格被假資料污染。
// 正確做法是直接以 TWSE 官方 TWT53U 的 TradePrice 為準，交由 fetcher 每日期抓取覆寫。
function isRealisticUnitPrice(price: number | null | undefined): boolean {
  if (price == null || price <= 0) return false
  // 上市公司零股成交價常態應落在 1 ~ 5000 之間（極少數高價股除外）
  return price > 0 && price <= 5000
}

export function auditAndFixAllPrices() {
  console.log('==== [全市場 odd_lot_trades 價格異常掃描（唯讀診斷，不覆寫）] ====')
  const db = getDb()

  let anomalyCount = 0
  let total = 0
  if (db) {
    const allTrades = db.prepare('SELECT id, date, stock_id, stock_name, price, volume FROM odd_lot_trades').all() as any[]
    total = allTrades.length
    for (const trade of allTrades) {
      if (!isRealisticUnitPrice(trade.price)) {
        if (anomalyCount < 50) {
          console.log(`[ANOMALY] ${trade.date} ${trade.stock_id} ${trade.stock_name} price=${trade.price} volume=${trade.volume}`)
        }
        anomalyCount++
      }
    }
    console.log(`[Audit] 掃描 ${total} 筆，異常(price 未落在合理區間) ${anomalyCount} 筆`)
    console.log('[Audit] 本腳本為唯讀，未修改任何資料。請以 TWT53U 官方 API 重新抓取修正。')
  }

  // 同步診斷 fallback JSON（唯讀）
  try {
    const rawJson = readFileSync(SEEDED_JSON_PATH, 'utf-8')
    const jsonItems = JSON.parse(rawJson) as any[]
    let bad = 0
    for (const item of jsonItems) {
      if (!isRealisticUnitPrice(item.price)) bad++
    }
    console.log(`[JSON Audit] seeded-odd-lots.json 共 ${jsonItems.length} 筆，異常價格 ${bad} 筆`)
  } catch (err) {
    console.warn('[JSON Audit] Failed to read JSON:', err)
  }
}

auditAndFixAllPrices()