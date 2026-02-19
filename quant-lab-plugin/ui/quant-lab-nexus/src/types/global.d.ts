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

  // TICKET_278: Factor Mining API (task-based async via nona_server)
  factor: {
    mining: {
      start: (params: { loopCount: number; hypothesisSource: string; maxDuration?: string }) => Promise<{
        success: boolean;
        data?: { taskId: string; taskType: string; status: string; createdAt: string };
        error?: string;
      }>;
      startFromReports: (params: { reportUrls: string[]; maxReports?: number; maxDuration?: string }) => Promise<{
        success: boolean;
        data?: { taskId: string; taskType: string; status: string; createdAt: string };
        error?: string;
      }>;
      uploadReports: (params: { filePaths: string[]; maxReports?: number; maxDuration?: string }) => Promise<{
        success: boolean;
        data?: { taskId: string; taskType: string; status: string; createdAt: string };
        error?: string;
      }>;
      resume: (sessionId: string) => Promise<{
        success: boolean;
        data?: { taskId: string; taskType: string; status: string; createdAt: string };
        error?: string;
      }>;
    };
    results: (taskId: string) => Promise<{
      success: boolean;
      data?: {
        taskId: string;
        status: string;
        factors: Array<{ name: string; ic: number; icir: number; formula: string }>;
        bestIc: number;
        bestIcir: number;
      };
      error?: string;
    }>;
    sessions: {
      list: (params?: { status?: string; resumableOnly?: boolean }) => Promise<{
        success: boolean;
        data?: unknown[];
        error?: string;
      }>;
      detail: (sessionId: string) => Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
      }>;
    };
    // TICKET_279: Sync factors from Factor Library API to local cache
    sync: () => Promise<{
      success: boolean;
      data?: { synced: number };
      error?: string;
    }>;
    local: {
      list: (params?: { source?: string; category?: string; factor_type?: string }) => Promise<{
        success: boolean;
        data?: Array<{
          id: string;
          name: string;
          category: string;
          source: string;
          factor_type: string; // TICKET_281: 'time_series' | 'cross_sectional'
          formula: string | null;
          translation_status: string | null;                    // TICKET_285
          qlib_expr: string | null;                             // TICKET_285
          cs_pipeline: import('../types').PipelineStep[] | null; // TICKET_285
          ic: number | null;
          icir: number | null;
          sharpe: number | null;
        }>;
        error?: string;
      }>;
    };
  };

  // TICKET_286/287: Factor Engine Registry API
  factorEngine: {
    registry: () => Promise<{
      success: boolean;
      data?: Array<{
        engine_id: string;
        display_name: string;
        description: string | null;
        python_package: string | null;
        factor_count: number;
        examples: string | null;
        builtin: number;
        installed: number;
        version: string | null;
        installed_at: string | null;
      }>;
      error?: string;
    }>;
    install: (engineId: string) => Promise<{
      success: boolean;
      data?: { engineId: string; factorsSeeded: number };
      error?: string;
    }>;
    uninstall: (engineId: string) => Promise<{
      success: boolean;
      data?: { engineId: string; factorsRemoved: number };
      error?: string;
    }>;
  };

  // PLUGIN_TICKET_018: Auth API for data source auth awareness
  auth?: {
    getState: () => Promise<{ success: boolean; data?: { isAuthenticated: boolean } }>;
    onStateChanged: (callback: (data: { isAuthenticated: boolean }) => void) => () => void;
  };

  // PLUGIN_TICKET_015 + PLUGIN_TICKET_018: Data API used by Alpha Factory
  data: {
    // PLUGIN_TICKET_018: Provider list and progressive status check
    getProviderList: () => Promise<Array<{ id: string; name: string; capabilities?: { requiresAuth?: boolean; intervals?: string[]; maxLookback?: Record<string, string> } }>>;
    checkProvidersProgressive: () => Promise<{ success: boolean; error?: string }>;
    onProviderStatus: (callback: (event: { id: string; status: 'connected' | 'disconnected' | 'error'; latencyMs?: number; error?: string }) => void) => () => void;
    // PLUGIN_TICKET_018: searchSymbols now accepts optional provider
    searchSymbols: (query: string, provider?: string) => Promise<Array<{
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
      callerId?: string;
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
      callerId?: string;
    }) => Promise<{
      success: boolean;
      dataPath?: string;
      dataFeeds?: Record<string, { dataPath: string }>;
      error?: string;
    }>;
    // TICKET_077_P3: Data download progress events
    onProgress: (callback: (event: unknown, data: unknown) => void) => () => void;
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
