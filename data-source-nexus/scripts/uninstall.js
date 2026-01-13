"use strict";
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
exports.default = onUninstall;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
async function onUninstall(context) {
    const { storagePath, keepUserData, log } = context;
    // Always clean cache (can be regenerated)
    const cacheDir = path.join(storagePath, 'cache');
    try {
        await fs.rm(cacheDir, { recursive: true, force: true });
        log.info('Cache directory cleaned');
    }
    catch (error) {
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
        }
        catch (error) {
            log.warn(`Failed to remove database: ${error}`);
        }
        // Remove downloads
        const downloadsDir = path.join(storagePath, 'downloads');
        try {
            await fs.rm(downloadsDir, { recursive: true, force: true });
            log.info('Downloads removed');
        }
        catch (error) {
            log.warn(`Failed to remove downloads: ${error}`);
        }
        // Remove exports
        const exportsDir = path.join(storagePath, 'exports');
        try {
            await fs.rm(exportsDir, { recursive: true, force: true });
            log.info('Exports removed');
        }
        catch (error) {
            log.warn(`Failed to remove exports: ${error}`);
        }
        // Remove config
        const configPath = path.join(storagePath, 'config.json');
        try {
            await fs.rm(configPath, { force: true });
            log.info('Configuration removed');
        }
        catch (error) {
            log.warn(`Failed to remove config: ${error}`);
        }
        log.info('All user data removed');
    }
    else {
        log.info('User data preserved at: ' + storagePath);
    }
    log.info('Data Source Nexus uninstall complete');
}
