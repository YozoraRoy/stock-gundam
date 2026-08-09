import { dbQueryAll, dbExecute } from './db.js'

// ─── Sync design ─────────────────────────────────────────────────
// 線上/本地雙向同步，規則：
//  - odd_lot_trades / shareholder_gifts / historical_shareholder_gifts：
//    以自然鍵 union，重複鍵「線上」版本勝出。
//  - analysis_records：每個 ticker 只保留最新一筆（依 created_at），
//    平手時以「線上」為準。
//  - users / user_identities / api_usage / migrations：不同步。
// ────────────────────────────────────────────────────────────────

export const SYNC_TABLES = [
  'odd_lot_trades',
  'shareholder_gifts',
  'historical_shareholder_gifts',
  'analysis_records',
] as const
export type SyncTableName = (typeof SYNC_TABLES)[number]

export interface SyncRow {
  [key: string]: any
}

export interface SyncExport {
  exportedAt: string
  tables: Record<SyncTableName, SyncRow[]>
}

export type RowSource = 'online' | 'local'

export interface TaggedRow {
  row: SyncRow
  source: RowSource
}

export interface MergedExport {
  tables: Record<SyncTableName, TaggedRow[]>
  stats: Record<SyncTableName, { total: number; fromOnline: number; fromLocal: number }>
}

const TABLE_COLUMNS: Record<SyncTableName, string[]> = {
  odd_lot_trades: [
    'date', 'stock_id', 'stock_name', 'price', 'volume',
    'bid_price', 'bid_volume', 'ask_price', 'ask_volume',
  ],
  shareholder_gifts: [
    'stock_id', 'stock_name', 'meeting_date', 'last_buy_date', 'gift_name',
    'gift_status', 'claim_rule', 'claim_rule_source', 'mops_gift_text',
    'mops_meeting_date', 'mops_source_url', 'mops_updated_at',
    'distribution_method', 'distribution_location', 'source_url',
  ],
  historical_shareholder_gifts: ['stock_id', 'stock_name', 'year', 'gift_name'],
  analysis_records: [
    'ticker', 'recommendation', 'summary', 'full_report_json',
    'model_usage', 'primary_models', 'fallback_used', 'fallback_count', 'created_at',
  ],
}

const TABLE_KEYS: Record<SyncTableName, string[]> = {
  odd_lot_trades: ['date', 'stock_id'],
  shareholder_gifts: ['stock_id', 'meeting_date'],
  historical_shareholder_gifts: ['stock_id', 'year'],
  analysis_records: ['ticker'],
}

function keyOf(row: SyncRow, keys: string[]): string {
  return keys.map((k) => String(row[k] ?? '')).join('|')
}

/**
 * 「最新」判準：created_at 字串比較（格式皆為 YYYY-MM-DD HH:MM:SS）。
 * 回傳 <0 表示 a 較舊、0 相同、>0 表示 a 較新。
 */
function cmpCreated(a: SyncRow, b: SyncRow): number {
  const ca = String(a.created_at ?? '')
  const cb = String(b.created_at ?? '')
  if (!ca) return cb ? -1 : 0
  if (!cb) return 1
  return ca < cb ? -1 : ca > cb ? 1 : 0
}

export async function exportSyncData(): Promise<SyncExport> {
  const tables = {} as Record<SyncTableName, SyncRow[]>
  for (const table of SYNC_TABLES) {
    tables[table] = await dbQueryAll<SyncRow>(
      `SELECT ${TABLE_COLUMNS[table].join(', ')} FROM ${table}`,
    )
  }
  return { exportedAt: new Date().toISOString(), tables }
}

/**
 * 把兩邊 export 合併成單一結果集。
 * @param local  本機（或呼叫端）資料
 * @param online 線上（權威）資料
 */
