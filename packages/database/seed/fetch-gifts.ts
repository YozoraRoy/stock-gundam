import { migrate } from '../src/db.js'
import { fetchStockGift } from './fetchers/stock-gift.js'

migrate()
fetchStockGift().catch(console.error)
