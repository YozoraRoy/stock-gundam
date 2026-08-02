import { migrate } from './db.js'
import { fetchStockGift } from './fetchers/stock-gift.js'

await migrate()
const count = await fetchStockGift()
console.log(`[sync:stockgift] done, ${count} gifts upserted`)
