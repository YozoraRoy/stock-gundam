import { chromium, type Page } from 'playwright'
import { getDb } from '../../src/db.js'

interface GiftInfo {
  stock_id: string
  stock_name: string
  meeting_date: string
  gift_name: string
}

/**
 * MOPS 備援查詢 — 透過舊版非 SPA 表單查詢個股股東會紀念品
 *
 * MOPS 查詢流程為兩層 AJAX:
 *   1. /mops/web/ajax_t108sb16_q1 → 搜尋公司股東會公告列表
 *   2. 點選「詳細資料」→ 進入公告內頁（含 紀念品 欄位）
 *
 * 因須逐檔查詢且每檔 2 次 AJAX，不適合大量批次使用。
 * 此模組保留供手動補查特定股票。
 */
export async function fetchMopsGifts(stockIds?: string[]): Promise<number> {
  if (!stockIds || stockIds.length === 0) return 0

  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO shareholder_gifts
      (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
    VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
  `)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  })

  const page = await context.newPage()
  let total = 0

  for (let i = 0; i < stockIds.length; i++) {
    try {
      const gift = await queryStockGift(page, stockIds[i])
      if (!gift || !gift.gift_name || gift.gift_name === '-') continue

      insert.run({
        stock_id: gift.stock_id,
        stock_name: gift.stock_name,
        meeting_date: gift.meeting_date,
        last_buy_date: '',
        gift_name: gift.gift_name,
        distribution_method: '領取日期',
        distribution_location: '',
        source_url: 'https://mopsov.twse.com.tw/mops/web/t108sb16_q1',
      })
      total++
    } catch {
      // individual stock failure, skip
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  MOPS: ${i + 1}/${stockIds.length}, found: ${total}`)
    }
  }

  await browser.close()
  console.log(`MOPS: ${total} gifts`)
  return total
}

async function queryStockGift(page: Page, stockId: string): Promise<GiftInfo | null> {
  await page.goto('https://mopsov.twse.com.tw/mops/web/t108sb16_q1', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  })
  await page.waitForSelector('#co_id', { timeout: 5000 })
  await page.fill('#co_id', stockId)
  await page.selectOption('#isnew', 'true')
  await page.click('input[value=" 查詢 "]')
  await page.waitForTimeout(3000)

  // Find the "詳細資料" button for the latest meeting
  const detailButtons = page.locator('input[value="詳細資料"]')
  const count = await detailButtons.count()
  if (count === 0) return null

  // Click the first (most recent) 詳細資料 button
  await detailButtons.first().click()
  await page.waitForTimeout(2000)

  // Get the rendered detail page content
  const html = await page.evaluate(() => {
    const el = document.getElementById('table01') || document.getElementById('div01')
    return el?.innerHTML ?? ''
  })

  return parseDetailPage(html, stockId)
}

function parseDetailPage(html: string, stockId: string): GiftInfo | null {
  const nameMatch = html.match(/公司名稱[：:]\s*([^<>\n]+?)(?:<|br|\n|$)/)
  const stockName = nameMatch?.[1]?.trim() ?? stockId

  let giftName = '-'
  const patterns = [
    /紀念品[：:]\s*([^<>\n]+?)(?:<|br|\n|$)/,
    /<td[^>]*>\s*紀念品\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/,
    /<th[^>]*>\s*紀念品\s*<\/th>\s*<td[^>]*>([^<]+)<\/td>/,
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m) { giftName = m[1].trim(); break }
  }

  if (giftName === '-' || giftName === '') return null

  let meetingDate = ''
  const dateMatch = html.match(/(\d{3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (dateMatch) {
    meetingDate = `${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`
  }

  return { stock_id: stockId, stock_name: stockName, meeting_date: meetingDate, gift_name: giftName }
}
