"use strict";
/**
 * Quant Lab Nexus - onInstall Hook
 *
 * Sets up directories and initializes database for Alpha Factory.
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
    const { storagePath, log, progress, database } = context;
    progress.report(0, 'Creating Quant Lab directories...');
    // Create directories
    const dirs = [
        'signals', // Signal definitions
        'combinations', // Signal combinations
        'results', // Evaluation results
        'cache', // Computation cache
        'logs', // Plugin logs
    ];
    for (const dir of dirs) {
        await fs.mkdir(path.join(storagePath, dir), { recursive: true });
    }
    log.info('Quant Lab directories created');
    progress.report(30, 'Initializing database...');
    // Initialize database using Database Protocol
    try {
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
            // Signal library
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS signals (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER
        )
      `);
            // Signal combinations
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS combinations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          signals TEXT NOT NULL,
          combinator_type TEXT NOT NULL,
          weights TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER
        )
      `);
            // Evaluation results
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS evaluations (
          id TEXT PRIMARY KEY,
          combination_id TEXT NOT NULL,
          metrics TEXT,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          FOREIGN KEY (combination_id) REFERENCES combinations(id)
        )
      `);
            // Create indexes
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type)');
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_combinations_name ON combinations(name)');
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_evaluations_combination ON evaluations(combination_id)');
        });
        log.info('Database initialized');
    }
    catch (error) {
        log.error(`Database initialization failed: ${error}`);
        throw error;
    }
    progress.report(80, 'Creating configuration...');
    // Create default configuration
    const defaultConfig = {
        version: 1,
        settings: {
            maxConcurrentEvaluations: 2,
            cacheEnabled: true,
            defaultCombinator: 'weighted_average',
        },
    };
    const configPath = path.join(storagePath, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    progress.report(100, 'Installation complete');
    log.info('Quant Lab Nexus installed successfully');
}
