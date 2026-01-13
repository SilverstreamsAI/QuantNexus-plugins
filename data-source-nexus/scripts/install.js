"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = onInstall;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
async function onInstall(context) {
    const { storagePath, log, progress } = context;
    progress.report(0, 'Creating data directories...');
    // Create cache directories
    const dirs = [
        'cache/kline', // K-line data cache
        'cache/tick', // Tick data cache
        'cache/symbol', // Symbol metadata cache
        'downloads', // Downloaded data files
        'exports', // Exported data
    ];
    for (const dir of dirs) {
        await fs.mkdir(path.join(storagePath, dir), { recursive: true });
    }
    log.info('Data directories created');
    progress.report(30, 'Initializing database...');
    // Initialize SQLite database using Database Protocol
    try {
        const { database } = context;
        // Create schema version table
        await database.execute(`
      CREATE TABLE IF NOT EXISTS _plugin_schema (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
        // Initialize schema version
        await database.execute("INSERT OR IGNORE INTO _plugin_schema (key, value) VALUES ('version', '1')");
        // Create tables in a transaction
        await database.transaction(async (tx) => {
            // Data sources configuration
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS data_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        )
      `);
            // Download history tracking
            await tx.execute(`
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
        )
      `);
            // Symbol metadata cache
            await tx.execute(`
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
        )
      `);
            // Create indexes
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_download_source ON download_history(source_id)');
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_download_symbol ON download_history(symbol)');
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_symbols_source ON symbols(source_id)');
        });
        log.info('Database initialized successfully');
    }
    catch (error) {
        log.error(`Database initialization failed: ${error}`);
        throw error;
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
