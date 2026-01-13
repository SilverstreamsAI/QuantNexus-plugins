"use strict";
/**
 * Backtest Nexus - onInstall Hook
 *
 * TICKET_102: Default Plugin Lifecycle Implementation
 *
 * Sets up Python environment and installs dependencies:
 * - Create directories for results, logs, checkpoints
 * - Create Python virtual environment
 * - Install Python dependencies (backtrader, etc.)
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
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function onInstall(context) {
    const { pluginPath, storagePath, platform, log, progress } = context;
    progress.report(0, 'Creating backtest directories...');
    // Create directories
    const dirs = [
        'results', // Backtest results
        'checkpoints', // Execution checkpoints
        'logs', // Engine logs
        'cache', // Data cache
    ];
    for (const dir of dirs) {
        await fs.mkdir(path.join(storagePath, dir), { recursive: true });
    }
    log.info('Backtest directories created');
    progress.report(10, 'Checking Python installation...');
    // Check Python availability
    const pythonCmd = platform === 'win32' ? 'python' : 'python3';
    try {
        const { stdout } = await execAsync(`${pythonCmd} --version`);
        const pythonVersion = stdout.trim();
        log.info(`Found Python: ${pythonVersion}`);
        // Check Python version (require 3.8+)
        const versionMatch = pythonVersion.match(/Python (\d+)\.(\d+)/);
        if (versionMatch) {
            const major = parseInt(versionMatch[1], 10);
            const minor = parseInt(versionMatch[2], 10);
            if (major < 3 || (major === 3 && minor < 8)) {
                throw new Error(`Python 3.8+ required, found ${pythonVersion}`);
            }
        }
    }
    catch (error) {
        log.error('Python check failed');
        throw new Error('Python 3.8+ is required for Backtest Nexus. ' +
            'Please install Python and ensure it is in your PATH.');
    }
    progress.report(20, 'Creating Python virtual environment...');
    // Create virtual environment
    const venvPath = path.join(storagePath, 'venv');
    try {
        // Remove existing venv if present
        await fs.rm(venvPath, { recursive: true, force: true });
        // Create new venv
        await execAsync(`${pythonCmd} -m venv "${venvPath}"`, {
            timeout: 60000, // 1 minute
        });
        log.info('Virtual environment created');
    }
    catch (error) {
        log.error(`Failed to create venv: ${error}`);
        throw new Error('Failed to create Python virtual environment');
    }
    progress.report(40, 'Installing Python dependencies...');
    // Get pip and python paths
    const isWindows = platform === 'win32';
    const binDir = isWindows ? 'Scripts' : 'bin';
    const pipPath = path.join(venvPath, binDir, isWindows ? 'pip.exe' : 'pip');
    const pythonPath = path.join(venvPath, binDir, isWindows ? 'python.exe' : 'python');
    // Find requirements.txt
    const requirementsPath = path.join(pluginPath, 'src', 'engine', 'requirements.txt');
    try {
        // First upgrade pip
        await execAsync(`"${pythonPath}" -m pip install --upgrade pip`, {
            timeout: 120000, // 2 minutes
        });
        progress.report(50, 'Installing backtrader and dependencies...');
        // Install requirements
        await execAsync(`"${pipPath}" install -r "${requirementsPath}"`, {
            timeout: 300000, // 5 minutes
        });
        log.info('Python dependencies installed');
    }
    catch (error) {
        log.error(`Failed to install dependencies: ${error}`);
        throw new Error('Failed to install Python dependencies. ' +
            'Please check your internet connection and try again.');
    }
    progress.report(80, 'Verifying installation...');
    // Verify backtrader installation
    try {
        const { stdout } = await execAsync(`"${pythonPath}" -c "import backtrader; print(backtrader.__version__)"`, { timeout: 30000 });
        log.info(`Backtrader version: ${stdout.trim()}`);
    }
    catch (error) {
        log.warn(`Backtrader verification failed: ${error}`);
        // Don't fail - may work with alternative engines
    }
    progress.report(90, 'Creating configuration...');
    // Create default configuration
    const defaultConfig = {
        version: 1,
        pythonPath: pythonPath,
        engineSettings: {
            defaultEngine: 'backtrader',
            maxConcurrentBacktests: 2,
            checkpointInterval: 100, // Save checkpoint every 100 bars
        },
        resultSettings: {
            keepLastN: 50,
            autoExport: false,
            exportFormat: 'json',
        },
    };
    const configPath = path.join(storagePath, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    // Initialize results database using Database Protocol
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
            // Backtest runs
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS backtest_runs (
          id TEXT PRIMARY KEY,
          name TEXT,
          strategy_id TEXT,
          engine TEXT NOT NULL,
          config TEXT,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          error TEXT
        )
      `);
            // Backtest results
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS backtest_results (
          run_id TEXT PRIMARY KEY,
          total_return REAL,
          sharpe_ratio REAL,
          max_drawdown REAL,
          win_rate REAL,
          total_trades INTEGER,
          metrics TEXT,
          equity_curve TEXT,
          FOREIGN KEY (run_id) REFERENCES backtest_runs(id)
        )
      `);
            // Trade history
            await tx.execute(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL,
          symbol TEXT,
          direction TEXT,
          entry_time INTEGER,
          exit_time INTEGER,
          entry_price REAL,
          exit_price REAL,
          size REAL,
          pnl REAL,
          FOREIGN KEY (run_id) REFERENCES backtest_runs(id)
        )
      `);
            // Create indexes
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_runs_strategy ON backtest_runs(strategy_id)');
            await tx.execute('CREATE INDEX IF NOT EXISTS idx_trades_run ON trades(run_id)');
        });
        log.info('Results database initialized');
    }
    catch (error) {
        log.error(`Database initialization failed: ${error}`);
        throw error;
    }
    progress.report(100, 'Installation complete');
    log.info('Backtest Nexus installed successfully');
}
