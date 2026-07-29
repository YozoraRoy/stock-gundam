export {
  getDb, hasDb, migrate, closeDb,
  dbQueryAll, dbQueryFirst, dbExecute, dbExecRaw,
  saveAnalysisRecord, getAnalysisRecords, getAnalysisRecordById,
  getHistoricalGifts, ensureSeedData,
} from './db.js'
export type { AnalysisRecord, HistoricalGift } from './db.js'
export type { Database } from 'better-sqlite3'
export { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'
export { fetchStockGift } from './fetchers/stock-gift.js'

