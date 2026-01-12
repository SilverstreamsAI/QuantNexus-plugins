/**
 * Backtest Plugin - QuantNexus Strategy Backtesting Engine
 *
 * Provides strategy backtesting with performance analytics.
 */

import type {
  PluginModule,
  PluginContext,
  PluginApi,
  DataSourcePlugin,
  OHLCVSeries,
  Disposable,
} from '@shared/types';
import type {
  BacktestConfig,
  BacktestRequest,
  BacktestResult,
  Strategy,
  BacktestEvent,
} from './types';
import { BacktestEngine, DEFAULT_CONFIG } from './engine/engine';
import { builtInStrategies } from './engine/executor';

// =============================================================================
// Backtest Plugin API
// =============================================================================

export interface BacktestPlugin extends PluginApi {
  // Engine access
  getEngine(): BacktestEngine;

  // Strategy management
  registerStrategy(strategy: Strategy): void;
  getStrategy(id: string): Strategy | undefined;
  getStrategies(): Strategy[];

  // Backtest execution
  run(request: BacktestRequest): Promise<BacktestResult>;
  stop(): void;
  isRunning(): boolean;

  // Configuration
  getConfig(): BacktestConfig;
  setConfig(config: Partial<BacktestConfig>): void;

  // Events
  onProgress(handler: (event: BacktestEvent) => void): () => void;

  // Results
  getLastResult(): BacktestResult | null;
  getResults(): BacktestResult[];
  clearResults(): void;
  exportResults(resultId: string, format: 'json' | 'csv'): Promise<string>;
}

// =============================================================================
// Plugin State
// =============================================================================

const disposables: Disposable[] = [];
let treeProvider: any = null;

// =============================================================================
// Backtest Plugin Implementation
// =============================================================================

class BacktestPluginImpl implements BacktestPlugin {
  private context: PluginContext;
  private engine: BacktestEngine;
  private dataPlugin: DataSourcePlugin | null = null;
  private results: BacktestResult[] = [];
  private lastResult: BacktestResult | null = null;

