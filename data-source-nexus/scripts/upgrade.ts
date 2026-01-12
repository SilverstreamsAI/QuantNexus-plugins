/**
 * Data Source Nexus - onUpgrade Hook
 *
 * TICKET_102: Default Plugin Lifecycle Implementation
 *
 * Handles schema migrations and configuration updates.
 *
 * Full type definition: apps/desktop/src/shared/types/plugin-lifecycle.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Minimal type for this script (full definition in shared/types/plugin-lifecycle.ts)
interface UpgradeContext {
  storagePath: string;
  fromVersion: string;
  toVersion: string;
  log: { debug(msg: string): void; info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  progress: { report(percent: number, message?: string): void };
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

export default async function onUpgrade(context: UpgradeContext): Promise<void> {
  const { storagePath, fromVersion, toVersion, log, progress } = context;

  log.info(`Upgrading Data Source Nexus from ${fromVersion} to ${toVersion}`);
  progress.report(0, 'Checking upgrade requirements...');

  const dbPath = path.join(storagePath, 'data-source.db');

  // Database migrations
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);

    // Migration: v1.1.x to v1.2.x
    if (compareVersions(fromVersion, '1.2.0') < 0 && compareVersions(toVersion, '1.2.0') >= 0) {
      progress.report(20, 'Migrating database schema to v1.2...');

      // Add updated_at column to data_sources if missing
      try {
        db.exec(`
          ALTER TABLE data_sources ADD COLUMN updated_at INTEGER DEFAULT (unixepoch());
        `);
        log.info('Added updated_at column to data_sources');
      } catch {
        log.debug('updated_at column already exists');
      }

      // Add file_size and row_count to download_history if missing
      try {
        db.exec(`
          ALTER TABLE download_history ADD COLUMN file_size INTEGER;
        `);
        log.info('Added file_size column');
      } catch {
        log.debug('file_size column already exists');
      }

      try {
        db.exec(`
          ALTER TABLE download_history ADD COLUMN row_count INTEGER;
        `);
        log.info('Added row_count column');
      } catch {
        log.debug('row_count column already exists');
      }

      // Add symbols table if missing
      try {
        db.exec(`
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
          CREATE INDEX IF NOT EXISTS idx_symbols_source ON symbols(source_id);
        `);
        log.info('Added symbols table');
      } catch {
        log.debug('symbols table already exists');
      }

      log.info('Database schema updated for v1.2.0');
    }

    db.close();
  } catch (error) {
    log.warn(`Database migration skipped: ${error}`);
  }

  progress.report(60, 'Updating configuration...');

  // Update configuration with new defaults
  const configPath = path.join(storagePath, 'config.json');
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Add new config sections if missing
    if (!config.downloadSettings) {
      config.downloadSettings = {
        concurrentDownloads: 3,
        retryAttempts: 3,
        retryDelayMs: 1000,
      };
    }

    if (!config.cacheSettings.autoCleanup) {
      config.cacheSettings.autoCleanup = true;
    }

    config.version = 2;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    log.info('Configuration updated');
  } catch (error) {
    log.warn(`Config update skipped: ${error}`);
  }

  progress.report(90, 'Creating new directories...');

  // Create new directories that may not exist in older versions
  const newDirs = ['exports'];
  for (const dir of newDirs) {
    await fs.mkdir(path.join(storagePath, dir), { recursive: true });
  }

  progress.report(100, 'Upgrade complete');
  log.info(`Upgrade from ${fromVersion} to ${toVersion} completed`);
}
