import { getDb } from '../../src/db.js'

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

export async function fetchTwseOddLots(date?: string) {
  const targetDate = date ?? formatDate(new Date())

  // TWSE 官方 OpenAPI 盤後零股交易行情 API (TWT53U)
  const url = `https://openapi.twse.com.tw/v1/exchangeReport/TWT53U`

  // TWSE OpenAPI 偶發空回應/暫時性失敗。重試數次避免「交易日沒抓到資料」。
  const maxAttempts = 3
  let items: TwseOpenApiOddLotItem[] = []
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      if (!res.ok) throw new Error(`TWSE OpenAPI error: ${res.status}`)

      const json = (await res.json()) as TwseOpenApiOddLotItem[]
      if (Array.isArray(json) && json.length > 0) {
        items = json
        break
      }
      console.warn(`TWSE OpenAPI empty list for ${targetDate}; retry ${attempt}/${maxAttempts}`)
    } catch (e) {
      console.warn(`TWSE OpenAPI error for ${targetDate}; retry ${attempt}/${maxAttempts}:`, (e as Error).message)
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000 * attempt))
  }

  if (items.length === 0) {
    console.warn(`TWSE OpenAPI returned empty list for ${targetDate}`)
    return 0
  }

  const db = getDb()
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
  console.log(`TWSE odd lots ${targetDate}: ${count} rows inserted`)
  return count
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
