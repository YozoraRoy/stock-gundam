import { migrate } from '../src/db.js'
import { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'

migrate()
fetchTwseOddLots().catch(console.error)
