/**
 * Quant Lab Nexus - onUninstall Hook
 *
 * Cleans up Quant Lab data.
 *
 * Full type definition: apps/desktop/src/shared/types/plugin-lifecycle.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Minimal type for this script (full definition in shared/types/plugin-lifecycle.ts)
interface UninstallContext {
  storagePath: string;
  keepUserData: boolean;
  log: { info(msg: string): void; warn(msg: string): void };
}

export default async function onUninstall(context: UninstallContext): Promise<void> {
  const { storagePath, keepUserData, log } = context;

  // Always clean logs (diagnostic only)
  const logsDir = path.join(storagePath, 'logs');
  try {
    await fs.rm(logsDir, { recursive: true, force: true });
    log.info('Logs cleaned');
  } catch (error) {
    log.warn(`Failed to clean logs: ${error}`);
  }

  // Always clean cache
  const cacheDir = path.join(storagePath, 'cache');
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    log.info('Cache cleaned');
  } catch (error) {
    log.warn(`Failed to clean cache: ${error}`);
  }

  if (!keepUserData) {
    // Remove signals
    const signalsDir = path.join(storagePath, 'signals');
    try {
      await fs.rm(signalsDir, { recursive: true, force: true });
      log.info('Signals removed');
    } catch (error) {
      log.warn(`Failed to remove signals: ${error}`);
    }

    // Remove combinations
    const combinationsDir = path.join(storagePath, 'combinations');
    try {
      await fs.rm(combinationsDir, { recursive: true, force: true });
      log.info('Combinations removed');
    } catch (error) {
      log.warn(`Failed to remove combinations: ${error}`);
    }

    // Remove results
    const resultsDir = path.join(storagePath, 'results');
    try {
      await fs.rm(resultsDir, { recursive: true, force: true });
      log.info('Results removed');
    } catch (error) {
      log.warn(`Failed to remove results: ${error}`);
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

  log.info('Quant Lab Nexus uninstall complete');
}
