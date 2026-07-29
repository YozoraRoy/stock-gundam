CREATE TABLE IF NOT EXISTS odd_lot_trades (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT    NOT NULL,
  stock_id   TEXT    NOT NULL,
  stock_name TEXT    NOT NULL,
  price      REAL,
  volume     INTEGER DEFAULT 0,
  bid_price  REAL,
  bid_volume INTEGER DEFAULT 0,
  ask_price  REAL,
  ask_volume INTEGER DEFAULT 0,
  created_at TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_odd_lot_date ON odd_lot_trades(date);
CREATE INDEX IF NOT EXISTS idx_odd_lot_stock ON odd_lot_trades(stock_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_odd_lot_unique ON odd_lot_trades(date, stock_id);

CREATE TABLE IF NOT EXISTS shareholder_gifts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_id             TEXT    NOT NULL,
  stock_name           TEXT    NOT NULL,
  meeting_date         TEXT,
  last_buy_date        TEXT,
  gift_name            TEXT,
  distribution_method  TEXT,
  distribution_location TEXT,
  source_url           TEXT,
  created_at           TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_gift_stock ON shareholder_gifts(stock_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_unique ON shareholder_gifts(stock_id, meeting_date);

CREATE TABLE IF NOT EXISTS migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  applied_at TEXT    DEFAULT (datetime('now', 'localtime'))
);
