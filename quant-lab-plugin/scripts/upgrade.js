"use strict";
/**
 * Quant Lab Nexus - onUpgrade Hook
 *
 * Updates configuration and migrates data.
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
exports.default = onUpgrade;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
async function onUpgrade(context) {
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
    }
    catch (error) {
        log.warn(`Config update skipped: ${error}`);
    }
    progress.report(100, 'Upgrade complete');
    log.info(`Upgrade from ${fromVersion} to ${toVersion} completed`);
}
