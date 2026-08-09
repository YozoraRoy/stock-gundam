export {
  getDb, hasDb, migrate, closeDb,
  dbQueryAll, dbQueryFirst, dbExecute, dbExecRaw,
  saveAnalysisRecord, getAnalysisRecords, getAnalysisRecordById,
  getHistoricalGifts, ensureSeedData,
  getUserById, findOrCreateUser, getUsageCount, consumeAnalysisQuota,
} from './db.js'
export type { AnalysisRecord, HistoricalGift, UserRow, AuthProvider, IdentityInput, QuotaResult } from './db.js'
export type { Database } from 'better-sqlite3'
export { fetchTwseOddLots } from './fetchers/twse-odd-lot.js'
export { fetchStockGift, fetchStockGiftRows } from './fetchers/stock-gift.js'
export type { GiftRow } from './fetchers/stock-gift.js'
export {
  fetchMopsMeetings,
  fetchMopsAnnouncementText,
  classifyClaimRule,
  rocToMonthDay,
  extractGiftEvidence,
} from './fetchers/mops.js'
export type { MopsMeeting, ClaimRule, ClaimResult } from './fetchers/mops.js'

