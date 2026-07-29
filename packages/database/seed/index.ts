import { migrate } from '../src/db.js'
import { fetchTwseOddLots } from '../src/fetchers/twse-odd-lot.js'
import { fetchStockGift } from '../src/fetchers/stock-gift.js'
import { fetchMopsGifts } from './fetchers/mops-gifts.js'

async function main() {
  migrate()
  console.log('--- Seeding TWSE odd lots ---')
  await fetchTwseOddLots()

  console.log('\n--- Seeding shareholder gifts (stock.gift) ---')
  await fetchStockGift()

  console.log('\nSeed completed')
}

main().catch(console.error)
