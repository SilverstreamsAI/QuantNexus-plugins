/**
 * SQLite Storage Implementation
 *
 * Persistent storage for market data using better-sqlite3.
 */

import type Database from 'better-sqlite3';
import type {
  DataStorage,
  StorageConfig,
  StorageStats,
  StorageQueryOptions,
  StorageQueryResult,
  BulkInsertOptions,
  BulkInsertResult,
  TimeRange,
  ListStoredSymbolsOptions,
  ExportOptions,
  ExportResult,
  ImportOptions,
  ImportResult,
  Transaction,
  IntervalStats,
} from '@shared/types';
import type {
  OHLCV,
  OHLCVSeries,
  SymbolInfo,
  Interval,
  Timestamp,
} from '@shared/types';

// =============================================================================
// SQL Schemas
// =============================================================================

const OHLCV_TABLE = `
CREATE TABLE IF NOT EXISTS ohlcv_data (
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  vwap REAL,
  trades INTEGER,
  PRIMARY KEY (symbol, interval, timestamp)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_interval
  ON ohlcv_data(symbol, interval);

CREATE INDEX IF NOT EXISTS idx_ohlcv_timestamp
  ON ohlcv_data(timestamp);
`;

const SYMBOLS_TABLE = `
CREATE TABLE IF NOT EXISTS symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  exchange TEXT NOT NULL,
  currency TEXT NOT NULL,
  metadata TEXT,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
`;

// =============================================================================
// DataPluginStorage Implementation
// =============================================================================

export class DataPluginStorage implements DataStorage {
  private db: Database.Database | null = null;
  private config: StorageConfig | null = null;
  private ready = false;

