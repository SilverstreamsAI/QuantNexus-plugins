/**
 * Quant Lab Nexus - onUpgrade Hook
 *
 * Updates configuration and migrates data.
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
  log: { debug(msg: string): void; info(msg: string): void; warn(msg: string): void };
  progress: { report(percent: number, message?: string): void };
}

export default async function onUpgrade(context: UpgradeContext): Promise<void> {
  const { storagePath, fromVersion, toVersion, log, progress } = context;

  log.info(`Upgrading Quant Lab Nexus from ${fromVersion} to ${toVersion}`);
  progress.report(0, 'Checking configuration...');

  // Update config
  const configPath = path.join(storagePath, 'config.json');
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Add new config fields if missing
    if (!config.settings) {
      config.settings = {
        maxConcurrentEvaluations: 2,
        cacheEnabled: true,
        defaultCombinator: 'weighted_average',
      };
    }

    config.version = 2;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    log.info('Configuration updated');
  } catch (error) {
    log.warn(`Config update skipped: ${error}`);
  }

  progress.report(100, 'Upgrade complete');
  log.info(`Upgrade from ${fromVersion} to ${toVersion} completed`);
}
