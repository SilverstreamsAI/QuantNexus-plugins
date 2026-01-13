-- =======================================================================================
-- Factor Library Plugin - Initial Schema
-- Based on WordPress nona_factors table, adapted for plugin architecture
-- =======================================================================================

-- UP MIGRATION

CREATE TABLE IF NOT EXISTS factors (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factor_id TEXT NOT NULL UNIQUE,

  -- Factor Identity
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'custom' CHECK(source IN ('library', 'mined', 'custom')),
  category TEXT NOT NULL,  -- momentum, mean_reversion, volatility, value, volume, technical, other

  -- Implementation
  formula TEXT,
  code TEXT,
  params TEXT,  -- JSON

  -- Performance Metrics
  ic REAL,            -- Information Coefficient
  icir REAL,          -- IC Information Ratio
  rank_ic REAL,       -- Rank IC
  rank_icir REAL,     -- Rank ICIR
  sharpe REAL,        -- Sharpe Ratio
  max_drawdown REAL,  -- Maximum Drawdown

  -- Validation
  symbols_validated TEXT,  -- JSON: ["EURUSD", "BTCUSD"]
  symbol_results TEXT,     -- JSON: symbol-level validation results

  -- Ownership & Status
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'testing')),
  user_id TEXT,
  mining_task_id TEXT,  -- Associated AI mining task ID
  file_path TEXT,       -- Factor file path if loaded from file

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factors_source ON factors(source);
CREATE INDEX IF NOT EXISTS idx_factors_category ON factors(category);
CREATE INDEX IF NOT EXISTS idx_factors_user_id ON factors(user_id);
CREATE INDEX IF NOT EXISTS idx_factors_status ON factors(status);
CREATE INDEX IF NOT EXISTS idx_factors_ic ON factors(ic);
CREATE INDEX IF NOT EXISTS idx_factors_created_at ON factors(created_at);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS trigger_factors_updated_at
AFTER UPDATE ON factors
FOR EACH ROW
WHEN NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE factors
  SET updated_at = datetime('now')
  WHERE id = OLD.id;
END;

-- =======================================================================================
-- Factor Optimization History
-- =======================================================================================

CREATE TABLE IF NOT EXISTS factor_optimization_history (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Factor Reference
  factor_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,

  -- Optimization Metadata
  optimization_type TEXT NOT NULL CHECK(optimization_type IN ('parameter_tuning', 'symbol_selection', 'formula_adjustment')),
  optimization_date TEXT NOT NULL,
  optimized_by_user_id TEXT NOT NULL,

  -- Performance Before/After
  ic_before REAL,
  icir_before REAL,
  ic_after REAL NOT NULL,
  icir_after REAL NOT NULL,
  rank_ic_after REAL,
  rank_icir_after REAL,
  improvement_percentage REAL,

  -- Test Scope
  symbols_tested TEXT NOT NULL,  -- JSON: ["BTC", "ETH", "BNB"]
  symbols_scope TEXT NOT NULL CHECK(symbols_scope IN ('single', 'multi', 'all')),
  symbols_count INTEGER NOT NULL,

  -- Additional Metrics
  return_rate REAL,
  sharpe_ratio REAL,
  max_drawdown REAL,
  win_rate REAL,

  -- Configuration
  parameters_used TEXT,  -- JSON: {"period1": 10, "period2": 20}
  formula_version TEXT,

  -- Backtest Period
  backtest_start_date TEXT,
  backtest_end_date TEXT,
  data_points_count INTEGER,
  notes TEXT,

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Constraints
  UNIQUE(factor_id, round_number),
  FOREIGN KEY(factor_id) REFERENCES factors(factor_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factor_opt_history_factor_id ON factor_optimization_history(factor_id);
CREATE INDEX IF NOT EXISTS idx_factor_opt_history_factor_round ON factor_optimization_history(factor_id, round_number);
CREATE INDEX IF NOT EXISTS idx_factor_opt_history_optimization_date ON factor_optimization_history(optimization_date);
CREATE INDEX IF NOT EXISTS idx_factor_opt_history_user_id ON factor_optimization_history(optimized_by_user_id);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS trigger_factor_opt_history_updated_at
AFTER UPDATE ON factor_optimization_history
FOR EACH ROW
BEGIN
  UPDATE factor_optimization_history
  SET updated_at = datetime('now')
  WHERE id = OLD.id;
END;

-- Schema Version
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- DOWN MIGRATION

DROP TRIGGER IF EXISTS trigger_factor_opt_history_updated_at;
DROP INDEX IF EXISTS idx_factor_opt_history_user_id;
DROP INDEX IF EXISTS idx_factor_opt_history_optimization_date;
DROP INDEX IF EXISTS idx_factor_opt_history_factor_round;
DROP INDEX IF EXISTS idx_factor_opt_history_factor_id;
DROP TABLE IF EXISTS factor_optimization_history;

DROP TRIGGER IF EXISTS trigger_factors_updated_at;
DROP INDEX IF EXISTS idx_factors_created_at;
DROP INDEX IF EXISTS idx_factors_ic;
DROP INDEX IF EXISTS idx_factors_status;
DROP INDEX IF EXISTS idx_factors_user_id;
DROP INDEX IF EXISTS idx_factors_category;
DROP INDEX IF EXISTS idx_factors_source;
DROP TABLE IF EXISTS factors;

DROP TABLE IF EXISTS schema_version;
