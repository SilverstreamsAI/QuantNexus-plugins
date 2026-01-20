/**
 * BacktestPage Component - Plugin Layer
 *
 * Backtest Nexus page following TICKET_077 layout specification.
 * Zones: B (Sidebar - History), C (BacktestDataConfigPanel + WorkflowRowSelector), D (Action Bar - Execute)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_077_COMPONENT8 - BacktestDataConfigPanel Design
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  WorkflowRowSelector,
  type WorkflowRow,
  type AlgorithmOption,
  BacktestDataConfigPanel,
  type BacktestDataConfig,
  type DataSourceOption,
  type SymbolSearchResult,
  BacktestResultPanel,
  ExecutorStatusPanel,
  type ExecutorResult,
} from '../ui';
import { algorithmService, toAlgorithmOption } from '../../services/algorithmService';

// Inline SVG icons
const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4" />
    <path d="m16.2 7.8 2.9-2.9" />
    <path d="M18 12h4" />
    <path d="m16.2 16.2 2.9 2.9" />
    <path d="M12 18v4" />
    <path d="m4.9 19.1 2.9-2.9" />
    <path d="M2 12h4" />
    <path d="m4.9 4.9 2.9 2.9" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HistoryItem {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'failed' | 'running';
}

interface BacktestPageProps {
  onExecute?: (config: BacktestDataConfig, workflows: WorkflowRow[]) => void;
  /** TICKET_151: Multiple results for comparison */
  results?: ExecutorResult[];
  /** TICKET_151: Current result being built during execution */
  currentResult?: ExecutorResult | null;
  isExecuting?: boolean;
  onNewBacktest?: () => void;
  /** TICKET_151: Progress tracking for sequential execution */
  currentCaseIndex?: number;
  totalCases?: number;
}

// -----------------------------------------------------------------------------
// Algorithm Data (loaded from SQLite nona_algorithms table)
// -----------------------------------------------------------------------------

const EMPTY_ALGORITHMS: {
  trendRange: AlgorithmOption[];
  preCondition: AlgorithmOption[];
  selectSteps: AlgorithmOption[];
  postCondition: AlgorithmOption[];
} = {
  trendRange: [],
  preCondition: [],
  selectSteps: [],
  postCondition: [],
};

// Initial empty row
const createInitialRow = (): WorkflowRow => ({
  id: `row-${Date.now()}`,
  rowNumber: 1,
  analysisSelections: [],
  preConditionSelections: [],
  stepSelections: [],
  postConditionSelections: [],
});

// Default data configuration
const createDefaultDataConfig = (): BacktestDataConfig => ({
  symbol: '',
  dataSource: 'clickhouse',
  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  timeframe: '1d',
  initialCapital: 10000,
  orderSize: 100,
  orderSizeUnit: 'percent',
});

// -----------------------------------------------------------------------------
// BacktestPage Component
// -----------------------------------------------------------------------------

