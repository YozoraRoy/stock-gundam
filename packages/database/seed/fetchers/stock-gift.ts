import { chromium } from 'playwright'
import { getDb } from '../../src/db.js'

interface GiftRow {
  stock_id: string
  stock_name: string
  meeting_date: string
  last_buy_date: string
  gift_name: string
  status: string
}

export async function fetchStockGift(): Promise<number> {
  const urls = [
    'https://stock.gift/list?pred=high&no_id=1&no_copy=1&max=2000',
    'https://stock.gift/list?pred=mid&no_id=1&no_copy=1&max=2000',
    'https://stock.gift/list?pred=low&no_id=1&no_copy=1&max=2000',
  ]

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    viewport: { width: 1920, height: 1080 },
  })

  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO shareholder_gifts
      (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
    VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
  `)

  let total = 0
  const seen = new Set<string>()

  for (const url of urls) {
    try {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      const bodyText = await page.evaluate(() => document.body.innerText)
      const rows = parseText(bodyText)

      for (const row of rows) {
        const key = `${row.stock_id}|${row.meeting_date}`
        if (seen.has(key)) continue
        seen.add(key)

        insert.run({
          stock_id: row.stock_id,
          stock_name: row.stock_name,
          meeting_date: row.meeting_date,
          last_buy_date: row.last_buy_date,
          gift_name: row.gift_name,
          distribution_method: row.status,
          distribution_location: '',
          source_url: url,
        })
        total++
      }

      console.log(`stock.gift (${url.split('pred=')[1]?.split('&')[0] ?? '?'}): ${rows.length} rows`)
      await page.close()
    } catch (err) {
      console.warn(`stock.gift failed for ${url}:`, err)
    }
  }

  await browser.close()
  console.log(`stock.gift total: ${total} unique gifts inserted`)
  return total
}

function parseText(text: string): GiftRow[] {
  const rows: GiftRow[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Each stock entry starts with a 4-digit stock_id on its own line.
  // Group lines that belong to each entry.
  const entries: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (/^\d{4}$/.test(line)) {
      if (current.length > 0) {
        entries.push(current)
      }
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) entries.push(current)

  for (const entry of entries) {
    const stockId = entry[0]
    if (entry.length < 3) continue

    // entry[1] is stock_name
    const stockName = entry[1]

    // Find price (a decimal number)
    const priceIdx = entry.findIndex(l => /^\d+\.?\d*$/.test(l) || l.startsWith('$'))
    if (priceIdx === -1) continue

    // After price, find status
    const afterPrice = entry.slice(priceIdx + 1)
    const statusIdxInSlice = afterPrice.findIndex(l =>
      l.startsWith('領取日期') || l.startsWith('結束') || l.startsWith('等待')
    )
    if (statusIdxInSlice === -1) continue
    const status = afterPrice[statusIdxInSlice]
    const afterStatus = afterPrice.slice(statusIdxInSlice + 1)

    let meetingDate = ''
    let lastBuyDate = ''
    let giftName = '-'

    if (status.startsWith('領取日期')) {
      // Next two lines: meeting_date and last_buy_date (MM.DD format)
      // Could be on the same line separated by spaces, or on separate lines
      const dateLines = afterStatus.filter(l => /^\d{2}\.\d{2}$/.test(l))
      if (dateLines.length >= 1) meetingDate = dateLines[0].replace('.', '/')
      if (dateLines.length >= 2) lastBuyDate = dateLines[1].replace('.', '/')

      // Collect gift lines (lines with content, excluding update time like "X天前")
      const giftLines = afterStatus.filter(l =>
        !/^\d{2}\.\d{2}$/.test(l) &&
        !/^\d+天前$/.test(l) &&
        l.length > 0
      )
      giftName = giftLines[0] ?? '-'
    } else if (status.startsWith('等待')) {
      meetingDate = status
      giftName = '待公告'
    } else if (status === '結束') {
      meetingDate = '已結束'
      giftName = '-'
    }

    rows.push({
      stock_id: stockId,
      stock_name: stockName,
      meeting_date: meetingDate,
      last_buy_date: lastBuyDate,
      gift_name: giftName,
      status,
    })
  }

  return rows
}
