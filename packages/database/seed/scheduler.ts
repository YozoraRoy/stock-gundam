import cron from 'node-cron'
import { migrate } from '../src/db.js'
import { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'
import { fetchStockGift } from './fetchers/stock-gift.js'

export function startScheduler() {
  // TWSE odd lots: weekday 15:00
  cron.schedule('0 15 * * 1-5', async () => {
    console.log('[Scheduler] Fetching TWSE odd lots...')
    try {
      await fetchTwseOddLots()
    } catch (err) {
      console.error('[Scheduler] TWSE fetch failed:', err)
    }
  })

  // Shareholder gifts: daily 16:00 (via stock.gift)
  cron.schedule('0 16 * * *', async () => {
    console.log('[Scheduler] Fetching shareholder gifts (stock.gift)...')
    try {
      const count = await fetchStockGift()
      console.log(`[Scheduler] stock.gift: ${count} gifts`)
    } catch (err) {
      console.error('[Scheduler] Gift fetch failed:', err)
    }
  })

  console.log('[Scheduler] Started')
  console.log('  TWSE odd lots:   Mon-Fri 15:00')
  console.log('  Gifts:           Daily 16:00 (stock.gift)')
}

// Run directly: npx tsx seed/scheduler.ts
const isMain = process.argv[1]?.endsWith('scheduler.ts')
if (isMain) {
  migrate()
  startScheduler()
}
