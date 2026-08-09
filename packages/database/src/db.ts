import Database from 'better-sqlite3'
import sql from 'mssql'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEED_TRADES, SEED_GIFTS } from './seed-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'stock.db')
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

// ─── Backend detection ───────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || ''
const isAzureSql = DATABASE_URL.length > 0

// ─── SQLite (local) ──────────────────────────────────────────────
let _db: Database.Database | null = null
let _dbFailed = false

// ─── Azure SQL (cloud) ───────────────────────────────────────────
let _pool: sql.ConnectionPool | null = null
let _poolFailed = false

// ─── Shared state ────────────────────────────────────────────────
let _giftsSeeded = false
const memoryStore: AnalysisRecord[] = []
let memoryIdCounter = 1

// ─── SQLite connection ───────────────────────────────────────────
function getSqliteDb(): Database.Database | null {
  if (_db) return _db
  if (_dbFailed) return null

  try {
    const dbDir = dirname(DB_PATH)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')

    _db.exec(`
      CREATE TABLE IF NOT EXISTS odd_lot_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        stock_id TEXT NOT NULL,
        stock_name TEXT NOT NULL,
        price REAL,
        volume INTEGER,
        bid_price REAL,
        bid_volume INTEGER,
        ask_price REAL,
        ask_volume INTEGER,
        UNIQUE(date, stock_id)
      );
      CREATE TABLE IF NOT EXISTS shareholder_gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        stock_name TEXT NOT NULL,
        meeting_date TEXT,
        last_buy_date TEXT,
        gift_name TEXT,
        gift_status TEXT,
        claim_rule TEXT,
        claim_rule_source TEXT,
        mops_gift_text TEXT,
        mops_meeting_date TEXT,
        mops_source_url TEXT,
        mops_updated_at TEXT,
        distribution_method TEXT,
        distribution_location TEXT,
        source_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, meeting_date)
      );
    `)

    let countRow: { cnt: number } | undefined
    try {
      countRow = _db.prepare("SELECT count(*) as cnt FROM odd_lot_trades").get() as { cnt: number }
    } catch (_) {}

    if (!countRow || countRow.cnt < 50) {
      console.log(`[SQLite] Auto populating ${SEED_TRADES.length} trades and ${SEED_GIFTS.length} gifts...`)

      const insertTrade = _db.prepare(`
        INSERT OR REPLACE INTO odd_lot_trades (date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
        VALUES (@date, @stock_id, @stock_name, @price, @volume, @bid_price, @bid_volume, @ask_price, @ask_volume)
      `)
      const insertGift = _db.prepare(`
        INSERT OR REPLACE INTO shareholder_gifts (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
        VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
      `)

      const populateTx = _db.transaction(() => {
        for (const trade of SEED_TRADES) insertTrade.run(trade)
        for (const gift of SEED_GIFTS) insertGift.run(gift)
      })
      populateTx()

      const checkCount = _db.prepare("SELECT count(*) as cnt FROM odd_lot_trades").get() as { cnt: number }
      console.log(`[SQLite] Seeded! Total trades: ${checkCount?.cnt || 0}`)
    }

    _db.exec(`
      CREATE TABLE IF NOT EXISTS historical_shareholder_gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        stock_name TEXT,
        year INTEGER NOT NULL,
        gift_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, year)
      );
      CREATE TABLE IF NOT EXISTS analysis_records (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker               TEXT    NOT NULL,
        recommendation       TEXT    NOT NULL,
        summary              TEXT,
        full_report_json     TEXT    NOT NULL,
        model_usage          TEXT,
        primary_models       TEXT,
        fallback_used        TEXT,
        fallback_count       INTEGER DEFAULT 0,
        created_at           TEXT    DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_analysis_ticker ON analysis_records(ticker);
      CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_records(created_at);
      CREATE INDEX IF NOT EXISTS idx_historical_gifts_stock ON historical_shareholder_gifts(stock_id);
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        display_name TEXT,
        avatar_url TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );
      CREATE TABLE IF NOT EXISTS user_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        provider_email TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(provider, provider_user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);
      CREATE TABLE IF NOT EXISTS api_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        usage_date TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        UNIQUE(user_id, usage_date)
      );
      CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);

      UPDATE odd_lot_trades SET price = 34.15, volume = 19443, bid_price = 34.15, bid_volume = 8943, ask_price = 34.20, ask_volume = 6092 WHERE stock_id = '2887';
      UPDATE shareholder_gifts SET gift_name = '多用途矽膠隔熱餐墊(二入)', last_buy_date = '08/14' WHERE stock_id = '2887';
      UPDATE odd_lot_trades SET price = COALESCE(NULLIF(price, 0), bid_price, ask_price, 50.0) WHERE price IS NULL OR price <= 0;
      UPDATE odd_lot_trades SET price = bid_price WHERE price > 4000 AND stock_id NOT IN ('3008', '5274', '6669', '3661') AND bid_price > 0 AND bid_price < 2000;
    `)

    return _db
  } catch (err) {
    console.error('[SQLite] Failed to initialize (falling back to memory):', err)
    _dbFailed = true
    return null
  }
}

