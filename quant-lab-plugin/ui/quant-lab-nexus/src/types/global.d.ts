/**
 * PLUGIN_TICKET_008: Ambient type declarations for quant-lab-nexus plugin.
 * Declares the subset of window.electronAPI used by this plugin.
 */

interface SignalSourceRecord {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  exported_at: string;
  analysis_algorithm_name: string;
  entry_algorithm_name: string;
  exit_algorithm_name: string | null;
  analysis_timeframe: string;
  entry_timeframe: string;
  exit_timeframe: string | null;
  backtest_sharpe: number | null;
  backtest_max_drawdown: number | null;
  backtest_win_rate: number | null;
  backtest_total_trades: number | null;
  backtest_profit_factor: number | null;
  symbol: string | null;
}

interface ElectronAPI {
  signalSource: {
    list: (filter?: { usageType?: 'signal' | 'exit' }) => Promise<{
      success: boolean;
      data?: SignalSourceRecord[];
      error?: string;
    }>;
  };

  // TICKET_276: Factor Library API (read-only from backend)
  factor: {
    list: (params?: { source?: string; category?: string; limit?: number; offset?: number }) => Promise<{
      success: boolean;
      data?: Array<{
        id: string;
        name: string;
        category: string;
        source: string;
        formula: string | null;
        ic: number | null;
        icir: number | null;
        sharpe: number | null;
      }>;
      error?: string;
    }>;
    detail: (factorId: string) => Promise<{
      success: boolean;
      data?: {
        id: string;
        name: string;
        category: string;
        source: string;
        formula: string | null;
        code: string | null;
        ic: number | null;
        icir: number | null;
        sharpe: number | null;
      };
      error?: string;
    }>;
  };

  // PLUGIN_TICKET_015: Subset of data API used by Alpha Factory
  data: {
    // Returns array directly (not {success, data} wrapper)
    searchSymbols: (query: string) => Promise<Array<{
      symbol: string;
      name?: string;
      exchange?: string;
      startTime?: string;
      endTime?: string;
    }>>;
    ensure: (config: {
      symbol: string;
      startDate: string;
      endDate: string;
      interval: string;
      provider?: string;
    }) => Promise<{
      success: boolean;
      dataPath?: string;
      error?: string;
    }>;
    ensureMultiTimeframe: (config: {
      symbol: string;
      startDate: string;
      endDate: string;
      timeframes: string[];
      provider?: string;
    }) => Promise<{
      success: boolean;
      dataPath?: string;
      dataFeeds?: Record<string, { dataPath: string }>;
      error?: string;
    }>;
  };

  // PLUGIN_TICKET_015: Subset of executor API used by Alpha Factory
  executor: {
    runBacktest: (config: {
      strategyPath: string;
      strategyName?: string;
      symbol: string;
      interval: string;
      startTime: number;
      endTime: number;
      dataPath?: string;
      dataSourceType?: string;
      dataFeeds?: Array<{ interval: string; dataPath: string }>;
      initialCapital?: number;
      orderSize?: number;
      orderSizeUnit?: string;
    }) => Promise<{
      success: boolean;
      taskId?: string;
      error?: string;
    }>;
    onProgress: (callback: (data: {
      taskId: string;
      percent: number;
      message: string;
    }) => void) => () => void;
    onCompleted: (callback: (data: {
      taskId: string;
      result: {
        success: boolean;
        metrics?: {
          totalPnl: number;
          totalReturn: number;
          sharpeRatio: number;
          maxDrawdown: number;
          totalTrades: number;
          winRate: number;
        };
      };
    }) => void) => () => void;
    onError: (callback: (data: {
      taskId: string;
      error: string;
    }) => void) => () => void;
    onIncrement: (callback: (data: {
      taskId: string;
      increment: {
        processedBars: number;
        totalBars: number;
      };
    }) => void) => () => void;
  };

  // PLUGIN_TICKET_011: Alpha Factory config persistence
  alphaFactory: {
    saveConfig: (config: {
      id?: string;
      name: string;
      signalMethod: string;
      lookback: number;
      signals: import('../types').SignalChip[];
      exitMethod: string;
      // TICKET_275: ExitRules object or legacy SignalChip[] array
      exits: import('../types').ExitRules | import('../types').SignalChip[];
      // TICKET_276: Factor layer fields
      factors?: import('../types').FactorChip[];
      factorMethod?: string;
      factorLookback?: number;
    }) => Promise<{
      success: boolean;
      id?: string;
      error?: string;
    }>;

    loadConfig: (id?: string) => Promise<{
      success: boolean;
      data?: {
        id: string;
        name: string;
        signalMethod: string;
        lookback: number;
        signals: import('../types').SignalChip[];
        exitMethod: string;
        // TICKET_275: Raw parsed value (format detection done in hook)
        exits: unknown;
        // TICKET_276: Factor layer fields
        factors: import('../types').FactorChip[];
        factorMethod: string;
        factorLookback: number;
        createdAt: string;
        updatedAt: string;
      } | null;
      error?: string;
    }>;

    listConfigs: () => Promise<{
      success: boolean;
      data?: Array<{
        id: string;
        name: string;
        signalMethod: string;
        signalCount: number;
        factorCount: number;
        exitCount: number;
        isActive: boolean;
        updatedAt: string;
      }>;
      error?: string;
    }>;

    deleteConfig: (id: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    // PLUGIN_TICKET_015: Generate strategy and return path
    run: (request: {
      signalIds: string[];
      signalMethod: string;
      lookback: number;
      exitMethod: string;
      exitRules: import('../types').ExitRules;
      // TICKET_276: Factor layer
      factorIds?: string[];
      factorMethod?: string;
      factorLookback?: number;
    }) => Promise<{
      success: boolean;
      taskId?: string;
      strategyPath?: string;
      error?: string;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