  // Prepared statements (cached for performance)
  private stmtInsertBar: Database.Statement | null = null;
  private stmtQueryBars: Database.Statement | null = null;
  private stmtGetLatestBar: Database.Statement | null = null;
  private stmtInsertSymbol: Database.Statement | null = null;
  private stmtGetSymbol: Database.Statement | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async initialize(config: StorageConfig): Promise<void> {
    this.config = config;

    // Dynamic import for better-sqlite3 (Node.js module)
    const BetterSqlite3 = await import('better-sqlite3');
    this.db = new BetterSqlite3.default(config.dbPath);

    // Configure database
    if (config.walMode !== false) {
      this.db.pragma('journal_mode = WAL');
    }
    if (config.cacheSize) {
      this.db.pragma(`cache_size = ${config.cacheSize}`);
    }
    if (config.mmapSize) {
      this.db.pragma(`mmap_size = ${config.mmapSize}`);
    }
    if (config.autoVacuum !== false) {
      this.db.pragma('auto_vacuum = INCREMENTAL');
    }

    // Performance optimizations
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');

    // Create tables
    this.db.exec(OHLCV_TABLE);
    this.db.exec(SYMBOLS_TABLE);

    // Prepare statements
    this.prepareStatements();

    this.ready = true;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  private prepareStatements(): void {
    if (!this.db) return;

    this.stmtInsertBar = this.db.prepare(`
      INSERT OR REPLACE INTO ohlcv_data
        (symbol, interval, timestamp, open, high, low, close, volume, vwap, trades)
      VALUES
        (@symbol, @interval, @timestamp, @open, @high, @low, @close, @volume, @vwap, @trades)
    `);

    this.stmtQueryBars = this.db.prepare(`
      SELECT timestamp, open, high, low, close, volume, vwap, trades
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);

    this.stmtGetLatestBar = this.db.prepare(`
      SELECT timestamp, open, high, low, close, volume, vwap, trades
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    this.stmtInsertSymbol = this.db.prepare(`
      INSERT OR REPLACE INTO symbols
        (symbol, name, type, exchange, currency, metadata, updated_at)
      VALUES
        (@symbol, @name, @type, @exchange, @currency, @metadata, @updatedAt)
    `);

    this.stmtGetSymbol = this.db.prepare(`
      SELECT symbol, name, type, exchange, currency, metadata
      FROM symbols
      WHERE symbol = ?
    `);
  }

  // ===========================================================================
  // OHLCV Operations
  // ===========================================================================

  async storeOHLCV(series: OHLCVSeries, options?: BulkInsertOptions): Promise<BulkInsertResult> {
    if (!this.db || !this.stmtInsertBar) {
      throw new Error('Storage not initialized');
    }

    const startTime = Date.now();
    const batchSize = options?.batchSize || 1000;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ index: number; timestamp: Timestamp; error: string }> = [];

    const insertMany = this.db.transaction((bars: OHLCV[]) => {
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        try {
          this.stmtInsertBar!.run({
            symbol: series.symbol,
            interval: series.interval,
            timestamp: bar.timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            vwap: bar.vwap ?? null,
            trades: bar.trades ?? null,
          });
          inserted++;
        } catch (err) {
          if (options?.onConflict === 'ignore') {
            skipped++;
          } else {
            errors.push({
              index: i,
              timestamp: bar.timestamp,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      }
    });

    // Process in batches
    for (let i = 0; i < series.data.length; i += batchSize) {
      const batch = series.data.slice(i, i + batchSize);
      insertMany(batch);
    }

    return {
      inserted,
      updated,
      skipped,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  async storeBar(symbol: string, interval: Interval, bar: OHLCV): Promise<void> {
    if (!this.stmtInsertBar) {
      throw new Error('Storage not initialized');
    }

    this.stmtInsertBar.run({
      symbol,
      interval,
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      vwap: bar.vwap ?? null,
      trades: bar.trades ?? null,
    });
  }

  async queryOHLCV(options: StorageQueryOptions): Promise<StorageQueryResult> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const startTime = Date.now();
    const start = this.normalizeTimestamp(options.start);
    const end = this.normalizeTimestamp(options.end) || Date.now();

    let sql = `
      SELECT timestamp, open, high, low, close, volume, vwap, trades
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
    `;

    const params: unknown[] = [options.symbol, options.interval, start, end];

    if (options.minVolume) {
      sql += ' AND volume >= ?';
      params.push(options.minVolume);
    }

    sql += ` ORDER BY timestamp ${options.order === 'desc' ? 'DESC' : 'ASC'}`;

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      vwap: number | null;
      trades: number | null;
    }>;

    const data: OHLCV[] = rows.map(row => ({
      timestamp: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      vwap: row.vwap ?? undefined,
      trades: row.trades ?? undefined,
    }));

    // Get total count
    const countSql = `
      SELECT COUNT(*) as count
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
    `;
    const countResult = this.db.prepare(countSql).get(
      options.symbol, options.interval, start, end
    ) as { count: number };

    return {
      data,
      totalCount: countResult.count,
      hasMore: options.limit ? countResult.count > (options.offset || 0) + data.length : false,
      queryTimeMs: Date.now() - startTime,
      fromCache: false,
    };
  }

  async getLatestBar(symbol: string, interval: Interval): Promise<OHLCV | null> {
    if (!this.stmtGetLatestBar) {
      throw new Error('Storage not initialized');
    }

    const row = this.stmtGetLatestBar.get(symbol, interval) as {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      vwap: number | null;
      trades: number | null;
    } | undefined;

    if (!row) return null;

    return {
      timestamp: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      vwap: row.vwap ?? undefined,
      trades: row.trades ?? undefined,
    };
  }

  async getTimeRange(symbol: string, interval: Interval): Promise<TimeRange | null> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const row = this.db.prepare(`
      SELECT MIN(timestamp) as start, MAX(timestamp) as end
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ?
    `).get(symbol, interval) as { start: number | null; end: number | null };

    if (!row.start || !row.end) return null;

    return { start: row.start, end: row.end };
  }

  async hasData(symbol: string, interval: Interval, start: Timestamp, end: Timestamp): Promise<boolean> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM ohlcv_data
      WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
    `).get(symbol, interval, start, end) as { count: number };

    return row.count > 0;
  }

  async findGaps(
    symbol: string,
    interval: Interval,
    start: Timestamp,
    end: Timestamp
  ): Promise<TimeRange[]> {
    // TODO: Implement gap detection based on interval
    // For now, return empty array
    return [];
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  async storeSymbolInfo(info: SymbolInfo): Promise<void> {
    if (!this.stmtInsertSymbol) {
      throw new Error('Storage not initialized');
    }

    this.stmtInsertSymbol.run({
      symbol: info.symbol,
      name: info.name,
      type: info.type,
      exchange: info.exchange,
      currency: info.currency,
      metadata: JSON.stringify({
        pricePrecision: info.pricePrecision,
        volumePrecision: info.volumePrecision,
        minOrderSize: info.minOrderSize,
        tickSize: info.tickSize,
        sector: info.sector,
        industry: info.industry,
        description: info.description,
        logo: info.logo,
        tradable: info.tradable,
        marginable: info.marginable,
        shortable: info.shortable,
        timezone: info.timezone,
      }),
      updatedAt: Date.now(),
    });
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
    if (!this.stmtGetSymbol) {
      throw new Error('Storage not initialized');
    }

    const row = this.stmtGetSymbol.get(symbol) as {
      symbol: string;
      name: string;
      type: string;
      exchange: string;
      currency: string;
      metadata: string | null;
    } | undefined;

    if (!row) return null;

    const metadata = row.metadata ? JSON.parse(row.metadata) : {};

    return {
      symbol: row.symbol,
      name: row.name,
      type: row.type as SymbolInfo['type'],
      exchange: row.exchange as SymbolInfo['exchange'],
      currency: row.currency,
      ...metadata,
    };
  }

  async listStoredSymbols(options?: ListStoredSymbolsOptions): Promise<string[]> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    let sql = 'SELECT DISTINCT symbol FROM ohlcv_data';
    const params: unknown[] = [];

    if (options?.interval) {
      sql += ' WHERE interval = ?';
      params.push(options.interval);
    }

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{ symbol: string }>;
    return rows.map(r => r.symbol);
  }

  async searchStoredSymbols(query: string): Promise<SymbolInfo[]> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const rows = this.db.prepare(`
      SELECT symbol, name, type, exchange, currency, metadata
      FROM symbols
      WHERE symbol LIKE ? OR name LIKE ?
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`) as Array<{
      symbol: string;
      name: string;
      type: string;
      exchange: string;
      currency: string;
      metadata: string | null;
    }>;

    return rows.map(row => {
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};
      return {
        symbol: row.symbol,
        name: row.name,
        type: row.type as SymbolInfo['type'],
        exchange: row.exchange as SymbolInfo['exchange'],
        currency: row.currency,
        ...metadata,
      };
    });
  }

  // ===========================================================================
  // Data Management
  // ===========================================================================

  async deleteSymbolData(symbol: string, interval?: Interval): Promise<number> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    let sql = 'DELETE FROM ohlcv_data WHERE symbol = ?';
    const params: unknown[] = [symbol];

    if (interval) {
      sql += ' AND interval = ?';
      params.push(interval);
    }

    const result = this.db.prepare(sql).run(...params);
    return result.changes;
  }

  async deleteOldData(before: Timestamp): Promise<number> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const result = this.db.prepare(
      'DELETE FROM ohlcv_data WHERE timestamp < ?'
    ).run(before);

    return result.changes;
  }

  async deleteDataRange(
    symbol: string,
    interval: Interval,
    start: Timestamp,
    end: Timestamp
  ): Promise<number> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const result = this.db.prepare(`
      DELETE FROM ohlcv_data
      WHERE symbol = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
    `).run(symbol, interval, start, end);

    return result.changes;
  }

  async compact(): Promise<void> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }
    this.db.pragma('incremental_vacuum');
  }

  async optimize(): Promise<void> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }
    this.db.pragma('optimize');
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  async getStats(): Promise<StorageStats> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const sizeResult = this.db.prepare(
      "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
    ).get() as { size: number };

    const countResult = this.db.prepare(
      'SELECT COUNT(*) as count FROM ohlcv_data'
    ).get() as { count: number };

    const symbolsResult = this.db.prepare(
      'SELECT COUNT(DISTINCT symbol) as count FROM ohlcv_data'
    ).get() as { count: number };

    const rangeResult = this.db.prepare(
      'SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM ohlcv_data'
    ).get() as { oldest: number | null; newest: number | null };

    return {
      dbSizeBytes: sizeResult.size,
      totalBars: countResult.count,
      totalSymbols: symbolsResult.count,
      oldestData: rangeResult.oldest || 0,
      newestData: rangeResult.newest || 0,
      intervalStats: new Map(),
    };
  }

  async getBarCount(symbol: string, interval: Interval): Promise<number> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM ohlcv_data WHERE symbol = ? AND interval = ?'
    ).get(symbol, interval) as { count: number };

    return result.count;
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  async exportToCSV(
    symbol: string,
    interval: Interval,
    filePath: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    // TODO: Implement CSV export using Node.js fs
    throw new Error('Export not implemented yet');
  }

  async importFromCSV(
    symbol: string,
    interval: Interval,
    filePath: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    // TODO: Implement CSV import using Node.js fs
    throw new Error('Import not implemented yet');
  }

  // ===========================================================================
  // Transactions
  // ===========================================================================

  async beginTransaction(): Promise<Transaction> {
    if (!this.db) {
      throw new Error('Storage not initialized');
    }

    this.db.exec('BEGIN TRANSACTION');

    return {
      commit: async () => {
        this.db?.exec('COMMIT');
      },
      rollback: async () => {
        this.db?.exec('ROLLBACK');
      },
      execute: async <T>(operation: () => Promise<T>): Promise<T> => {
        try {
          const result = await operation();
          this.db?.exec('COMMIT');
          return result;
        } catch (error) {
          this.db?.exec('ROLLBACK');
          throw error;
        }
      },
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private normalizeTimestamp(value?: Timestamp | string): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    return new Date(value).getTime();
  }
}
