/**
 * Data Source Nexus - onInstall Hook
 *
 * TICKET_102: Default Plugin Lifecycle Implementation
 *
 * Initializes data storage infrastructure:
 * - Create cache directories
 * - Initialize SQLite database for metadata
 *
 * Full type definition: apps/desktop/src/shared/types/plugin-lifecycle.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Minimal type for this script (full definition in shared/types/plugin-lifecycle.ts)
interface InstallContext {
  storagePath: string;
  log: { debug(msg: string): void; info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  progress: { report(percent: number, message?: string): void };
}

export default async function onInstall(context: InstallContext): Promise<void> {
  const { storagePath, log, progress } = context;

  progress.report(0, 'Creating data directories...');

  // Create cache directories
  const dirs = [
    'cache/kline',        // K-line data cache
    'cache/tick',         // Tick data cache
    'cache/symbol',       // Symbol metadata cache
    'downloads',          // Downloaded data files
    'exports',            // Exported data
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(storagePath, dir), { recursive: true });
  }

  log.info('Data directories created');
  progress.report(30, 'Initializing database...');

  // Initialize SQLite database for metadata
  const dbPath = path.join(storagePath, 'data-source.db');

  // Use better-sqlite3 for sync operations (simpler for initialization)
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);

    db.exec(`
      -- Data sources configuration
      CREATE TABLE IF NOT EXISTS data_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      -- Download history tracking
      CREATE TABLE IF NOT EXISTS download_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        file_path TEXT,
        file_size INTEGER,
        row_count INTEGER,
        downloaded_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (source_id) REFERENCES data_sources(id)
      );

      -- Symbol metadata cache
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT,
        exchange TEXT,
        asset_type TEXT,
        metadata TEXT,
        last_updated INTEGER DEFAULT (unixepoch()),
        UNIQUE(source_id, symbol)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_download_source ON download_history(source_id);
      CREATE INDEX IF NOT EXISTS idx_download_symbol ON download_history(symbol);
      CREATE INDEX IF NOT EXISTS idx_symbols_source ON symbols(source_id);
    `);

    db.close();
    log.info('Database initialized successfully');
  } catch (error) {
    log.warn(`Database initialization skipped: ${error}`);
    // Continue without database - will be created on first use
  }

  progress.report(80, 'Creating default configuration...');

  // Create default configuration file
  const defaultConfig = {
    version: 1,
    cacheSettings: {
      maxCacheSizeMB: 1024,
      cacheRetentionDays: 30,
      autoCleanup: true,
    },
    downloadSettings: {
      concurrentDownloads: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
    },
  };

  const configPath = path.join(storagePath, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

  progress.report(100, 'Installation complete');
  log.info('Data Source Nexus installed successfully');
}