// ─── Azure SQL connection pool ───────────────────────────────────
async function getAzurePool(): Promise<sql.ConnectionPool | null> {
  if (_pool) return _pool
  if (_poolFailed) return null

  try {
    _pool = await sql.connect(DATABASE_URL)
    console.log('[AzureSQL] Connected successfully')

    await _pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'odd_lot_trades')
      BEGIN
        CREATE TABLE odd_lot_trades (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          date       NVARCHAR(20) NOT NULL,
          stock_id   NVARCHAR(20) NOT NULL,
          stock_name NVARCHAR(100) NOT NULL,
          price      FLOAT,
          volume     INT,
          bid_price  FLOAT,
          bid_volume INT,
          ask_price  FLOAT,
          ask_volume INT,
          created_at DATETIME DEFAULT GETDATE(),
          CONSTRAINT uq_odd_lot UNIQUE (date, stock_id)
        );
        CREATE INDEX idx_odd_lot_date ON odd_lot_trades(date);
        CREATE INDEX idx_odd_lot_stock ON odd_lot_trades(stock_id);
      END
    `)

    await _pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'shareholder_gifts')
      BEGIN
        CREATE TABLE shareholder_gifts (
          id                   INT IDENTITY(1,1) PRIMARY KEY,
          stock_id             NVARCHAR(20) NOT NULL,
          stock_name           NVARCHAR(100) NOT NULL,
          meeting_date         NVARCHAR(20),
          last_buy_date        NVARCHAR(20),
          gift_name            NVARCHAR(500),
          gift_status          NVARCHAR(50),
          claim_rule           NVARCHAR(50),
          claim_rule_source    NVARCHAR(50),
          mops_gift_text       NVARCHAR(MAX),
          mops_meeting_date    NVARCHAR(50),
          mops_source_url      NVARCHAR(1000),
          mops_updated_at      NVARCHAR(50),
          distribution_method  NVARCHAR(200),
          distribution_location NVARCHAR(500),
          source_url           NVARCHAR(1000),
          created_at           DATETIME DEFAULT GETDATE(),
          CONSTRAINT uq_gift UNIQUE (stock_id, meeting_date)
        );
        CREATE INDEX idx_gift_stock ON shareholder_gifts(stock_id);
      END
    `)

    await _pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'analysis_records')
      BEGIN
        CREATE TABLE analysis_records (
          id                   INT IDENTITY(1,1) PRIMARY KEY,
          ticker               NVARCHAR(20) NOT NULL,
          recommendation       NVARCHAR(50) NOT NULL,
          summary              NVARCHAR(MAX),
          full_report_json     NVARCHAR(MAX) NOT NULL,
          model_usage          NVARCHAR(4000),
          primary_models       NVARCHAR(500),
          fallback_used        NVARCHAR(10),
          fallback_count       INT DEFAULT 0,
          created_at           DATETIME DEFAULT GETDATE()
        );
        CREATE INDEX idx_analysis_ticker ON analysis_records(ticker);
        CREATE INDEX idx_analysis_created ON analysis_records(created_at);
      END
    `)

    await _pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'historical_shareholder_gifts')
      BEGIN
        CREATE TABLE historical_shareholder_gifts (
          id           INT IDENTITY(1,1) PRIMARY KEY,
          stock_id     NVARCHAR(20) NOT NULL,
          stock_name   NVARCHAR(100),
          year         INT NOT NULL,
          gift_name    NVARCHAR(500) NOT NULL,
          created_at   DATETIME DEFAULT GETDATE(),
          CONSTRAINT uq_hist_gift UNIQUE (stock_id, year)
        );
        CREATE INDEX idx_historical_gifts_stock ON historical_shareholder_gifts(stock_id);
      END
    `)

    await _pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
      BEGIN
        CREATE TABLE users (
          id           INT IDENTITY(1,1) PRIMARY KEY,
          email        NVARCHAR(255),
          display_name NVARCHAR(100),
          avatar_url   NVARCHAR(500),
          created_at   DATETIME DEFAULT GETDATE()
        );
        CREATE TABLE user_identities (
          id               INT IDENTITY(1,1) PRIMARY KEY,
          user_id          INT NOT NULL,
          provider         NVARCHAR(20) NOT NULL,
          provider_user_id NVARCHAR(100) NOT NULL,
          provider_email   NVARCHAR(255),
          created_at       DATETIME DEFAULT GETDATE(),
          CONSTRAINT uq_identity UNIQUE (provider, provider_user_id)
        );
        CREATE INDEX idx_identities_user ON user_identities(user_id);
        CREATE TABLE api_usage (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          user_id    INT NOT NULL,
          usage_date NVARCHAR(10) NOT NULL,
          count      INT DEFAULT 0,
          CONSTRAINT uq_api_usage UNIQUE (user_id, usage_date)
        );
        CREATE INDEX idx_api_usage_user ON api_usage(user_id);
      END
    `)

    return _pool
  } catch (err) {
    console.error('[AzureSQL] Failed to connect (falling back to memory):', err)
    _poolFailed = true
    return null
  }
}

// ─── Unified public API ──────────────────────────────────────────

/**
 * Returns the raw SQLite database handle (local only).
 * Returns null when using Azure SQL or on failure.
 */
export function getDb(): Database.Database | null {
  if (isAzureSql) return null
  return getSqliteDb()
}

/**
 * Check if we have a working database connection (either backend).
 */
export function getAzurePoolPublic(): Promise<sql.ConnectionPool | null> {
  return getAzurePool()
}

export function hasDb(): boolean {
  if (isAzureSql) return !_poolFailed
  return getSqliteDb() !== null
}

/**
 * Azure SQL (T-SQL) has no LIMIT clause — translate `... LIMIT n` to `SELECT TOP (n) ...`.
 * SQLite keeps native LIMIT. Only applies when a trailing LIMIT n is present.
 */
export function translateLimitForAzure(sqlStr: string): string {
  return sqlStr.replace(
    /^\s*(SELECT\s+)(.*)\s+LIMIT\s+(\d+)\s*;?\s*$/is,
    (_all, select, rest, n) => `SELECT TOP (${n}) ${rest}`,
  )
}

/**
 * Query all rows. Works with both SQLite and Azure SQL.
 */
export async function dbQueryAll<T = any>(sqlStr: string, params?: Record<string, any>): Promise<T[]> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return []
    const req = pool.request()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        req.input(k, v ?? null)
      }
    }
    const result = await req.query(translateLimitForAzure(sqlStr))
    return result.recordset
  }

  const db = getSqliteDb()
  if (!db) return []

  if (params) {
    return db.prepare(sqlStr).all(params) as any[]
  }
  return db.prepare(sqlStr).all() as any[]
}

/**
 * Query first row. Works with both SQLite and Azure SQL.
 */
export async function dbQueryFirst<T = any>(sqlStr: string, params?: Record<string, any>): Promise<T | undefined> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return undefined
    const req = pool.request()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        req.input(k, v ?? null)
      }
    }
    const result = await req.query(translateLimitForAzure(sqlStr))
    return result.recordset[0] as T | undefined
  }

  const db = getSqliteDb()
  if (!db) return undefined

  if (params) {
    return db.prepare(sqlStr).get(params) as T | undefined
  }
  return db.prepare(sqlStr).get() as T | undefined
}

/**
 * Execute a statement (INSERT/UPDATE/DELETE). Works with both backends.
 */
export async function dbExecute(sqlStr: string, params?: Record<string, any>): Promise<void> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return
    const req = pool.request()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        req.input(k, v ?? null)
      }
    }
    await req.query(sqlStr)
    return
  }

  const db = getSqliteDb()
  if (!db) return

  if (params) {
    db.prepare(sqlStr).run(params)
  } else {
    db.exec(sqlStr)
  }
}

/**
 * Run a raw SQL string (multi-statement). Azure SQL splits on GO; SQLite uses exec.
 */
export async function dbExecRaw(sqlStr: string): Promise<void> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return
    const batches = sqlStr.split(/\bGO\b/i).filter(b => b.trim())
    for (const batch of batches) {
      if (batch.trim()) {
        await pool.request().query(batch)
      }
    }
    return
  }

  const db = getSqliteDb()
  if (!db) return
  db.exec(sqlStr)
}

// ─── ensureSeedData (async version) ──────────────────────────────

export async function ensureSeedData(): Promise<number> {
  if (isAzureSql) {
    return ensureSeedDataAzure()
  }
  return ensureSeedDataSqlite()
}

async function ensureSeedDataAzure(): Promise<number> {
  const pool = await getAzurePool()
  if (!pool) return 0

  const countResult = await pool.request().query('SELECT COUNT(*) as cnt FROM odd_lot_trades')
  const cnt = countResult.recordset[0]?.cnt ?? 0
  const batchSize = 200

  if (cnt < 50) {
    console.log(`[AzureSQL] Seeding ${SEED_TRADES.length} trades and ${SEED_GIFTS.length} gifts...`)

    for (let i = 0; i < SEED_TRADES.length; i += batchSize) {
      const batch = SEED_TRADES.slice(i, i + batchSize)
      const req = pool.request()
      const values: string[] = []
      batch.forEach((t, idx) => {
        const p = `t${idx}`
        values.push(`(@${p}_date, @${p}_sid, @${p}_sname, @${p}_price, @${p}_vol, @${p}_bp, @${p}_bv, @${p}_ap, @${p}_av)`)
        req.input(`${p}_date`, sql.NVarChar(20), t.date)
        req.input(`${p}_sid`, sql.NVarChar(20), t.stock_id)
        req.input(`${p}_sname`, sql.NVarChar(100), t.stock_name)
        req.input(`${p}_price`, sql.Float, t.price)
        req.input(`${p}_vol`, sql.Int, t.volume)
        req.input(`${p}_bp`, sql.Float, t.bid_price)
        req.input(`${p}_bv`, sql.Int, t.bid_volume)
        req.input(`${p}_ap`, sql.Float, t.ask_price)
        req.input(`${p}_av`, sql.Int, t.ask_volume)
      })
      await req.query(`
        INSERT INTO odd_lot_trades (date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
        VALUES ${values.join(',')}
      `)
    }

    for (let i = 0; i < SEED_GIFTS.length; i += batchSize) {
      const batch = SEED_GIFTS.slice(i, i + batchSize)
      const req = pool.request()
      const values: string[] = []
      batch.forEach((g, idx) => {
        const p = `g${idx}`
        values.push(`(@${p}_sid, @${p}_sname, @${p}_md, @${p}_lbd, @${p}_gn, @${p}_dm, @${p}_dl, @${p}_su)`)
        req.input(`${p}_sid`, sql.NVarChar(20), g.stock_id)
        req.input(`${p}_sname`, sql.NVarChar(100), g.stock_name)
        req.input(`${p}_md`, sql.NVarChar(20), g.meeting_date)
        req.input(`${p}_lbd`, sql.NVarChar(20), g.last_buy_date)
        req.input(`${p}_gn`, sql.NVarChar(500), g.gift_name)
        req.input(`${p}_dm`, sql.NVarChar(200), g.distribution_method)
        req.input(`${p}_dl`, sql.NVarChar(500), g.distribution_location)
        req.input(`${p}_su`, sql.NVarChar(1000), g.source_url)
      })
      await req.query(`
        MERGE INTO shareholder_gifts AS target
        USING (VALUES ${values.join(',')}) AS source (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
        ON target.stock_id = source.stock_id AND target.meeting_date = source.meeting_date
        WHEN MATCHED THEN
          UPDATE SET stock_name = source.stock_name, last_buy_date = source.last_buy_date,
                     gift_name = source.gift_name, distribution_method = source.distribution_method,
                     distribution_location = source.distribution_location, source_url = source.source_url
        WHEN NOT MATCHED THEN
          INSERT (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
          VALUES (source.stock_id, source.stock_name, source.meeting_date, source.last_buy_date, source.gift_name, source.distribution_method, source.distribution_location, source.source_url);
      `)
    }

    _giftsSeeded = true
    console.log('[AzureSQL] Seed data inserted')
  }

  if (!_giftsSeeded) {
    console.log(`[AzureSQL] Ensuring ${SEED_GIFTS.length} seed gifts...`)
    try {
      for (let i = 0; i < SEED_GIFTS.length; i += batchSize) {
        const batch = SEED_GIFTS.slice(i, i + batchSize)
        const req = pool.request()
        const values: string[] = []
        batch.forEach((g, idx) => {
          const p = `g${idx}`
          values.push(`(@${p}_sid, @${p}_sname, @${p}_md, @${p}_lbd, @${p}_gn, @${p}_dm, @${p}_dl, @${p}_su)`)
          req.input(`${p}_sid`, sql.NVarChar(20), g.stock_id)
          req.input(`${p}_sname`, sql.NVarChar(100), g.stock_name)
          req.input(`${p}_md`, sql.NVarChar(20), g.meeting_date)
          req.input(`${p}_lbd`, sql.NVarChar(20), g.last_buy_date)
          req.input(`${p}_gn`, sql.NVarChar(500), g.gift_name)
          req.input(`${p}_dm`, sql.NVarChar(200), g.distribution_method)
          req.input(`${p}_dl`, sql.NVarChar(500), g.distribution_location)
          req.input(`${p}_su`, sql.NVarChar(1000), g.source_url)
        })
        await req.query(`
          MERGE INTO shareholder_gifts AS target
          USING (VALUES ${values.join(',')}) AS source (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
          ON target.stock_id = source.stock_id AND target.meeting_date = source.meeting_date
          WHEN MATCHED THEN
            UPDATE SET stock_name = source.stock_name, last_buy_date = source.last_buy_date,
                       gift_name = source.gift_name, distribution_method = source.distribution_method,
                       distribution_location = source.distribution_location, source_url = source.source_url
          WHEN NOT MATCHED THEN
            INSERT (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
            VALUES (source.stock_id, source.stock_name, source.meeting_date, source.last_buy_date, source.gift_name, source.distribution_method, source.distribution_location, source.source_url);
        `)
      }
      _giftsSeeded = true
    } catch (e: any) {
      if (e.number === 2627) {
        console.log('[AzureSQL] Gifts already seeded (duplicate key), skipping')
        _giftsSeeded = true
      } else {
        throw e
      }
    }
  }

  const finalCount = await pool.request().query('SELECT COUNT(*) as cnt FROM odd_lot_trades')
  return finalCount.recordset[0]?.cnt ?? 0
}

function ensureSeedDataSqlite(): number {
  const db = getSqliteDb()
  if (!db) return 0

  const countRow = db.prepare("SELECT count(*) as cnt FROM odd_lot_trades").get() as { cnt: number }
  if (!countRow || countRow.cnt < 50) {
    console.log(`[SQLite] Force populating ${SEED_TRADES.length} trades and ${SEED_GIFTS.length} gifts...`)

    const insertTrade = db.prepare(`
      INSERT OR REPLACE INTO odd_lot_trades (date, stock_id, stock_name, price, volume, bid_price, bid_volume, ask_price, ask_volume)
      VALUES (@date, @stock_id, @stock_name, @price, @volume, @bid_price, @bid_volume, @ask_price, @ask_volume)
    `)
    const insertGift = db.prepare(`
      INSERT OR REPLACE INTO shareholder_gifts (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
      VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
    `)

    const populateTx = db.transaction(() => {
      for (const trade of SEED_TRADES) insertTrade.run(trade)
      for (const gift of SEED_GIFTS) insertGift.run(gift)
    })
    populateTx()

    const checkCount = db.prepare("SELECT count(*) as cnt FROM odd_lot_trades").get() as { cnt: number }
    return checkCount?.cnt || 0
  }

  if (!_giftsSeeded) {
    console.log(`[SQLite] Ensuring ${SEED_GIFTS.length} seed gifts...`)
    const insertGift = db.prepare(`
      INSERT OR REPLACE INTO shareholder_gifts (stock_id, stock_name, meeting_date, last_buy_date, gift_name, distribution_method, distribution_location, source_url)
      VALUES (@stock_id, @stock_name, @meeting_date, @last_buy_date, @gift_name, @distribution_method, @distribution_location, @source_url)
    `)
    const insertGiftsTx = db.transaction(() => {
      for (const gift of SEED_GIFTS) insertGift.run(gift)
    })
    insertGiftsTx()
    _giftsSeeded = true
  }

  return countRow.cnt
}

// ─── migrate (async) ─────────────────────────────────────────────
export async function migrate(): Promise<void> {
  if (isAzureSql) {
    return migrateAzure()
  }
  return migrateSqlite()
}

async function migrateAzure(): Promise<void> {
  const pool = await getAzurePool()
  if (!pool) return

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'migrations')
      CREATE TABLE migrations (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        name       NVARCHAR(200) NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT GETDATE()
      )
    `)

    const applied = new Set(
      (await pool.request().query('SELECT name FROM migrations')).recordset.map((r: any) => r.name)
    )

    if (existsSync(MIGRATIONS_DIR)) {
      const migrationFiles = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()

      for (const file of migrationFiles) {
        if (applied.has(file)) continue
        const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
        const batches = raw.split(/\bGO\b/i).filter(b => b.trim())
        for (const batch of batches) {
          if (!batch.trim()) continue
          try {
            await pool.request().query(batch)
          } catch (e: any) {
            const msg = String(e?.message ?? e).toLowerCase()
            const isDup =
              e?.number === 2705 ||
              e?.number === 4928 ||
              (msg.includes('already exists') && msg.includes('column'))
            if (isDup) {
              console.log(`[AzureSQL] migration ${file}: column already exists, skipping statement`)
            } else {
              // 001/002 為 SQLite 語法（CREATE TABLE IF NOT EXISTS）在 T-SQL 不合法，
              // 但表格已由 getAzurePool 建立。記錄並跳過，避免中止整個 migrate。
              console.warn(`[AzureSQL] migration ${file}: statement failed, skipping (${msg.split('\n')[0]})`)
            }
          }
        }
        await pool.request()
          .input('name', sql.NVarChar(200), file)
          .query('INSERT INTO migrations (name) VALUES (@name)')
        console.log(`Applied migration: ${file}`)
      }
    }
  } catch (e) {
    console.error('[AzureSQL] Migration failed:', e)
  }
}

function migrateSqlite(): void {
  const db = getSqliteDb()
  if (!db) return

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`)

    const applied = new Set(
      db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
    )

    if (existsSync(MIGRATIONS_DIR)) {
      const migrationFiles = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()

      const insert = db.prepare('INSERT INTO migrations (name) VALUES (?)')
      for (const file of migrationFiles) {
        if (applied.has(file)) continue
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)
        for (const stmt of statements) {
          try {
            db.exec(stmt)
          } catch (e: any) {
            const msg = String(e?.message ?? e).toLowerCase()
            if (msg.includes('duplicate column name')) {
              console.log(`[SQLite] migration ${file}: column already exists, skipping statement`)
              continue
            }
            throw e
          }
        }
        insert.run(file)
        console.log(`Applied migration: ${file}`)
      }
    }
  } catch (e) {
    console.error('[SQLite] Migration failed:', e)
  }
}

// ─── closeDb ─────────────────────────────────────────────────────
export function closeDb(): void {
  if (_db) {
    try { _db.close() } catch (_) {}
    _db = null
  }
  if (_pool) {
    try { _pool.close() } catch (_) {}
    _pool = null
  }
}

// ─── Analysis Records ────────────────────────────────────────────
export interface AnalysisRecord {
  id?: number
  ticker: string
  recommendation: string
  summary?: string
  full_report_json: string
  model_usage?: string
  primary_models?: string
  fallback_used?: string
  fallback_count?: number
  created_at?: string
}

export async function saveAnalysisRecord(record: {
  ticker: string
  recommendation: string
  summary?: string
  fullReport: any
  modelUsage?: string
  primaryModels?: string
  fallbackUsed?: boolean
  fallbackCount?: number
}): Promise<number> {
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const reportJson = typeof record.fullReport === 'string' ? record.fullReport : JSON.stringify(record.fullReport)
  const summaryStr = typeof record.summary === 'string' ? record.summary : JSON.stringify(record.summary || '')
  const modelUsageStr = record.modelUsage ?? null
  const primaryModelsStr = record.primaryModels ?? null
  const fallbackUsedStr = record.fallbackUsed ? '1' : '0'
  const fallbackCount = record.fallbackCount ?? 0
  let insertedId = -1

  if (isAzureSql) {
    const pool = await getAzurePool()
    if (pool) {
      try {
        const result = await pool.request()
          .input('ticker', sql.NVarChar(20), record.ticker)
          .input('rec', sql.NVarChar(50), record.recommendation || 'Hold')
          .input('summary', sql.NVarChar(sql.MAX), summaryStr)
          .input('report', sql.NVarChar(sql.MAX), reportJson)
          .input('modelUsage', sql.NVarChar(4000), modelUsageStr)
          .input('primaryModels', sql.NVarChar(500), primaryModelsStr)
          .input('fallbackUsed', sql.NVarChar(10), fallbackUsedStr)
          .input('fallbackCount', sql.Int, fallbackCount)
          .query(`
            INSERT INTO analysis_records (ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count)
            VALUES (@ticker, @rec, @summary, @report, @modelUsage, @primaryModels, @fallbackUsed, @fallbackCount);
            SELECT SCOPE_IDENTITY() as id
          `)
        insertedId = Number(result.recordset[0]?.id ?? -1)
      } catch (e) {
        console.error('[AzureSQL] saveAnalysisRecord error:', e)
      }
    }
  } else {
    const db = getSqliteDb()
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT INTO analysis_records (ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const info = stmt.run(record.ticker, record.recommendation || 'Hold', summaryStr, reportJson, modelUsageStr, primaryModelsStr, fallbackUsedStr, fallbackCount)
        insertedId = Number(info.lastInsertRowid)
      } catch (e) {
        console.error('[SQLite] saveAnalysisRecord error:', e)
      }
    }
  }

  const id = insertedId > 0 ? insertedId : memoryIdCounter++
  memoryStore.unshift({
    id, ticker: record.ticker, recommendation: record.recommendation,
    summary: summaryStr, full_report_json: reportJson, created_at: nowStr,
    model_usage: modelUsageStr ?? undefined,
    primary_models: primaryModelsStr ?? undefined,
    fallback_used: fallbackUsedStr,
    fallback_count: fallbackCount,
  })
  return id
}

export async function getAnalysisRecords(limit: number = 20, symbol?: string): Promise<AnalysisRecord[]> {
  const cleanSymbol = symbol?.trim().toUpperCase()

  if (isAzureSql) {
    const pool = await getAzurePool()
    if (pool) {
      try {
        const req = pool.request()
        req.input('limit', sql.Int, limit)
        if (cleanSymbol) {
          req.input('pattern', sql.NVarChar(50), `%${cleanSymbol}%`)
          const result = await req.query(`
            SELECT TOP (@limit) id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at
            FROM analysis_records WHERE UPPER(ticker) LIKE @pattern ORDER BY id DESC
          `)
          return result.recordset as AnalysisRecord[]
        }
        const result = await req.query(`
          SELECT TOP (@limit) id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at
          FROM analysis_records ORDER BY id DESC
        `)
        return result.recordset as AnalysisRecord[]
      } catch (e) {
        console.error('[AzureSQL] getAnalysisRecords error:', e)
      }
    }
  } else {
    const db = getSqliteDb()
    if (db) {
      try {
        if (cleanSymbol) {
          return db.prepare(`
            SELECT id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at
            FROM analysis_records WHERE UPPER(ticker) LIKE ? ORDER BY id DESC LIMIT ?
          `).all(`%${cleanSymbol}%`, limit) as AnalysisRecord[]
        }
        return db.prepare(`
          SELECT id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at
          FROM analysis_records ORDER BY id DESC LIMIT ?
        `).all(limit) as AnalysisRecord[]
      } catch (e) {
        console.error('[SQLite] getAnalysisRecords error:', e)
      }
    }
  }

  if (cleanSymbol) {
    return memoryStore.filter(r => r.ticker.toUpperCase().includes(cleanSymbol)).slice(0, limit)
  }
  return memoryStore.slice(0, limit)
}

export async function getAnalysisRecordById(id: number): Promise<AnalysisRecord | undefined> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (pool) {
      try {
        const result = await pool.request()
          .input('id', sql.Int, id)
          .query(`SELECT id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at FROM analysis_records WHERE id = @id`)
        return result.recordset[0] as AnalysisRecord | undefined
      } catch (e) {
        console.error('[AzureSQL] getAnalysisRecordById error:', e)
      }
    }
  } else {
    const db = getSqliteDb()
    if (db) {
      try {
        return db.prepare(`
          SELECT id, ticker, recommendation, summary, full_report_json, model_usage, primary_models, fallback_used, fallback_count, created_at
          FROM analysis_records WHERE id = ?
        `).get(id) as AnalysisRecord | undefined
      } catch (e) {
        console.error('[SQLite] getAnalysisRecordById error:', e)
      }
    }
  }

  return memoryStore.find(r => r.id === id)
}

// ─── Historical Gifts ────────────────────────────────────────────
export interface HistoricalGift {
  id?: number
  stock_id: string
  stock_name?: string
  year: number
  gift_name: string
}

export async function getHistoricalGifts(stockId: string): Promise<HistoricalGift[]> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (pool) {
      try {
        const result = await pool.request()
          .input('stock_id', sql.NVarChar(20), stockId)
          .query(`
            SELECT id, stock_id, stock_name, year, gift_name
            FROM historical_shareholder_gifts WHERE stock_id = @stock_id ORDER BY year DESC
          `)
        return result.recordset as HistoricalGift[]
      } catch (e) {
        console.error('[AzureSQL] getHistoricalGifts error:', e)
      }
    }
    return []
  }

  const db = getSqliteDb()
  if (db) {
    try {
      return db.prepare(`
        SELECT id, stock_id, stock_name, year, gift_name
        FROM historical_shareholder_gifts WHERE stock_id = ? ORDER BY year DESC
      `).all(stockId) as HistoricalGift[]
    } catch (e) {
      console.error('[SQLite] getHistoricalGifts error:', e)
    }
  }
  return []
}

// ─── Users / Auth / Quota ────────────────────────────────────────
export type AuthProvider = 'google' | 'line'

export interface UserRow {
  id: number
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at?: string
}

export interface IdentityInput {
  provider: AuthProvider
  providerUserId: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

export interface QuotaResult {
  allowed: boolean
  used: number
  remaining: number
  max: number
}

  const USER_COLUMNS = 'id, email, display_name, avatar_url, created_at'
  const USER_COLUMNS_ALIASED = 'u.id, u.email, u.display_name, u.avatar_url, u.created_at'

export async function getUserById(userId: number): Promise<UserRow | null> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return null
    try {
      const result = await pool.request()
        .input('id', sql.Int, userId)
        .query(`SELECT ${USER_COLUMNS} FROM users WHERE id = @id`)
      return (result.recordset[0] as UserRow) ?? null
    } catch (e) {
      console.error('[AzureSQL] getUserById error:', e)
      return null
    }
  }

  const db = getSqliteDb()
  if (!db) return null
  try {
    return (db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId) as UserRow) ?? null
  } catch (e) {
    console.error('[SQLite] getUserById error:', e)
    return null
  }
}

export async function findOrCreateUser(input: IdentityInput): Promise<UserRow | null> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return null
    try {
      const ident = await pool.request()
        .input('p', sql.NVarChar(20), input.provider)
        .input('pid', sql.NVarChar(100), input.providerUserId)
        .query(`
          SELECT ${USER_COLUMNS_ALIASED}
          FROM users u JOIN user_identities i ON i.user_id = u.id
          WHERE i.provider = @p AND i.provider_user_id = @pid
        `)
      if (ident.recordset[0]) {
        await pool.request()
          .input('id', sql.Int, ident.recordset[0].id)
          .input('name', sql.NVarChar(100), input.displayName ?? null)
          .input('avatar', sql.NVarChar(500), input.avatarUrl ?? null)
          .input('email', sql.NVarChar(255), input.email ?? null)
          .query(`UPDATE users SET display_name = COALESCE(@name, display_name), avatar_url = COALESCE(@avatar, avatar_url), email = COALESCE(@email, email) WHERE id = @id`)
        return ident.recordset[0] as UserRow
      }

      let userId: number
      if (input.email) {
        const byEmail = await pool.request()
          .input('email', sql.NVarChar(255), input.email)
          .query('SELECT id FROM users WHERE email = @email')
        if (byEmail.recordset[0]) {
          userId = byEmail.recordset[0].id
        } else {
          const ins = await pool.request()
            .input('email', sql.NVarChar(255), input.email)
            .input('name', sql.NVarChar(100), input.displayName ?? null)
            .input('avatar', sql.NVarChar(500), input.avatarUrl ?? null)
            .query(`INSERT INTO users (email, display_name, avatar_url) VALUES (@email, @name, @avatar); SELECT SCOPE_IDENTITY() AS id`)
          userId = Number(ins.recordset[0]?.id ?? -1)
        }
      } else {
        const ins = await pool.request()
          .input('name', sql.NVarChar(100), input.displayName ?? null)
          .input('avatar', sql.NVarChar(500), input.avatarUrl ?? null)
          .query(`INSERT INTO users (email, display_name, avatar_url) VALUES (NULL, @name, @avatar); SELECT SCOPE_IDENTITY() AS id`)
        userId = Number(ins.recordset[0]?.id ?? -1)
      }

      if (userId > 0) {
        await pool.request()
          .input('uid', sql.Int, userId)
          .input('p', sql.NVarChar(20), input.provider)
          .input('pid', sql.NVarChar(100), input.providerUserId)
          .input('pe', sql.NVarChar(255), input.email ?? null)
          .query(`INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email) VALUES (@uid, @p, @pid, @pe)`)
        const u = await pool.request().input('id', sql.Int, userId).query(`SELECT ${USER_COLUMNS} FROM users WHERE id = @id`)
        return (u.recordset[0] as UserRow) ?? null
      }
      return null
    } catch (e) {
      console.error('[AzureSQL] findOrCreateUser error:', e)
      return null
    }
  }

  const db = getSqliteDb()
  if (!db) return null
  try {
    const existing = db.prepare(`
      SELECT ${USER_COLUMNS_ALIASED}
      FROM users u JOIN user_identities i ON i.user_id = u.id
      WHERE i.provider = ? AND i.provider_user_id = ?
    `).get(input.provider, input.providerUserId) as UserRow | undefined

    if (existing) {
      db.prepare(
        `UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url), email = COALESCE(?, email) WHERE id = ?`,
      ).run(input.displayName ?? null, input.avatarUrl ?? null, input.email ?? null, existing.id)
      return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(existing.id) as UserRow
    }

    let userId: number
    if (input.email) {
      const byEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email) as { id: number } | undefined
      if (byEmail) {
        userId = byEmail.id
      } else {
        userId = Number(db.prepare('INSERT INTO users (email, display_name, avatar_url) VALUES (?, ?, ?)').run(input.email, input.displayName ?? null, input.avatarUrl ?? null).lastInsertRowid)
      }
    } else {
      userId = Number(db.prepare('INSERT INTO users (email, display_name, avatar_url) VALUES (?, ?, ?)').run(null, input.displayName ?? null, input.avatarUrl ?? null).lastInsertRowid)
    }

    if (userId > 0) {
      db.prepare('INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?)').run(userId, input.provider, input.providerUserId, input.email ?? null)
      return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId) as UserRow
    }
    return null
  } catch (e) {
    console.error('[SQLite] findOrCreateUser error:', e)
    return null
  }
}

export async function getUsageCount(userId: number, date: string): Promise<number> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return 0
    try {
      const result = await pool.request()
        .input('uid', sql.Int, userId)
        .input('d', sql.NVarChar(10), date)
        .query('SELECT count FROM api_usage WHERE user_id = @uid AND usage_date = @d')
      return Number(result.recordset[0]?.count ?? 0)
    } catch (e) {
      console.error('[AzureSQL] getUsageCount error:', e)
      return 0
    }
  }

  const db = getSqliteDb()
  if (!db) return 0
  try {
    const row = db.prepare('SELECT count FROM api_usage WHERE user_id = ? AND usage_date = ?').get(userId, date) as { count: number } | undefined
    return Number(row?.count ?? 0)
  } catch (e) {
    console.error('[SQLite] getUsageCount error:', e)
    return 0
  }
}

/**
 * Atomically consume one AI-analysis quota for the given user/date.
 * If the user has reached `max` usages, the call fails (allowed=false).
 */
export async function consumeAnalysisQuota(userId: number, date: string, max: number): Promise<QuotaResult> {
  if (isAzureSql) {
    const pool = await getAzurePool()
    if (!pool) return { allowed: false, used: 0, remaining: 0, max }
    try {
      await pool.request()
        .input('uid', sql.Int, userId)
        .input('d', sql.NVarChar(10), date)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM api_usage WHERE user_id = @uid AND usage_date = @d)
          BEGIN
            INSERT INTO api_usage (user_id, usage_date, count) VALUES (@uid, @d, 0)
          END
        `)
      const res = await pool.request()
        .input('uid', sql.Int, userId)
        .input('d', sql.NVarChar(10), date)
        .input('max', sql.Int, max)
        .query('UPDATE api_usage SET count = count + 1 WHERE user_id = @uid AND usage_date = @d AND count < @max')
      const allowed = (res.rowsAffected[0] ?? 0) > 0
      const used = await getUsageCount(userId, date)
      return { allowed, used, remaining: Math.max(0, max - used), max }
    } catch (e) {
      console.error('[AzureSQL] consumeAnalysisQuota error:', e)
      return { allowed: false, used: 0, remaining: 0, max }
    }
  }

  const db = getSqliteDb()
  if (!db) return { allowed: false, used: 0, remaining: 0, max }
  try {
    db.prepare('INSERT OR IGNORE INTO api_usage (user_id, usage_date, count) VALUES (?, ?, 0)').run(userId, date)
    const res = db.prepare('UPDATE api_usage SET count = count + 1 WHERE user_id = ? AND usage_date = ? AND count < ?').run(userId, date, max)
    const allowed = res.changes > 0
    const used = await getUsageCount(userId, date)
    return { allowed, used, remaining: Math.max(0, max - used), max }
  } catch (e) {
    console.error('[SQLite] consumeAnalysisQuota error:', e)
    return { allowed: false, used: 0, remaining: 0, max }
  }
}
