import { getDb } from '../db.js'

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

export async function fetchTwseOddLots(date?: string): Promise<number> {
  const targetDate = date || formatDate(new Date())
  return fetchForDate(targetDate)
}

async function fetchForDate(targetDate: string): Promise<number> {
  // TWSE 官方 OpenAPI 盤後零股交易行情 API
  const url = `https://openapi.twse.com.tw/v1/exchangeReport/TWT53U`

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  })
  if (!res.ok) throw new Error(`TWSE OpenAPI error: ${res.status}`)

  const items = (await res.json()) as TwseOpenApiOddLotItem[]
  if (!Array.isArray(items) || items.length === 0) {
    console.warn(`TWSE OpenAPI returned empty list for ${targetDate}`)
    return 0
  }

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

      const unitPrice = parseNum(item.TradePrice)
      const volume = parseInt(String(item.TradeVolume ?? '0').replace(/,/g, ''), 10) || 0
      const bidPrice = parseNum(item.BestBidPrice)
      const bidVolume = parseInt(String(item.BestBidVolume ?? '0').replace(/,/g, ''), 10) || 0
      const askPrice = parseNum(item.BestAskPrice)
      const askVolume = parseInt(String(item.BestAskVolume ?? '0').replace(/,/g, ''), 10) || 0

      insert.run({
        date: targetDate,
        stock_id: stockId,
        stock_name: item.Name?.trim() || stockId,
        price: unitPrice,
        volume: volume,
        bid_price: bidPrice,
        bid_volume: bidVolume,
        ask_price: askPrice,
        ask_volume: askVolume,
      })
      count++
    }
    return count
  })

  const count = transaction()
  console.log(`TWSE OpenAPI odd lots ${targetDate}: ${count} rows inserted`)
  return count
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = String(val).replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}