  constructor(context: PluginContext, config?: Partial<BacktestConfig>) {
    this.context = context;
    this.engine = new BacktestEngine(config);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async activate(): Promise<void> {
    this.context.log.info('Backtest plugin (UI) activating...');

    // Access windowApi from global (injected by host)
    const windowApi = (globalThis as { nexus?: { window: unknown } }).nexus?.window;

    if (windowApi) {
      const api = windowApi as {
        registerTreeDataProvider: (viewId: string, provider: unknown) => Disposable;
        registerViewProvider: (viewId: string, provider: unknown) => Disposable;
        setBreadcrumb: (items: unknown[]) => void;
        openView: (viewId: string, options?: unknown) => Promise<void>;
      };

      // Register Tree Data Provider
      const { BacktestTreeDataProvider } = await import('./providers/BacktestTreeDataProvider');
      treeProvider = new BacktestTreeDataProvider();
      disposables.push(api.registerTreeDataProvider('backtest.tree', treeProvider));
      this.context.log.info('BacktestTreeDataProvider registered');

      // Command: backtest.openWorkflow
      this.context.commands.register('backtest.openWorkflow', () => {
        api.setBreadcrumb([{ id: 'backtest', label: 'BACKTEST WORKFLOW' }]);
        api.openView('backtest.workflow');
      });
    } else {
      this.context.log.warn('windowApi not available - running in headless/fallback mode');
    }

    // Register commands
    this.registerCommands();

    // Setup event forwarding
    this.engine.onEvent((event) => {
      if (event.type === 'progress') {
        this.context.log.debug(`Backtest progress: ${JSON.stringify(event.data)}`);
      } else if (event.type === 'completed') {
        this.context.log.info('Backtest completed');
      } else if (event.type === 'error') {
        this.context.log.error(`Backtest error: ${JSON.stringify(event.data)}`);
      }
    });

    this.context.log.info('Backtest plugin activated');
  }

  async deactivate(): Promise<void> {
    this.context.log.info('Backtest plugin deactivating...');

    // Dispose all registered providers
    for (const disposable of disposables) {
      disposable.dispose();
    }
    disposables.length = 0;

    // Stop any running backtest
    if (this.engine.isRunning()) {
      this.engine.stop();
    }

    this.context.log.info('Backtest plugin deactivated');
  }

  // ===========================================================================
  // Engine Access
  // ===========================================================================

  getEngine(): BacktestEngine {
    return this.engine;
  }

  // ===========================================================================
  // Strategy Management
  // ===========================================================================

  registerStrategy(strategy: Strategy): void {
    this.engine.registerStrategy(strategy);
    this.context.log.info(`Strategy registered: ${strategy.id}`);
  }

  getStrategy(id: string): Strategy | undefined {
    return this.engine.getStrategy(id);
  }

  getStrategies(): Strategy[] {
    return this.engine.getStrategies();
  }

  // ===========================================================================
  // Backtest Execution
  // ===========================================================================

  async run(request: BacktestRequest): Promise<BacktestResult> {
    this.context.log.info(`Starting backtest: ${request.strategyId} on ${request.symbol}`);

    // Fetch data
    const data = await this.fetchData(request);
    if (!data) {
      throw new Error('Failed to fetch market data');
    }

    // Run backtest
    const result = await this.engine.run(request, data);

    // Store result
    this.lastResult = result;
    this.results.push(result);

    // Notify
    if (result.status === 'completed') {
      this.context.ui.showNotification(
        `Backtest completed: ${result.metrics.totalReturnPercent.toFixed(2)}% return`,
        result.metrics.totalReturnPercent >= 0 ? 'success' : 'warning'
      );
    } else if (result.status === 'error') {
      this.context.ui.showNotification(`Backtest failed: ${result.error}`, 'error');
    }

    return result;
  }

  stop(): void {
    this.engine.stop();
    this.context.log.info('Backtest stopped');
  }

  isRunning(): boolean {
    return this.engine.isRunning();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  getConfig(): BacktestConfig {
    return this.engine.getConfig();
  }

  setConfig(config: Partial<BacktestConfig>): void {
    this.engine.setConfig(config);
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  onProgress(handler: (event: BacktestEvent) => void): () => void {
    return this.engine.onEvent(handler);
  }

  // ===========================================================================
  // Results
  // ===========================================================================

  getLastResult(): BacktestResult | null {
    return this.lastResult;
  }

  getResults(): BacktestResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
    this.lastResult = null;
  }

  async exportResults(resultId: string, format: 'json' | 'csv'): Promise<string> {
    // Find result by index or use last
    const result = resultId === 'last'
      ? this.lastResult
      : this.results[parseInt(resultId, 10)];

    if (!result) {
      throw new Error('Result not found');
    }

    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    // CSV format - export trades
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'Commission', 'P&L', 'P&L %'];
    const rows = result.trades.map(t => [
      new Date(t.timestamp).toISOString(),
      t.symbol,
      t.side,
      t.quantity.toString(),
      t.price.toFixed(4),
      t.commission.toFixed(4),
      (t.pnl || 0).toFixed(2),
      (t.pnlPercent || 0).toFixed(2),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async fetchData(request: BacktestRequest): Promise<OHLCVSeries | null> {
    // Try to get data plugin
    if (!this.dataPlugin) {
      // In real implementation, would get from plugin manager
      // For now, create mock data
      this.context.log.warn('Data plugin not available, using mock data');
      return this.generateMockData(request);
    }

    const response = await this.dataPlugin.fetchHistoricalData({
      symbol: request.symbol,
      interval: request.interval,
      start: request.startDate,
      end: request.endDate,
    });

    return response.success ? response.data ?? null : null;
  }

  private generateMockData(request: BacktestRequest): OHLCVSeries {
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);
    const bars: OHLCVSeries['data'] = [];

    let price = 100;
    const msPerDay = 24 * 60 * 60 * 1000;

    for (let date = startDate.getTime(); date <= endDate.getTime(); date += msPerDay) {
      // Skip weekends
      const dayOfWeek = new Date(date).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Random walk
      const change = (Math.random() - 0.5) * 0.04; // +/- 2%
      const open = price;
      price = price * (1 + change);
      const close = price;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(1000000 + Math.random() * 1000000);

      bars.push({
        timestamp: date,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return {
      symbol: request.symbol,
      interval: request.interval,
      data: bars,
      start: bars[0]?.timestamp || 0,
      end: bars[bars.length - 1]?.timestamp || 0,
      source: 'mock',
    };
  }

  private registerCommands(): void {
    this.context.commands.register('backtest.run', async (
      strategyId: any,
      symbol: any,
      startDate: any,
      endDate: any
    ) => {
      return this.run({
        strategyId,
        symbol,
        interval: '1d',
        startDate,
        endDate,
      });
    });

    this.context.commands.register('backtest.stop', () => {
      this.stop();
    });

    this.context.commands.register('backtest.clear', () => {
      this.clearResults();
      this.context.ui.showNotification('Results cleared', 'info');
    });

    this.context.commands.register('backtest.export', async (format: any = 'json') => {
      if (!this.lastResult) {
        throw new Error('No results to export');
      }
      return this.exportResults('last', format);
    });

    this.context.commands.register('backtest.optimize', async (
      strategyId: any,
      symbol: any,
      startDate: any,
      endDate: any,
      paramRanges: any
    ) => {
      const request: BacktestRequest = {
        strategyId,
        symbol,
        interval: '1d',
        startDate,
        endDate,
      };

      const data = await this.fetchData(request);
      if (!data) {
        throw new Error('Failed to fetch data');
      }

      return this.engine.optimize(request, data, paramRanges);
    });
  }

  /**
   * Set data plugin reference (called by plugin manager)
   */
  setDataPlugin(dataPlugin: DataSourcePlugin): void {
    this.dataPlugin = dataPlugin;
  }
}

// =============================================================================
// Plugin Module Export
// =============================================================================

const plugin: PluginModule = {
  async activate(context: PluginContext): Promise<PluginApi> {
    // Get config from context or use defaults
    const config: Partial<BacktestConfig> = {
      initialCapital: 100000,
      commission: 0.001,
      slippage: 0.0001,
    };

    const backtestPlugin = new BacktestPluginImpl(context, config);
    await backtestPlugin.activate();

    return backtestPlugin;
  },

  async deactivate(): Promise<void> {
    // Cleanup handled by BacktestPluginImpl.deactivate()
  },
};

export default plugin;

// Re-export types and components
export * from './types';
export { BacktestEngine, DEFAULT_CONFIG } from './engine/engine';
export { PortfolioManager } from './engine/portfolio';
export { StrategyExecutor, builtInStrategies, getStrategy } from './engine/executor';
export { MetricsCalculator } from './engine/metrics';
