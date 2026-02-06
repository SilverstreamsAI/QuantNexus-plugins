/**
 * Quant Lab Nexus - onInstall Hook
 *
 * Sets up directories and initializes database for Alpha Factory.
 *
 * Full type definition: apps/desktop/src/shared/types/plugin-lifecycle.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { InstallContext } from '../../../apps/desktop/src/shared/types/plugin-lifecycle';

export default async function onInstall(context: InstallContext): Promise<void> {
  const { storagePath, log, progress, database } = context;

  progress.report(0, 'Creating Quant Lab directories...');

  // Create directories
  const dirs = [
    'signals',      // Signal definitions
    'combinations', // Signal combinations
    'results',      // Evaluation results
    'cache',        // Computation cache
    'logs',         // Plugin logs
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
    await database.execute(
      "INSERT OR IGNORE INTO _plugin_schema (key, value) VALUES ('version', '1')"
    );

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
  } catch (error) {
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
