import { getDb, getAzurePoolPublic } from '../db.js'
import sql from 'mssql'

interface TwseOpenApiOddLotItem {
  Code: string
  Name: string
  TradeVolume: string
  Transaction: string
  TradeValue: string
  TradePrice: string
  BestBidPrice: string
  BestBidVolume: string
  BestAskPrice: string
  BestAskVolume: string
}

const isAzureSql = (process.env.DATABASE_URL?.length ?? 0) > 0

export async function fetchTwseOddLots(date?: string): Promise<number> {
  const targetDate = date || formatDate(new Date())
  return fetchForDate(targetDate)
}

async function fetchForDate(targetDate: string): Promise<number> {
  const url = 'https://openapi.twse.com.tw/v1/exchangeReport/TWT53U'

  // TWSE OpenAPI 偶發空回應/暫時性失敗。重試數次避免「交易日沒抓到資料」。
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      if (!res.ok) throw new Error(`TWSE OpenAPI error: ${res.status}`)

      const items = (await res.json()) as TwseOpenApiOddLotItem[]
      if (!Array.isArray(items) || items.length === 0) {
        if (attempt < maxAttempts) {
          console.warn(`TWSE OpenAPI empty list for ${targetDate}, retry ${attempt}/${maxAttempts}`)
          await sleep(1000 * attempt)
          continue
        }
        console.warn(`TWSE OpenAPI returned empty list for ${targetDate}`)
        return 0
      }

      if (isAzureSql) {
        return insertAzureSql(items, targetDate)
      }
      return insertSqlite(items, targetDate)
    } catch (e) {
      if (attempt < maxAttempts) {
        console.warn(`TWSE OpenAPI error for ${targetDate}, retry ${attempt}/${maxAttempts}:`, (e as Error).message)
        await sleep(1000 * attempt)
        continue
      }
      throw e
    }
  }
  return 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function insertSqlite(items: TwseOpenApiOddLotItem[], targetDate: string): number {
  const db = getDb()
  if (!db) return 0

  const insert = db.prepare(`
    INSERT OR REPLACE INTO odd_lot_trades (date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
    VALUES (@date, @stock_id, @stock_name, @price, @volume, @bid_price, @bid_volume, @ask_price, @ask_volume)
  `)

  const transaction = db.transaction(() => {
    let count = 0
    for (const item of items) {
      const stockId = item.Code?.trim()
      if (!stockId) continue

      insert.run({
        date: targetDate,
        stock_id: stockId,
        stock_name: item.Name?.trim() || stockId,
        price: parseNum(item.TradePrice),
        volume: parseInt(String(item.TradeVolume ?? '0').replace(/,/g, ''), 10) || 0,
        bid_price: parseNum(item.BestBidPrice),
        bid_volume: parseInt(String(item.BestBidVolume ?? '0').replace(/,/g, ''), 10) || 0,
        ask_price: parseNum(item.BestAskPrice),
        ask_volume: parseInt(String(item.BestAskVolume ?? '0').replace(/,/g, ''), 10) || 0,
      })
      count++
    }
    return count
  })

  const count = transaction()
  console.log(`TWSE OpenAPI odd lots ${targetDate}: ${count} rows inserted (SQLite)`)
  return count
}

async function insertAzureSql(items: TwseOpenApiOddLotItem[], targetDate: string): Promise<number> {
  const pool = await getAzurePoolPublic()
  if (!pool) return 0

  const batchSize = 200
  let total = 0

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const req = pool.request()
    const values: string[] = []

    batch.forEach((item, idx) => {
      const stockId = item.Code?.trim()
      if (!stockId) return
      const p = `p${idx}`
      values.push(`(@${p}_date, @${p}_sid, @${p}_sname, @${p}_price, @${p}_vol, @${p}_bp, @${p}_bv, @${p}_ap, @${p}_av)`)
      req.input(`${p}_date`, sql.NVarChar(20), targetDate)
      req.input(`${p}_sid`, sql.NVarChar(20), stockId)
      req.input(`${p}_sname`, sql.NVarChar(100), item.Name?.trim() || stockId)
      req.input(`${p}_price`, sql.Float, parseNum(item.TradePrice))
      req.input(`${p}_vol`, sql.Int, parseInt(String(item.TradeVolume ?? '0').replace(/,/g, ''), 10) || 0)
      req.input(`${p}_bp`, sql.Float, parseNum(item.BestBidPrice))
      req.input(`${p}_bv`, sql.Int, parseInt(String(item.BestBidVolume ?? '0').replace(/,/g, ''), 10) || 0)
      req.input(`${p}_ap`, sql.Float, parseNum(item.BestAskPrice))
      req.input(`${p}_av`, sql.Int, parseInt(String(item.BestAskVolume ?? '0').replace(/,/g, ''), 10) || 0)
    })

    if (values.length === 0) continue

    await req.query(`
      MERGE INTO odd_lot_trades AS t
      USING (VALUES ${values.join(',')}) AS s(date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
      ON t.date = s.date AND t.stock_id = s.stock_id
      WHEN MATCHED THEN UPDATE SET
        stock_name = s.stock_name, price = s.price, volume = s.volume,
        bid_price = s.bid_price, bid_volume = s.bid_volume,
        ask_price = s.ask_price, ask_volume = s.ask_volume
      WHEN NOT MATCHED THEN INSERT (date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
        VALUES (s.date, s.stock_id, s.stock_name, s.price, s.volume, s.bid_price, s.bid_volume, s.ask_price, s.ask_volume);
    `)
    total += values.length
  }

  console.log(`TWSE OpenAPI odd lots ${targetDate}: ${total} rows upserted (AzureSQL)`)
  return total
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = String(val).replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