export const BacktestPage: React.FC<BacktestPageProps> = ({
  onExecute,
  results = [],
  currentResult,
  isExecuting: isExecutingProp = false,
  onNewBacktest,
  currentCaseIndex = 0,
  totalCases = 0,
}) => {
  const [localExecuting, setLocalExecuting] = useState(false);
  // Use prop if provided, otherwise use local state
  const isExecuting = isExecutingProp || localExecuting;
  const [historyItems] = useState<HistoryItem[]>([]);
  const [workflowRows, setWorkflowRows] = useState<WorkflowRow[]>([createInitialRow()]);
  const [algorithms, setAlgorithms] = useState(EMPTY_ALGORITHMS);
  const [loading, setLoading] = useState(true);

  // Component 8: Data configuration state
  const [dataConfig, setDataConfig] = useState<BacktestDataConfig>(createDefaultDataConfig());
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [dataConfigErrors, setDataConfigErrors] = useState<Partial<Record<keyof BacktestDataConfig, string>>>({});
  // TICKET_143: Separate execution error from field errors
  const [executeError, setExecuteError] = useState<string | null>(null);

  // TICKET_139: Track auth state to refresh ClickHouse connection on login
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load algorithms from database on mount
  useEffect(() => {
    async function loadAlgorithms() {
      try {
        setLoading(true);

        const [trendRange, preCondition, selectSteps, postCondition] = await Promise.all([
          algorithmService.getTrendRangeAlgorithms(),
          algorithmService.getPreConditionAlgorithms(),
          algorithmService.getSelectStepsAlgorithms(),
          algorithmService.getPostConditionAlgorithms(),
        ]);

        setAlgorithms({
          trendRange: trendRange.map(toAlgorithmOption),
          preCondition: preCondition.map(toAlgorithmOption),
          selectSteps: selectSteps.map(toAlgorithmOption),
          postCondition: postCondition.map(toAlgorithmOption),
        });

        console.log('[BacktestPage] Loaded algorithms:', {
          trendRange: trendRange.length,
          preCondition: preCondition.length,
          selectSteps: selectSteps.length,
          postCondition: postCondition.length,
        });
      } catch (error) {
        console.error('[BacktestPage] Failed to load algorithms:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAlgorithms();
  }, []);

  // TICKET_139: Subscribe to auth state changes
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.auth) {
      console.warn('[BacktestPage] Auth API not available');
      return;
    }

    // Get initial auth state
    api.auth.getState().then((result: any) => {
      if (result.success && result.data) {
        setIsAuthenticated(result.data.isAuthenticated);
      }
    });

    // Subscribe to auth state changes
    const unsubscribe = api.auth.onStateChanged((data: any) => {
      console.log('[BacktestPage] Auth state changed:', data.isAuthenticated);
      setIsAuthenticated(data.isAuthenticated);
    });

    return () => unsubscribe();
  }, []);

  // TICKET_139: Load data sources when auth state changes
  useEffect(() => {
    async function loadDataSources() {
      try {
        const api = (window as any).electronAPI;
        if (!api?.data?.checkConnection) {
          console.warn('[BacktestPage] Data API not available, using defaults');
          setDataSources([
            { id: 'clickhouse', name: 'ClickHouse', status: 'disconnected' },
          ]);
          return;
        }

        // Check ClickHouse connection status
        const clickhouseStatus = await api.data.checkConnection('clickhouse');

        const providers: DataSourceOption[] = [
          {
            id: 'clickhouse',
            name: 'ClickHouse',
            status: clickhouseStatus.connected ? 'connected' : 'disconnected',
          },
        ];
        setDataSources(providers);
        console.log('[BacktestPage] Data sources loaded, ClickHouse:', clickhouseStatus.connected ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('[BacktestPage] Failed to load data sources:', error);
        setDataSources([
          { id: 'clickhouse', name: 'ClickHouse', status: 'error' },
        ]);
      }
    }

    // Always load on mount, and reload when isAuthenticated changes to true
    loadDataSources();
  }, [isAuthenticated]);

  // Symbol search handler
  // TICKET_121 + TICKET_045: Use real backend API instead of mock data
  const handleSymbolSearch = useCallback(async (query: string): Promise<SymbolSearchResult[]> => {
    try {
      // Call real IPC handler (TICKET_045 implementation)
      const api = (window as any).electronAPI;
      if (!api?.data?.searchSymbols) {
        console.warn('[BacktestPage] Data API not available, using fallback');
        return [];
      }

      const results = await api.data.searchSymbols(query);

      // Transform backend response to SymbolSearchResult format
      return results.map((r: any) => ({
        symbol: r.symbol || query,
        name: r.name || r.symbol || query,
        exchange: r.exchange || 'Unknown',
        type: r.type || 'Unknown',
        startTime: r.startTime,
        endTime: r.endTime,
      }));
    } catch (error) {
      console.error('[BacktestPage] Symbol search failed:', error);
      // Return empty array on error
      return [];
    }
  }, []);

  // Validate data configuration
  const validateDataConfig = useCallback((config: BacktestDataConfig): boolean => {
    const errors: Partial<Record<keyof BacktestDataConfig, string>> = {};

    if (!config.symbol) {
      errors.symbol = 'Symbol is required';
    }

    if (!config.dataSource) {
      errors.dataSource = 'Data source is required';
    }

    if (!config.startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!config.endDate) {
      errors.endDate = 'End date is required';
    }

    if (config.startDate && config.endDate && config.startDate >= config.endDate) {
      errors.endDate = 'End date must be after start date';
    }

    if (config.initialCapital <= 0) {
      errors.initialCapital = 'Initial capital must be positive';
    }

    if (config.orderSize <= 0) {
      errors.orderSize = 'Order size must be positive';
    }

    setDataConfigErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  const handleExecute = useCallback(async () => {
    if (isExecuting) return;

    // Validate data configuration first
    if (!validateDataConfig(dataConfig)) {
      console.error('[BacktestPage] Data configuration validation failed');
      return;
    }

    setLocalExecuting(true);
    setExecuteError(null); // TICKET_143: Clear previous error
    try {
      console.log('[BacktestPage] Executing backtest with config:', dataConfig);
      console.log('[BacktestPage] Workflow rows:', workflowRows);

      // TICKET_136: Ensure data is available before execution
      const api = (window as any).electronAPI;
      if (api?.data?.ensure) {
        console.log('[BacktestPage] Ensuring data availability...');
        const ensureResult = await api.data.ensure({
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          interval: dataConfig.timeframe,
        });

        if (!ensureResult.success) {
          console.error('[BacktestPage] Data ensure failed:', ensureResult.error);
          // TICKET_143: Use dedicated execute error instead of field error
          setExecuteError(ensureResult.error || 'Failed to fetch data');
          return;
        }

        console.log('[BacktestPage] Data ready:', ensureResult);
      }

      // TICKET_121: Pass data config and workflows to Host layer
      onExecute?.(dataConfig, workflowRows);
    } catch (error) {
      console.error('[BacktestPage] Execute failed:', error);
      // TICKET_143: Use dedicated execute error instead of field error
      setExecuteError(error instanceof Error ? error.message : 'Execution failed');
    } finally {
      setLocalExecuting(false);
    }
  }, [isExecuting, dataConfig, workflowRows, validateDataConfig, onExecute]);

  return (
    <div className="h-full flex bg-color-terminal-bg text-color-terminal-text">
      {/* Zone B: History Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-color-terminal-border bg-color-terminal-panel/30 flex flex-col">
        <div className="px-4 py-3 border-b border-color-terminal-border">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-color-terminal-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              History
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {historyItems.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <HistoryIcon className="w-8 h-8 mx-auto mb-3 text-color-terminal-text-muted opacity-50" />
              <p className="text-[11px] text-color-terminal-text-muted">
                No backtest history
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-full px-3 py-2 text-left rounded transition-colors",
                    "hover:bg-white/5"
                  )}
                >
                  <div className="text-xs font-medium text-color-terminal-text truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-color-terminal-text-muted">
                    {item.date}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone C + Zone D */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Zone C: Config or Result based on state */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TICKET_151: Show results if we have completed results */}
          {results.length > 0 ? (
            /* Component 9: Backtest Result Panel - pass all results for comparison */
            <BacktestResultPanel results={results} className="h-full" />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-color-terminal-text-muted">
                Loading algorithms...
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Component 8: Executor Status Panel (shown when executing) */}
              {/* TICKET_151: Show progress for sequential execution */}
              {isExecuting && (
                <ExecutorStatusPanel
                  status="running"
                  progress={totalCases > 0 ? Math.round((currentCaseIndex / totalCases) * 100) : 0}
                  message={totalCases > 1
                    ? `Running backtest ${currentCaseIndex}/${totalCases}...`
                    : 'Running backtest...'
                  }
                />
              )}

              {/* Data Configuration Panel */}
              <BacktestDataConfigPanel
                value={dataConfig}
                onChange={setDataConfig}
                dataSources={dataSources}
                onSymbolSearch={handleSymbolSearch}
                errors={dataConfigErrors}
                disabled={isExecuting}
              />

              {/* Component 7: Workflow Row Selector */}
              <WorkflowRowSelector
                title="WORKFLOW CONFIGURATION"
                rows={workflowRows}
                onChange={setWorkflowRows}
                algorithms={algorithms}
                maxRows={10}
                disableConditions={true}
              />
            </div>
          )}
        </div>

        {/* Zone D: Action Bar */}
        <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
          {/* TICKET_143: Execute error display */}
          {executeError && (
            <div className="mb-3 p-3 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm terminal-mono">
              {executeError}
            </div>
          )}
          {/* TICKET_151: Check results array instead of single result */}
          {results.length > 0 ? (
            /* Show "New Backtest" button when results are displayed */
            <button
              onClick={onNewBacktest}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all border-color-terminal-accent-teal bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal hover:bg-color-terminal-accent-teal/20"
            >
              <PlayIcon className="w-4 h-4" />
              New Backtest
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all",
                isExecuting
                  ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                  : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
              )}
            >
              {isExecuting ? (
                <>
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Execute
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacktestPage;