export function mergeExports(local: SyncExport, online: SyncExport): MergedExport {
  const tables = {} as Record<SyncTableName, TaggedRow[]>
  const stats = {} as Record<SyncTableName, { total: number; fromOnline: number; fromLocal: number }>

  for (const table of SYNC_TABLES) {
    const keys = TABLE_KEYS[table]
    const localRows = local.tables[table] ?? []
    const onlineRows = online.tables[table] ?? []

    if (table === 'analysis_records') {
      const best = new Map<string, TaggedRow>()
      for (const row of onlineRows) {
        const k = keyOf(row, keys)
        const prev = best.get(k)
        if (!prev || cmpCreated(prev.row, row) <= 0) best.set(k, { row, source: 'online' })
      }
      for (const row of localRows) {
        const k = keyOf(row, keys)
        const prev = best.get(k)
        if (!prev || cmpCreated(prev.row, row) < 0) best.set(k, { row, source: 'local' })
      }
      tables[table] = [...best.values()]
    } else {
      const merged = new Map<string, TaggedRow>()
      for (const row of onlineRows) merged.set(keyOf(row, keys), { row, source: 'online' })
      for (const row of localRows) {
        const k = keyOf(row, keys)
        if (!merged.has(k)) merged.set(k, { row, source: 'local' })
      }
      tables[table] = [...merged.values()]
    }

    let fromOnline = 0
    let fromLocal = 0
    for (const t of tables[table]) {
      if (t.source === 'online') fromOnline++
      else fromLocal++
    }
    stats[table] = { total: tables[table].length, fromOnline, fromLocal }
  }

  return { tables, stats }
}

async function deleteRow(table: SyncTableName, row: SyncRow): Promise<void> {
  const keys = TABLE_KEYS[table]
  const where = keys.map((k) => `COALESCE(${k}, '') = @k_${k}`).join(' AND ')
  const params: Record<string, any> = {}
  for (const k of keys) params[`k_${k}`] = String(row[k] ?? '')
  await dbExecute(`DELETE FROM ${table} WHERE ${where}`, params)
}

async function insertRow(table: SyncTableName, row: SyncRow): Promise<void> {
  const cols = TABLE_COLUMNS[table]
  const placeholders = cols.map((c) => `@c_${c}`).join(', ')
  const params: Record<string, any> = {}
  for (const c of cols) params[`c_${c}`] = row[c] ?? null
  await dbExecute(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    params,
  )
}

/**
 * 把合併結果套用到目前連線的資料庫（本機或線上皆可）。
 * union 表直接 delete-by-key + insert；analysis_records 每個 ticker
 * 清掉舊的只留最新，達成「每 ticker 只留最新」。
 */
export async function applySyncMerge(merged: MergedExport): Promise<void> {
  for (const table of SYNC_TABLES) {
    for (const { row } of merged.tables[table]) {
      await deleteRow(table, row)
      await insertRow(table, row)
    }
  }
}

async function insertRowsBatched(table: SyncTableName, rows: SyncRow[]): Promise<void> {
  if (rows.length === 0) return
  const cols = TABLE_COLUMNS[table]
  const colSql = cols.join(', ')
  // SQL Server 單一查詢最多 2100 個參數 → 每個批次依欄位數縮小。
  const batchSize = Math.max(1, Math.floor(1800 / cols.length))
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const rowsSql = batch
      .map((_, r) => `(${cols.map((c) => `@b${r}_${c}`).join(', ')})`)
      .join(', ')
    const params: Record<string, any> = {}
    batch.forEach((row, r) => {
      for (const c of cols) params[`b${r}_${c}`] = row[c] ?? null
    })
    await dbExecute(`INSERT INTO ${table} (${colSql}) VALUES ${rowsSql}`, params)
  }
}

/**
 * 線上端 import 的差量套用（省掉逐列 delete+insert，避免 App Service 504）。
 * 目前 DB（線上）為權威：
 *  - union 表：只插「線上沒有」的本機新增列（批次多列 INSERT）。
 *  - analysis_records：本機較新的 ticker 才取代線上該 ticker 舊列。
 * @param remote 呼叫端（本機）匯出的資料
 */
export async function applySyncImport(remote: SyncExport): Promise<MergedExport> {
  const current = await exportSyncData()
  const merged = mergeExports(remote, current)

  for (const table of SYNC_TABLES) {
    if (table === 'analysis_records') continue
    const toInsert = merged.tables[table]
      .filter((t) => t.source === 'local')
      .map((t) => t.row)
    await insertRowsBatched(table, toInsert)
  }

  for (const { row, source } of merged.tables.analysis_records) {
    if (source === 'online') continue
    await deleteRowsByTicker(row.ticker)
    await insertRow('analysis_records', row)
  }

  return merged
}

async function deleteRowsByTicker(ticker: string): Promise<void> {
  await dbExecute('DELETE FROM analysis_records WHERE ticker = @ticker', { ticker })
}
