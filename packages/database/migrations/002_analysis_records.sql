CREATE TABLE IF NOT EXISTS analysis_records (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker               TEXT    NOT NULL,
  recommendation       TEXT    NOT NULL,
  summary              TEXT,
  full_report_json     TEXT    NOT NULL,
  created_at           TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_ticker ON analysis_records(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_records(created_at);
