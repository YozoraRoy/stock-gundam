import { chromium } from 'playwright'
import { getDb, getAzurePoolPublic } from '../db.js'
import sql from 'mssql'

interface GiftRow {
  stock_id: string
  stock_name: string
  meeting_date: string
  last_buy_date: string
  gift_name: string
  status: string
}

const isAzureSql = (process.env.DATABASE_URL?.length ?? 0) > 0

export async function fetchStockGift(): Promise<number> {
  const urls = [
    'https://stock.gift/list?pred=high&no_id=1&no_copy=1&max=2000',
    'https://stock.gift/list?pred=mid&no_id=1&no_copy=1&max=2000',
    'https://stock.gift/list?pred=low&no_id=1&no_copy=1&max=2000',
  ]

  let browser: any = null
  try {
    browser = await chromium.launch({ headless: true })
  } catch (launchErr) {
    console.warn('[stock.gift] Playwright browser unavailable in current environment, skipping headless scraping:', launchErr)
    return 0
  }

  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    viewport: { width: 1920, height: 1080 },
  })

  const allRows: (GiftRow & { source_url: string })[] = []
  const seen = new Set<string>()

  for (const url of urls) {
    try {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)

      const bodyText = (await page.evaluate('document.body.innerText')) as string
      const rows = parseText(bodyText)

      for (const row of rows) {
        const key = `${row.stock_id}|${row.meeting_date}`
        if (seen.has(key)) continue
        seen.add(key)
        allRows.push({ ...row, source_url: url })
      }

      console.log(`stock.gift (${url.split('pred=')[1]?.split('&')[0] ?? '?'}): ${rows.length} rows`)
      await page.close()
    } catch (err) {
      console.warn(`stock.gift failed for ${url}:`, err)
    }
  }

  await browser.close()

  const total = isAzureSql ? await insertGiftsAzureSql(allRows) : insertGiftsSqlite(allRows)
  console.log(`stock.gift total: ${total} unique gifts inserted`)
  return total
}

function insertGiftsSqlite(rows: (GiftRow & { source_url: string })[]): number {
  const db = getDb()
  if (!db) return 0
  const insert = db.prepare(`
    INSERT OR IGNORE INTO shareholder_gifts
      (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
    VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
  `)
  const tx = db.transaction(() => {
    for (const row of rows) {
      insert.run({
        stock_id: row.stock_id,
        stock_name: row.stock_name,
        meeting_date: row.meeting_date,
        last_buy_date: row.last_buy_date,
        gift_name: row.gift_name,
        distribution_method: row.status,
        distribution_location: '',
        source_url: row.source_url,
      })
    }
    return rows.length
  })
  return tx()
}

async function insertGiftsAzureSql(rows: (GiftRow & { source_url: string })[]): Promise<number> {
  const pool = await getAzurePoolPublic()
  if (!pool) return 0
  const batchSize = 200
  let total = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const req = pool.request()
    const values: string[] = []
    batch.forEach((row, idx) => {
      const p = `g${idx}`
      values.push(`(@${p}_sid, @${p}_sname, @${p}_md, @${p}_lbd, @${p}_gn, @${p}_dm, @${p}_dl, @${p}_su)`)
      req.input(`${p}_sid`, sql.NVarChar(20), row.stock_id)
      req.input(`${p}_sname`, sql.NVarChar(100), row.stock_name)
      req.input(`${p}_md`, sql.NVarChar(20), row.meeting_date || null)
      req.input(`${p}_lbd`, sql.NVarChar(20), row.last_buy_date || null)
      req.input(`${p}_gn`, sql.NVarChar(500), row.gift_name)
      req.input(`${p}_dm`, sql.NVarChar(200), row.status || null)
      req.input(`${p}_dl`, sql.NVarChar(500), '')
      req.input(`${p}_su`, sql.NVarChar(1000), row.source_url)
    })
    if (values.length === 0) continue
    await req.query(`
      MERGE INTO shareholder_gifts AS t
      USING (VALUES ${values.join(',')}) AS s(stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
      ON t.stock_id = s.stock_id AND t.meeting_date = s.meeting_date
      WHEN NOT MATCHED THEN INSERT (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
        VALUES (s.stock_id, s.stock_name, s.meeting_date, s.last_buy_date, s.gift_name, s.distribution_method, s.distribution_location, s.source_url);
    `)
    total += values.length
  }
  return total
}

function parseText(text: string): GiftRow[] {
  const rows: GiftRow[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

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

    const stockName = entry[1]
    const priceIdx = entry.findIndex(l => /^\d+\.?\d*$/.test(l) || l.startsWith('$'))
    if (priceIdx === -1) continue

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
      const dateLines = afterStatus.filter(l => /^\d{2}\.\d{2}$/.test(l))
      if (dateLines.length >= 1) meetingDate = dateLines[0].replace('.', '/')
      if (dateLines.length >= 2) lastBuyDate = dateLines[1].replace('.', '/')

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
      gift_name: normalizeGiftName(stockId, giftName),
      status,
    })
  }

  return rows
}

// 特殊已知標的實體/電子禮卡精準對照表
const KNOWN_GIFT_MAP: Record<string, string> = {
  '3034': '50元超商商品卡 (7-11/全家)', // 聯詠
  '2340': '50元超商商品卡（7-11商品卡）', // 台亞
  '4999': '超商咖啡兌換券 (電子商品卡)', // 鑫禾
  '4746': '統一超商 35元商品卡 (7-11提貨卡)', // 台耀
}

export function normalizeGiftName(stockId: string, rawGiftName: string): string {
  if (!rawGiftName || rawGiftName === '-') return '-'

  if (KNOWN_GIFT_MAP[stockId]) {
    return KNOWN_GIFT_MAP[stockId]
  }

  const lower = rawGiftName.trim().toLowerCase()
  if (lower === 'egift' || lower === 'e-gift' || lower === '電子禮卡') {
    return '50元超商電子商品卡 (7-11/全家)'
  }

  return rawGiftName
}
