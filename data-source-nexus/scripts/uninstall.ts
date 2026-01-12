/**
 * Data Source Nexus - onUninstall Hook
 *
 * TICKET_102: Default Plugin Lifecycle Implementation
 *
 * Cleans up data storage:
 * - Always remove cache
 * - Optionally preserve user data (downloads, config)
 *
 * Full type definition: apps/desktop/src/shared/types/plugin-lifecycle.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Minimal type for this script (full definition in shared/types/plugin-lifecycle.ts)
interface UninstallContext {
  storagePath: string;
  keepUserData: boolean;
  log: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

export default async function onUninstall(context: UninstallContext): Promise<void> {
  const { storagePath, keepUserData, log } = context;

  // Always clean cache (can be regenerated)
  const cacheDir = path.join(storagePath, 'cache');
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    log.info('Cache directory cleaned');
  } catch (error) {
    log.warn(`Failed to clean cache: ${error}`);
  }

  if (!keepUserData) {
    // Remove database
    const dbPath = path.join(storagePath, 'data-source.db');
    try {
      await fs.rm(dbPath, { force: true });
      // Also remove journal files
      await fs.rm(`${dbPath}-wal`, { force: true });
      await fs.rm(`${dbPath}-shm`, { force: true });
      log.info('Database removed');
    } catch (error) {
      log.warn(`Failed to remove database: ${error}`);
    }

    // Remove downloads
    const downloadsDir = path.join(storagePath, 'downloads');
    try {
      await fs.rm(downloadsDir, { recursive: true, force: true });
      log.info('Downloads removed');
    } catch (error) {
      log.warn(`Failed to remove downloads: ${error}`);
    }

    // Remove exports
    const exportsDir = path.join(storagePath, 'exports');
    try {
      await fs.rm(exportsDir, { recursive: true, force: true });
      log.info('Exports removed');
    } catch (error) {
      log.warn(`Failed to remove exports: ${error}`);
    }

    // Remove config
    const configPath = path.join(storagePath, 'config.json');
    try {
      await fs.rm(configPath, { force: true });
      log.info('Configuration removed');
    } catch (error) {
      log.warn(`Failed to remove config: ${error}`);
    }

    log.info('All user data removed');
  } else {
    log.info('User data preserved at: ' + storagePath);
  }

  log.info('Data Source Nexus uninstall complete');
}
