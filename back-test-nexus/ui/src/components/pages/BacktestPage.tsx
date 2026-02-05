/**
 * BacktestPage Component - Plugin Layer
 *
 * Backtest Nexus page following TICKET_077 layout specification.
 * Zones: B (Sidebar - History), C (BacktestDataConfigPanel + WorkflowRowSelector), D (Action Bar - Execute)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_077_COMPONENT8 - BacktestDataConfigPanel Design
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  NamingDialog,
  CheckpointResumePanel,
  BacktestHistorySidebar,
  type BacktestHistoryItem,
} from '../ui';
import { algorithmService, toAlgorithmOption } from '../../services/algorithmService';
import { convertPythonResultToExecutorResult } from '../../utils/executorResultConverter';
import { extractUniqueTimeframes } from '../../utils/timeframe-utils';
// TICKET_264: Export to Quant Lab hooks
import { useQuantLabAvailable, useExportToQuantLab } from '../../hooks';

// -----------------------------------------------------------------------------
// Inline SVG Icons (Zone D Action Bar only)
// Zone B icons moved to BacktestHistorySidebar component (TICKET_077_18)
// -----------------------------------------------------------------------------

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

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// TICKET_171: Check icon for Keep button
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// TICKET_171: X icon for Discard button
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// TICKET_171: Reset icon for config page
const RotateCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

// TICKET_264: Export icon for Quant Lab export
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// HistoryItem type imported from BacktestHistorySidebar (TICKET_077_18)
// Use BacktestHistoryItem for history records

// TICKET_176_1: Checkpoint types
interface CheckpointMetrics {
  totalPnl?: number;
  totalReturn?: number;
  totalTrades?: number;
  winRate?: number;
}

interface OpenPosition {
  symbol: string;
  size: number;
  price: number;
}

interface CheckpointInfo {
  taskId: string;
  barIndex: number;
  totalBars: number;
  createdAt: string;
  progressPercent: number;
  intermediateResults?: {
    metrics?: CheckpointMetrics;
    openPositions?: OpenPosition[];
  };
  dataValidation: 'valid' | 'file_missing' | 'hash_mismatch' | 'pending';
}

// TICKET_173: Message API type for notifications
interface MessageAPI {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  confirm: (msg: string, options?: { title?: string; okText?: string; cancelText?: string }) => Promise<boolean>;
}

// TICKET_173: Backtest resolver for pending promises
type BacktestResolver = {
  resolve: (result: ExecutorResult) => void;
  reject: (error: Error) => void;
};

/** Cockpit mode determines algorithm filtering */
export type CockpitMode = 'indicators' | 'kronos';

// TICKET_234: Execution state for global store
export interface ExecutionStateUpdate {
  isExecuting: boolean;
  currentCaseIndex: number;
  totalCases: number;
  executorProgress: number;
  processedBars?: number;
  totalBars?: number;
}

// TICKET_173: API types from Host (use any to avoid type dependency on Host types)
export interface BacktestPageProps {
  /** TICKET_173: Executor API from Host */
  executorAPI?: any;
  /** TICKET_173: Data API from Host */
  dataAPI?: any;
  /** TICKET_173: Message API from Host */
  messageAPI?: MessageAPI;
  /** TICKET_173: Notify Host when result view state changes (for breadcrumb) */
  onResultViewChange?: (isResultView: boolean) => void;
  /** TICKET_164: Reset key - when changed, clear all result states */
  resetKey?: number;
  /** Cockpit mode: 'indicators' (default) or 'kronos' for different algorithm filtering */
  cockpitMode?: CockpitMode;
  /** TICKET_233: Notify Host when backtest starts (for global status bar) */
  /** TICKET_257: Include workflowTimeframes for result page display */
  onBacktestStart?: (taskId: string, strategyName: string, workflowTimeframes?: {
    analysis: string | null;
    entryFilter: string | null;
    entrySignal: string | null;
    exitStrategy: string | null;
  }) => void;
  /** TICKET_233: Notify Host of backtest progress (for global status bar) */
  onBacktestProgress?: (taskId: string, progress: number) => void;
  /** TICKET_233: Notify Host when backtest completes (for global status bar) */
  onBacktestComplete?: (taskId: string, success: boolean) => void;
  /** TICKET_234: Notify Host when current result updates (for global store) */
  onCurrentResultUpdate?: (result: ExecutorResult | null) => void;
  /** TICKET_234: Notify Host when results array updates (for global store) */
  onResultsUpdate?: (results: ExecutorResult[]) => void;
  /** TICKET_234: Notify Host when execution state updates (for global store) */
  onExecutionStateUpdate?: (state: ExecutionStateUpdate) => void;
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
// TICKET_248: timeframe removed - now set at stage-level in WorkflowRowSelector
const createDefaultDataConfig = (): BacktestDataConfig => ({
  symbol: '',
  dataSource: 'clickhouse',
  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  initialCapital: 10000,
  orderSize: 100,
  orderSizeUnit: 'percent',
});

// -----------------------------------------------------------------------------
// BacktestPage Component
// -----------------------------------------------------------------------------

export const BacktestPage: React.FC<BacktestPageProps> = ({
  executorAPI,
  dataAPI,
  messageAPI,
  onResultViewChange,
  resetKey = 0,
  cockpitMode = 'indicators',
  onBacktestStart,
  onBacktestProgress,
  onBacktestComplete,
  onCurrentResultUpdate,
  onResultsUpdate,
  onExecutionStateUpdate,
}) => {
  const { t } = useTranslation('backtest');

  // TICKET_173: State moved from Host Shell
  const [backtestResults, setBacktestResults] = useState<ExecutorResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ExecutorResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  // TICKET_228: Track executor progress from progress events
  const [executorProgress, setExecutorProgress] = useState(0);
  // TICKET_231: Track processed bars for synchronized candle/equity display
  const [processedBars, setProcessedBars] = useState(0);
  const [backtestTotalBars, setBacktestTotalBars] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const pendingBacktestRef = useRef<BacktestResolver | null>(null);
  // TICKET_153_1: History from SQLite
  const [historyItems, setHistoryItems] = useState<BacktestHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // TICKET_151_1: Track which case to scroll to in Charts tab
  const [scrollToCaseIndex, setScrollToCaseIndex] = useState<number | undefined>(undefined);

  // TICKET_160: Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; itemId: string | null }>({
    visible: false,
    itemId: null,
  });

  // TICKET_162: Selected history result for page41 display
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<ExecutorResult | null>(null);
  // TICKET_162: Selected history item metadata for title display
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<BacktestHistoryItem | null>(null);

  // TICKET_264: Export to Quant Lab
  const { isAvailable: isQuantLabAvailable, isLoading: isQuantLabLoading } = useQuantLabAvailable();
  const { exportWorkflow, isExporting } = useExportToQuantLab();
  const [exportDialogVisible, setExportDialogVisible] = useState(false);

  // TICKET_163: Naming dialog state
  const [namingDialogVisible, setNamingDialogVisible] = useState(false);

  // TICKET_176_1: Checkpoint state
  const [checkpointInfo, setCheckpointInfo] = useState<CheckpointInfo | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [showCheckpointPanel, setShowCheckpointPanel] = useState(false);

  // TICKET_173: Track if viewing history result (for breadcrumb)
  const [hasHistoryResult, setHasHistoryResult] = useState(false);

  // TICKET_173: Determine if viewing results (execution or history)
  // TICKET_227: Switch to result view when backtest starts (real-time display)
  const isResultView = isExecuting || backtestResults.length > 0 || hasHistoryResult;

  // TICKET_173: Centralized state reset helper
  const clearResultState = useCallback(() => {
    setBacktestResults([]);
    setCurrentResult(null);
    setCurrentCaseIndex(0);
    setTotalCases(0);
    setExecutorProgress(0);  // TICKET_228: Reset executor progress
    setProcessedBars(0);     // TICKET_231: Reset processed bars
    setBacktestTotalBars(0); // TICKET_231: Reset total bars
    setHasHistoryResult(false);
    setCurrentTaskId(null);
  }, []);

  // TICKET_173: Notify Host when result view state changes
  // TICKET_227: Debug logging for page switch
  useEffect(() => {
    console.debug('[TICKET_227] isResultView changed:', {
      isResultView,
      isExecuting,
      hasCurrentResult: !!currentResult,
      backtestResultsLength: backtestResults.length,
      hasHistoryResult,
    });
    onResultViewChange?.(isResultView);
  }, [isResultView, onResultViewChange, isExecuting, currentResult, backtestResults.length, hasHistoryResult]);

  // TICKET_234: Notify Host when currentResult changes (for global store)
  useEffect(() => {
    onCurrentResultUpdate?.(currentResult);
  }, [currentResult, onCurrentResultUpdate]);

  // TICKET_234: Notify Host when backtestResults array changes (for global store)
  useEffect(() => {
    onResultsUpdate?.(backtestResults);
  }, [backtestResults, onResultsUpdate]);

  // TICKET_234: Notify Host when execution state changes (for global store)
  useEffect(() => {
    onExecutionStateUpdate?.({
      isExecuting,
      currentCaseIndex,
      totalCases,
      executorProgress,
      processedBars,
      totalBars: backtestTotalBars,
    });
  }, [isExecuting, currentCaseIndex, totalCases, executorProgress, processedBars, backtestTotalBars, onExecutionStateUpdate]);

  // TICKET_151_1: Handle case selection from History panel
  const handleCaseClick = useCallback((index: number) => {
    setScrollToCaseIndex(index);
  }, []);

  // TICKET_153_1: Load history from SQLite
  const loadHistory = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.executor?.getHistory) {
      console.warn('[BacktestPage] History API not available');
      return;
    }

    setHistoryLoading(true);
    try {
      const result = await api.executor.getHistory({ limit: 20 });
      if (result.success && result.data) {
        const items: BacktestHistoryItem[] = result.data.map((record: any) => ({
          id: record.task_id,
          name: record.strategy_name,
          symbol: record.symbol,
          timeframe: record.timeframe,
          totalReturn: record.total_return,
          // Backtest parameters
          startDate: record.start_date?.split('T')[0] || '',
          endDate: record.end_date?.split('T')[0] || '',
          initialCapital: record.initial_capital || 0,
          orderSize: record.order_size,
          orderSizeUnit: record.order_size_unit,
          // Timestamp with time
          createdAt: new Date(record.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          status: 'completed' as const,
        }));
        setHistoryItems(items);
      }
    } catch (error) {
      console.error('[BacktestPage] Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // TICKET_160: Delete history record
  const handleDeleteHistory = useCallback(async (itemId: string) => {
    const api = (window as any).electronAPI;
    if (!api?.executor?.deleteHistoryResult) {
      console.warn('[BacktestPage] Delete API not available');
      return;
    }

    try {
      const result = await api.executor.deleteHistoryResult(itemId);
      if (result.success) {
        // Remove from local state
        setHistoryItems((prev) => prev.filter((item) => item.id !== itemId));
      } else {
        console.error('[BacktestPage] Failed to delete history:', result.error);
      }
    } catch (error) {
      console.error('[BacktestPage] Delete error:', error);
    }
  }, []);

  // TICKET_160: Show delete confirmation
  const handleDeleteClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setDeleteConfirm({ visible: true, itemId });
  }, []);

  // TICKET_160: Confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm.itemId) {
      handleDeleteHistory(deleteConfirm.itemId);
    }
    setDeleteConfirm({ visible: false, itemId: null });
  }, [deleteConfirm.itemId, handleDeleteHistory]);

  // TICKET_160: Cancel delete
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm({ visible: false, itemId: null });
  }, []);

  // TICKET_162: Handle history item click - load full result and switch to page41
  // TICKET_164: Notify Host for breadcrumb update
  const handleHistoryItemClick = useCallback(async (taskId: string) => {
    const api = (window as any).electronAPI;
    if (!api?.executor?.getHistoryResult) {
      console.warn('[BacktestPage] getHistoryResult API not available');
      return;
    }

    // Find the history item to get metadata
    const historyItem = historyItems.find(item => item.id === taskId);
    if (historyItem) {
      setSelectedHistoryItem(historyItem);
    }

    try {
      const response = await api.executor.getHistoryResult(taskId);
      if (response.success && response.data) {
        const record = response.data;
        // Transform database record to ExecutorResult format
        const result: ExecutorResult = {
          success: true,
          startTime: record.start_date ? new Date(record.start_date).getTime() : 0,
          endTime: record.end_date ? new Date(record.end_date).getTime() : 0,
          executionTimeMs: record.execution_time_ms ?? 0,
          metrics: {
            totalPnl: record.total_pnl ?? 0,
            totalReturn: record.total_return ?? 0,
            sharpeRatio: record.sharpe_ratio ?? 0,
            maxDrawdown: record.max_drawdown ?? 0,
            winRate: record.win_rate ?? 0,
            profitFactor: record.profit_factor ?? 0,
            totalTrades: record.total_trades ?? 0,
            winningTrades: record.winning_trades ?? 0,
            losingTrades: record.losing_trades ?? 0,
          },
          trades: record.trades_json ? JSON.parse(record.trades_json) : [],
          equityCurve: record.equity_curve_json ? JSON.parse(record.equity_curve_json) : [],
          candles: [], // Candles not stored in database, use empty array
        };
        setSelectedHistoryResult(result);
        // TICKET_173: Update local state (Host notified via isResultView effect)
        setHasHistoryResult(true);
        console.log('[BacktestPage] Loaded history result for:', taskId);
      } else {
        console.error('[BacktestPage] Failed to load history result:', response.error);
      }
    } catch (error) {
      console.error('[BacktestPage] Error loading history result:', error);
    }
  }, [historyItems]);

  // TICKET_162: Clear selected history result and return to config page
  // TICKET_170: Reset config to initial state for true "New Backtest"
  // TICKET_173: Use clearResultState (Host notified via isResultView effect)
  const handleClearHistoryResult = useCallback(() => {
    setSelectedHistoryResult(null);
    setSelectedHistoryItem(null);
    setDataConfig(createDefaultDataConfig());
    setWorkflowRows([createInitialRow()]);
    clearResultState();
  }, [clearResultState]);

  // TICKET_171: Reset config on Page 4 (config page)
  const handleReset = useCallback(() => {
    setDataConfig(createDefaultDataConfig());
    setWorkflowRows([createInitialRow()]);
    setDataConfigErrors({});
    setExecuteError(null);
  }, []);

  // TICKET_176_1: Check for checkpoint on mount
  const checkForCheckpoint = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.backtest?.listCheckpoints) {
      console.warn('[BacktestPage] Checkpoint API not available');
      return;
    }

    try {
      const result = await api.backtest.listCheckpoints();
      if (result.success && result.data && result.data.length > 0) {
        // Get the most recent checkpoint
        const latestCheckpoint = result.data[0];
        const infoResult = await api.backtest.getCheckpointInfo(latestCheckpoint.task_id);
        if (infoResult.success && infoResult.data) {
          setCheckpointInfo(infoResult.data);
          setShowCheckpointPanel(true);
          console.log('[BacktestPage] Found checkpoint:', infoResult.data);
        }
      }
    } catch (error) {
      console.error('[BacktestPage] Failed to check for checkpoint:', error);
    }
  }, []);

  // TICKET_176_1: Handle checkpoint resume
  const handleCheckpointResume = useCallback(async () => {
    if (!checkpointInfo) return;

    const api = (window as any).electronAPI;
    if (!api?.backtest?.resumeBacktest) {
      messageAPI?.error('Resume API not available');
      return;
    }

    setIsResuming(true);
    setShowCheckpointPanel(false);
    setIsExecuting(true);
    setTotalCases(1);
    setCurrentCaseIndex(1);
    setExecutorProgress(0);  // TICKET_228: Reset progress for resume

    try {
      messageAPI?.info('Resuming backtest from checkpoint...');
      const result = await api.backtest.resumeBacktest({
        taskId: checkpointInfo.taskId,
        originalConfig: dataConfig,
      });

      if (!result.success) {
        throw new Error(result.error || 'Resume failed');
      }

      console.log('[BacktestPage] Resume started, taskId:', result.taskId);
      setCurrentTaskId(result.taskId);
      setCheckpointInfo(null);
    } catch (error) {
      console.error('[BacktestPage] Resume failed:', error);
      messageAPI?.error(`Resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsExecuting(false);
      setShowCheckpointPanel(true);
    } finally {
      setIsResuming(false);
    }
  }, [checkpointInfo, dataConfig, messageAPI]);

  // TICKET_176_1: Handle checkpoint discard
  const handleCheckpointDiscard = useCallback(async () => {
    if (!checkpointInfo) return;

    const api = (window as any).electronAPI;
    if (!api?.backtest?.deleteCheckpoint) {
      console.warn('[BacktestPage] Delete checkpoint API not available');
      setCheckpointInfo(null);
      setShowCheckpointPanel(false);
      return;
    }

    try {
      await api.backtest.deleteCheckpoint(checkpointInfo.taskId);
      console.log('[BacktestPage] Checkpoint discarded');
      setCheckpointInfo(null);
      setShowCheckpointPanel(false);
    } catch (error) {
      console.error('[BacktestPage] Failed to delete checkpoint:', error);
      messageAPI?.error('Failed to delete checkpoint');
    }
  }, [checkpointInfo, messageAPI]);

  // Load history on mount and when results change
  useEffect(() => {
    loadHistory();
  }, [loadHistory, backtestResults.length]);

  // TICKET_176_1: Check for checkpoint on mount
  useEffect(() => {
    checkForCheckpoint();
  }, [checkForCheckpoint]);

  // TICKET_164: Clear history result when resetKey changes (breadcrumb back navigation)
  // TICKET_170: Also reset config to initial state for true "New Backtest"
  useEffect(() => {
    if (resetKey > 0) {
      console.debug('[BacktestPage] Reset triggered, clearing history result and config');
      setSelectedHistoryResult(null);
      setSelectedHistoryItem(null);
      setDataConfig(createDefaultDataConfig());
      setWorkflowRows([createInitialRow()]);
      clearResultState();
    }
  }, [resetKey, clearResultState]);

  // TICKET_173: Subscribe to executor events (moved from Host Shell)
  useEffect(() => {
    const api = executorAPI || (window as any).electronAPI?.executor;
    if (!api) return;

    // Track completion to prevent incremental updates from overwriting final result
    let isCompleted = false;

    const unsubCompleted = api.onCompleted((data: any) => {
      console.debug('[BacktestPage] Backtest completed:', data);
      isCompleted = true;
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      pendingBuffer.length = 0;
      // TICKET_230: Convert Python snake_case to TypeScript camelCase
      const convertedResult = convertPythonResultToExecutorResult(data.result);
      if (pendingBacktestRef.current) {
        pendingBacktestRef.current.resolve(convertedResult);
        pendingBacktestRef.current = null;
      }
      // TICKET_234_4: Preserve accumulated data from incremental updates
      // Python final result may not include candles/trades, so we must preserve them
      setCurrentResult(prev => {
        if (!prev) return convertedResult;

        return {
          ...convertedResult,
          // Preserve candles from incremental accumulation
          candles: prev.candles.length > 0 ? prev.candles : convertedResult.candles,
          // Preserve equity curve if final result has fewer points
          equityCurve: prev.equityCurve.length > convertedResult.equityCurve.length
            ? prev.equityCurve
            : convertedResult.equityCurve,
          // TICKET_234_4: Preserve trades from incremental accumulation
          trades: prev.trades.length > 0 ? prev.trades : convertedResult.trades,
        };
      });
      // TICKET_233: Notify global status
      if (data.taskId) {
        onBacktestComplete?.(data.taskId, true);
      }
    });

    const unsubError = api.onError((data: any) => {
      console.error('[BacktestPage] Backtest error:', data);
      if (pendingBacktestRef.current) {
        pendingBacktestRef.current.reject(new Error(data.error));
        pendingBacktestRef.current = null;
      }
      setIsExecuting(false);
      messageAPI?.error(`Backtest failed: ${data.error}`);
      // TICKET_233: Notify global status
      if (data.taskId) {
        onBacktestComplete?.(data.taskId, false);
      }
    });

    const unsubProgress = api.onProgress((data: any) => {
      console.debug('[BacktestPage] Backtest progress:', data);
      // TICKET_228: Update executor progress from progress events
      if (typeof data?.percent === 'number') {
        setExecutorProgress(data.percent);
        // TICKET_233: Notify global status
        if (data.taskId) {
          onBacktestProgress?.(data.taskId, data.percent);
        }
      }
    });

    // Throttled buffer for incremental updates
    type IncrementData = any;
    const pendingBuffer: IncrementData[] = [];
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const THROTTLE_MS = 100;

    const flushBuffer = () => {
      if (isCompleted || pendingBuffer.length === 0) return;

      // TICKET_231: Get processedBars and totalBars from last increment
      const lastIncrement = pendingBuffer[pendingBuffer.length - 1];
      const latestProcessedBars = lastIncrement?.processedBars ?? 0;
      const latestTotalBars = lastIncrement?.totalBars ?? 0;

      const merged = pendingBuffer.reduce((acc, inc) => ({
        newCandles: acc.newCandles.concat(inc.newCandles || []),
        newEquityPoints: acc.newEquityPoints.concat(inc.newEquityPoints || []),
        newTrades: acc.newTrades.concat(inc.newTrades || []),
        currentMetrics: inc.currentMetrics,
      }), {
        newCandles: [] as any[],
        newEquityPoints: [] as any[],
        newTrades: [] as any[],
        currentMetrics: pendingBuffer[0].currentMetrics,
      });

      pendingBuffer.length = 0;

      // TICKET_231: Update processed bars for synchronized display
      if (latestProcessedBars > 0) {
        setProcessedBars(latestProcessedBars);
      }
      if (latestTotalBars > 0) {
        setBacktestTotalBars(latestTotalBars);
      }

      console.debug('[TICKET_227] flushBuffer: setting currentResult', {
        candles: merged.newCandles.length,
        equityPoints: merged.newEquityPoints.length,
        trades: merged.newTrades.length,
        processedBars: latestProcessedBars,
        totalBars: latestTotalBars,
      });
      setCurrentResult(prev => {
        if (!prev) {
          return {
            success: true,
            startTime: 0,
            endTime: 0,
            executionTimeMs: 0,
            metrics: {
              totalPnl: merged.currentMetrics.totalPnl || 0,
              totalReturn: merged.currentMetrics.totalReturn || 0,
              sharpeRatio: 0,
              maxDrawdown: 0,
              totalTrades: merged.currentMetrics.totalTrades || 0,
              winningTrades: merged.currentMetrics.winningTrades || 0,
              losingTrades: merged.currentMetrics.losingTrades || 0,
              winRate: merged.currentMetrics.winRate || 0,
              profitFactor: 0,
            },
            equityCurve: merged.newEquityPoints,
            trades: merged.newTrades,
            candles: merged.newCandles,
          } as ExecutorResult;
        }

        return {
          ...prev,
          metrics: {
            ...prev.metrics,
            totalPnl: merged.currentMetrics.totalPnl ?? prev.metrics.totalPnl,
            totalReturn: merged.currentMetrics.totalReturn ?? prev.metrics.totalReturn,
            totalTrades: merged.currentMetrics.totalTrades ?? prev.metrics.totalTrades,
            winningTrades: merged.currentMetrics.winningTrades ?? prev.metrics.winningTrades,
            losingTrades: merged.currentMetrics.losingTrades ?? prev.metrics.losingTrades,
            winRate: merged.currentMetrics.winRate ?? prev.metrics.winRate,
          },
          equityCurve: [...prev.equityCurve, ...merged.newEquityPoints],
          trades: [...prev.trades, ...merged.newTrades],
          candles: merged.newCandles.length > 0 ? [...prev.candles, ...merged.newCandles] : prev.candles,
        };
      });
    };

    const unsubIncrement = api.onIncrement((data: any) => {
      // TICKET_231: Debug increment data structure
      console.debug('[TICKET_231] onIncrement received:', {
        hasIncrement: !!data.increment,
        processedBars: data.increment?.processedBars,
        totalBars: data.increment?.totalBars,
        equityCount: data.increment?.newEquityPoints?.length,
        candlesCount: data.increment?.newCandles?.length,
      });
      pendingBuffer.push(data.increment);
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          flushBuffer();
        }, THROTTLE_MS);
      }
    });

    const cleanupTimer = () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        flushBuffer();
      }
    };

    return () => {
      cleanupTimer();
      unsubCompleted();
      unsubError();
      unsubProgress();
      unsubIncrement();
    };
  }, [executorAPI, messageAPI, onBacktestComplete, onBacktestProgress]);

  // TICKET_173: Action button handlers (moved from Host Shell)
  const handleNewBacktest = useCallback(() => {
    clearResultState();
    setSelectedHistoryResult(null);
    setSelectedHistoryItem(null);
    setDataConfig(createDefaultDataConfig());
    setWorkflowRows([createInitialRow()]);
    // TICKET_176_1: Show checkpoint panel if checkpoint exists
    if (checkpointInfo) {
      setShowCheckpointPanel(true);
    }
  }, [clearResultState, checkpointInfo]);

  const handleKeepResult = useCallback(() => {
    clearResultState();
  }, [clearResultState]);

  const handleDiscardResult = useCallback(async () => {
    if (currentTaskId) {
      try {
        const api = executorAPI || (window as any).electronAPI?.executor;
        const result = await api?.deleteHistoryResult(currentTaskId);
        if (result?.success) {
          console.debug('[BacktestPage] Deleted backtest result:', currentTaskId);
        } else {
          console.error('[BacktestPage] Failed to delete result:', result?.error);
          messageAPI?.error('Failed to delete backtest result');
        }
      } catch (error) {
        console.error('[BacktestPage] Error deleting result:', error);
        messageAPI?.error('Failed to delete backtest result');
      }
    }
    clearResultState();
    setSelectedHistoryResult(null);
    setSelectedHistoryItem(null);
    setDataConfig(createDefaultDataConfig());
    setWorkflowRows([createInitialRow()]);
  }, [currentTaskId, executorAPI, messageAPI, clearResultState]);

  // TICKET_264: Export to Quant Lab handlers
  const handleExportClick = useCallback(() => {
    setExportDialogVisible(true);
  }, []);

  const handleExportCancel = useCallback(() => {
    setExportDialogVisible(false);
  }, []);

  const handleExportConfirm = useCallback(async (finalName: string) => {
    setExportDialogVisible(false);

    // Build workflow config from current state
    const analysisRow = workflowRows.find(r => r.type === 'trendRange' && r.selectedAlgorithmId);
    const entryRow = workflowRows.find(r => r.type === 'selectSteps' && r.selectedAlgorithmId);
    const exitRow = workflowRows.find(r => r.type === 'postCondition' && r.selectedAlgorithmId);

    if (!analysisRow || !entryRow) {
      messageAPI?.error('Missing analysis or entry algorithm');
      return;
    }

    // Get algorithm details
    const analysisAlgo = algorithms.trendRange.find(a => a.id === analysisRow.selectedAlgorithmId);
    const entryAlgo = algorithms.selectSteps.find(a => a.id === entryRow.selectedAlgorithmId);
    const exitAlgo = exitRow ? algorithms.postCondition.find(a => a.id === exitRow.selectedAlgorithmId) : null;

    if (!analysisAlgo || !entryAlgo) {
      messageAPI?.error('Algorithm details not found');
      return;
    }

    try {
      await exportWorkflow({
        name: finalName,
        workflow: {
          analysis: {
            algorithmId: String(analysisAlgo.id),
            algorithmName: analysisAlgo.name,
            algorithmCode: analysisAlgo.code || '',
            baseClass: analysisAlgo.baseClass || 'RegimeStateBase',
            timeframe: analysisRow.timeframe || dataConfig.timeframe,
            parameters: {},
          },
          entry: {
            algorithmId: String(entryAlgo.id),
            algorithmName: entryAlgo.name,
            algorithmCode: entryAlgo.code || '',
            baseClass: entryAlgo.baseClass || 'RegimeTrendEntryBase',
            timeframe: entryRow.timeframe || dataConfig.timeframe,
            parameters: {},
          },
          exit: exitAlgo ? {
            algorithmId: String(exitAlgo.id),
            algorithmName: exitAlgo.name,
            algorithmCode: exitAlgo.code || '',
            baseClass: exitAlgo.baseClass || 'ExitSignalBase',
            timeframe: exitRow?.timeframe || dataConfig.timeframe,
            parameters: {},
          } : undefined,
          symbol: dataConfig.symbol,
          dateRange: {
            start: dataConfig.dateRange.start,
            end: dataConfig.dateRange.end,
          },
        },
        backtestMetrics: {
          sharpe: currentResult?.metrics?.sharpeRatio || 0,
          maxDrawdown: currentResult?.metrics?.maxDrawdown || 0,
          winRate: currentResult?.metrics?.winRate || 0,
          totalTrades: currentResult?.metrics?.totalTrades || 0,
          profitFactor: currentResult?.metrics?.profitFactor,
        },
      });

      messageAPI?.success(`Exported "${finalName}" to Quant Lab`);
    } catch (error) {
      console.error('[BacktestPage] Export error:', error);
      messageAPI?.error('Failed to export to Quant Lab');
    }
  }, [workflowRows, algorithms, dataConfig, currentResult, exportWorkflow, messageAPI]);

  // Load algorithms from database on mount
  // TICKET_210: Use combined strategy_type + signal_source filtering
  // cockpitMode determines which algorithms to load (indicators vs kronos)
  useEffect(() => {
    async function loadAlgorithms() {
      try {
        setLoading(true);

        let trendRange, preCondition, selectSteps, postCondition;

        if (cockpitMode === 'kronos') {
          // Kronos cockpit: load Kronos Predictor + all Kronos Entry algorithms
          // TICKET_210: Merge kronosIndicatorEntry + kronos_llm_entry
          const [kronosDetector, preCond, kronosIndicatorEntry, kronosAIEntry, postCond] = await Promise.all([
            algorithmService.getKronosDetectorAlgorithms(),  // strategy_type=9 + kronos_prediction
            algorithmService.getPreConditionAlgorithms(),
            algorithmService.getKronosEntryAlgorithms(),     // strategy_type=1 + kronosIndicatorEntry
            algorithmService.getKronosAIEntryAlgorithms(),   // strategy_type=1 + kronos_llm_entry
            algorithmService.getPostConditionAlgorithms(),
          ]);
          trendRange = kronosDetector;
          preCondition = preCond;
          selectSteps = [...kronosIndicatorEntry, ...kronosAIEntry];
          postCondition = postCond;
        } else if (cockpitMode === 'trader') {
          // TICKET_077_20: Trader cockpit - Market Analysis disabled, Entry Filter shows watchlist
          // Market Analysis: disabled (no algorithms)
          // Entry Filter: watchlist (strategy_type=7, signal_source='watchlist') - Market Observer
          // Entry Signal: llmtrader (strategy_type=1, signal_source='llmtrader') - AI Entry
          const [watchlist, llmTrader, postCond] = await Promise.all([
            algorithmService.getWatchlistAlgorithms(),       // strategy_type=7 + watchlist
            algorithmService.getLLMTraderAlgorithms(),       // strategy_type=1 + llmtrader
            algorithmService.getPostConditionAlgorithms(),
          ]);
          trendRange = [];  // Market Analysis disabled
          preCondition = watchlist;  // Entry Filter shows Market Observer algorithms
          selectSteps = llmTrader;
          postCondition = postCond;
        } else {
          // Indicators cockpit (default): load indicator-prefixed algorithms
          [trendRange, preCondition, selectSteps, postCondition] = await Promise.all([
            algorithmService.getIndicatorDetectorAlgorithms(),  // strategy_type=9 + indicator_detector%
            algorithmService.getPreConditionAlgorithms(),
            algorithmService.getIndicatorEntryAlgorithms(),     // strategy_type=3 + indicator_entry%
            algorithmService.getPostConditionAlgorithms(),
          ]);
        }

        setAlgorithms({
          trendRange: trendRange.map(toAlgorithmOption),
          preCondition: preCondition.map(toAlgorithmOption),
          selectSteps: selectSteps.map(toAlgorithmOption),
          postCondition: postCondition.map(toAlgorithmOption),
        });

        console.log(`[BacktestPage] Loaded algorithms (cockpitMode=${cockpitMode}):`, {
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
  }, [cockpitMode]);

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

  // TICKET_173: Helper to check if a workflow has content (moved from Host Shell)
  const hasWorkflowContent = useCallback((workflow: WorkflowRow): boolean => {
    return (
      (workflow.analysisSelections?.length > 0) ||
      (workflow.stepSelections?.length > 0)
    );
  }, []);

  // TICKET_173: Helper to check if two workflows are identical (moved from Host Shell)
  const isWorkflowEqual = useCallback((a: WorkflowRow, b: WorkflowRow): boolean => {
    return (
      JSON.stringify(a.analysisSelections || []) === JSON.stringify(b.analysisSelections || []) &&
      JSON.stringify(a.preConditionSelections || []) === JSON.stringify(b.preConditionSelections || []) &&
      JSON.stringify(a.stepSelections || []) === JSON.stringify(b.stepSelections || []) &&
      JSON.stringify(a.postConditionSelections || []) === JSON.stringify(b.postConditionSelections || [])
    );
  }, []);

  // TICKET_173: Helper to find duplicate workflow pairs (moved from Host Shell)
  const findDuplicateWorkflows = useCallback((workflows: WorkflowRow[]): [number, number][] => {
    const duplicates: [number, number][] = [];
    for (let i = 0; i < workflows.length; i++) {
      for (let j = i + 1; j < workflows.length; j++) {
        if (isWorkflowEqual(workflows[i], workflows[j])) {
          duplicates.push([i + 1, j + 1]); // 1-indexed for display
        }
      }
    }
    return duplicates;
  }, [isWorkflowEqual]);

  // TICKET_173: Helper to run a single backtest (moved from Host Shell)
  // TICKET_248: Extract timeframes from workflow selections (Phase 1: use first selection's timeframe)
  const runSingleBacktest = useCallback(async (
    workflow: WorkflowRow,
    config: BacktestDataConfig,
    dataResult: any,
    caseIndex: number,
    totalWorkflows: number,
    strategyName?: string
  ): Promise<ExecutorResult> => {
    const api = executorAPI || (window as any).electronAPI?.executor;
    const startTime = Math.floor(new Date(config.startDate).getTime() / 1000);
    const endTime = Math.floor(new Date(config.endDate).getTime() / 1000);

    // TICKET_248: Get timeframe from workflow selections (Phase 1: use first available)
    // Phase 2 will support multi-timeframe data loading
    const getWorkflowTimeframe = (): string => {
      const allSelections = [
        ...workflow.analysisSelections,
        ...workflow.preConditionSelections,
        ...workflow.stepSelections,
        ...workflow.postConditionSelections,
      ];
      return allSelections[0]?.timeframe || '1d';
    };
    const workflowTimeframe = getWorkflowTimeframe();

    // Generate strategy for this specific workflow
    messageAPI?.info(`Generating strategy (${caseIndex}/${totalWorkflows})...`);
    const genResult = await api?.generateWorkflowStrategy({
      workflows: [workflow],
      symbol: config.symbol,
      interval: workflowTimeframe,
      startTime,
      endTime,
      initialCapital: config.initialCapital,
    });

    if (!genResult?.success || !genResult?.strategyPath) {
      throw new Error(`Failed to generate strategy: ${genResult?.error}`);
    }

    console.debug(`[BacktestPage] Strategy ${caseIndex} generated at:`, genResult.strategyPath);

    // Run backtest
    messageAPI?.info(`Running backtest (${caseIndex}/${totalWorkflows})...`);
    setCurrentResult(null);

    // Build executor request inline (TICKET_173: replaces toExecutorRequest import)
    // TICKET_248 Phase 2: Include dataFeeds for multi-timeframe support
    const executorRequest: any = {
      strategyPath: genResult.strategyPath,
      strategyName,
      symbol: config.symbol,
      interval: workflowTimeframe,
      startTime,
      endTime,
      dataPath: dataResult.dataPath || '',
      dataSourceType: 'parquet',
      initialCapital: config.initialCapital,
      orderSize: config.orderSize,
      orderSizeUnit: config.orderSizeUnit,
    };

    // TICKET_248 Phase 2: Pass dataFeeds for multi-timeframe execution
    if (dataResult.dataFeeds && Object.keys(dataResult.dataFeeds).length > 0) {
      executorRequest.dataFeeds = Object.entries(dataResult.dataFeeds).map(
        ([interval, info]: [string, any]) => ({
          interval,
          dataPath: info.dataPath || '',
        })
      );
      console.log('[BacktestPage] Multi-timeframe dataFeeds:', executorRequest.dataFeeds);
    }

    const result = await api?.runBacktest(executorRequest);

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to start backtest');
    }

    console.debug(`[BacktestPage] Backtest ${caseIndex} started with taskId:`, result.taskId);

    if (result.taskId) {
      setCurrentTaskId(result.taskId);
      // TICKET_257: Build workflowTimeframes from workflow selections
      const workflowTimeframes = {
        analysis: workflow.analysisSelections.length > 0 ? workflow.analysisSelections[0].timeframe : null,
        entryFilter: workflow.preConditionSelections.length > 0 ? workflow.preConditionSelections[0].timeframe : null,
        entrySignal: workflow.stepSelections.length > 0 ? workflow.stepSelections[0].timeframe : null,
        exitStrategy: workflow.postConditionSelections.length > 0 ? workflow.postConditionSelections[0].timeframe : null,
      };
      // TICKET_233: Notify global status
      // TICKET_257: Include workflowTimeframes for result page display
      onBacktestStart?.(result.taskId, strategyName || 'Backtest', workflowTimeframes);
    }

    // Wait for completion via Promise
    return new Promise<ExecutorResult>((resolve, reject) => {
      pendingBacktestRef.current = { resolve, reject };
    });
  }, [executorAPI, messageAPI, onBacktestStart]);

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

  // TICKET_163: Show naming dialog instead of direct execute
  const handleShowNamingDialog = useCallback(() => {
    if (isExecuting) return;

    // Validate data configuration first
    if (!validateDataConfig(dataConfig)) {
      console.error('[BacktestPage] Data configuration validation failed');
      return;
    }

    // Show naming dialog
    setNamingDialogVisible(true);
  }, [isExecuting, dataConfig, validateDataConfig]);

  // TICKET_163: Handle naming dialog confirm - execute with strategy name
  // TICKET_173: Full execution logic moved from Host Shell
  const handleConfirmNaming = useCallback(async (strategyName: string) => {
    setNamingDialogVisible(false);
    setExecuteError(null);

    console.log('[BacktestPage] Executing backtest with name:', strategyName);
    console.log('[BacktestPage] Config:', dataConfig);
    console.log('[BacktestPage] Workflow rows:', workflowRows);

    // Filter workflows with content
    const activeWorkflows = workflowRows.filter(hasWorkflowContent);
    if (activeWorkflows.length === 0) {
      messageAPI?.error('No workflows configured. Please add at least one algorithm selection.');
      return;
    }

    // Check for duplicate workflows
    if (activeWorkflows.length > 1) {
      const duplicates = findDuplicateWorkflows(activeWorkflows);
      if (duplicates.length > 0) {
        const duplicateText = duplicates.map(([a, b]) => `Case ${a} and Case ${b}`).join(', ');
        const confirmed = await messageAPI?.confirm(
          `${duplicateText} have identical configurations.\nRunning duplicate cases will produce the same results.`,
          {
            title: 'Duplicate Cases Detected',
            okText: 'Continue Anyway',
            cancelText: 'Cancel',
          }
        );
        if (!confirmed) {
          console.debug('[BacktestPage] User cancelled due to duplicate cases');
          return;
        }
      }
    }

    // Clear previous results and set executing state
    setBacktestResults([]);
    setCurrentResult(null);
    setIsExecuting(true);
    setTotalCases(activeWorkflows.length);
    setCurrentCaseIndex(0);

    try {
      // Step 1: Ensure data is available
      const dataApi = dataAPI || (window as any).electronAPI?.data;
      messageAPI?.info(`Loading market data for ${dataConfig.symbol}...`);

      // TICKET_248 Phase 2: Extract unique timeframes from all workflow selections
      const timeframes = extractUniqueTimeframes(activeWorkflows);
      console.log('[BacktestPage] Extracted timeframes:', timeframes);

      // TICKET_248 Phase 2: Load data for all required timeframes
      let dataResult: any;

      if (timeframes.length > 1 && dataApi?.ensureMultiTimeframe) {
        // Multi-timeframe mode
        const multiRequest = {
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          timeframes,
          provider: dataConfig.dataSource,
          forceDownload: false,
        };

        console.log('[BacktestPage] Fetching multi-timeframe data:', multiRequest);
        dataResult = await dataApi.ensureMultiTimeframe(multiRequest);

        if (!dataResult?.success) {
          messageAPI?.error(`Failed to load market data: ${dataResult?.error}`);
          setIsExecuting(false);
          return;
        }

        const totalBars = Object.values(dataResult.dataFeeds || {}).reduce(
          (sum: number, feed: any) => sum + (feed.totalBars || 0), 0
        );
        messageAPI?.success(`Loaded ${totalBars} bars across ${timeframes.length} timeframe(s)`);
      } else {
        // Single timeframe mode (legacy fallback)
        const singleRequest = {
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          interval: timeframes[0] || '1d',
          provider: dataConfig.dataSource,
          forceDownload: false,
        };

        console.debug('[BacktestPage] Fetching single-timeframe data:', singleRequest);
        dataResult = await dataApi?.ensure(singleRequest);

        if (!dataResult?.success) {
          messageAPI?.error(`Failed to load market data: ${dataResult?.error}`);
          setIsExecuting(false);
          return;
        }

        const barsLoaded = dataResult.coverage?.totalBars || dataResult.downloadStats?.barsImported || 0;
        messageAPI?.success(`Loaded ${barsLoaded} bars for ${dataConfig.symbol}`);
      }

      console.debug('[BacktestPage] Data loaded:', dataResult);

      // Execute each workflow sequentially
      const results: ExecutorResult[] = [];

      for (let i = 0; i < activeWorkflows.length; i++) {
        const workflow = activeWorkflows[i];
        setCurrentCaseIndex(i + 1);
        setExecutorProgress(0);  // TICKET_228: Reset progress for each case

        try {
          const result = await runSingleBacktest(
            workflow,
            dataConfig,
            dataResult,
            i + 1,
            activeWorkflows.length,
            strategyName
          );

          results.push(result);
          setBacktestResults([...results]);
          messageAPI?.success(`Backtest ${i + 1}/${activeWorkflows.length} completed!`);
        } catch (error) {
          console.error(`[BacktestPage] Backtest ${i + 1} failed:`, error);
          messageAPI?.error(`Backtest ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Final state
      if (results.length > 0) {
        setBacktestResults(results);
        messageAPI?.success(`All ${results.length} backtest(s) completed!`);
      } else {
        messageAPI?.error('All backtests failed');
      }
      setIsExecuting(false);
    } catch (error) {
      messageAPI?.error('Failed to execute backtest. Please check the logs.');
      console.error('[BacktestPage] Execute error:', error);
      setExecuteError(error instanceof Error ? error.message : 'Execution failed');
      setIsExecuting(false);
    }
  }, [dataConfig, workflowRows, hasWorkflowContent, findDuplicateWorkflows, runSingleBacktest, dataAPI, messageAPI]);

  // TICKET_163: Handle naming dialog cancel
  const handleCancelNaming = useCallback(() => {
    setNamingDialogVisible(false);
  }, []);

  return (
    <div className="h-full flex bg-color-terminal-bg text-color-terminal-text">
      {/* Zone B: History Sidebar - TICKET_077_18 Modularized */}
      <BacktestHistorySidebar
        isExecuting={isExecuting}
        currentCaseIndex={currentCaseIndex}
        totalCases={totalCases}
        resultsCount={backtestResults.length}
        historyItems={historyItems}
        historyLoading={historyLoading}
        checkpointInfo={checkpointInfo ? {
          taskId: checkpointInfo.taskId,
          progressPercent: checkpointInfo.progressPercent,
        } : null}
        showCheckpointPanel={showCheckpointPanel}
        onHistoryItemClick={handleHistoryItemClick}
        onDeleteClick={handleDeleteClick}
        onCaseClick={handleCaseClick}
        onShowCheckpointPanel={() => setShowCheckpointPanel(true)}
      />

      {/* Zone C + Zone D */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Zone C: Config or Result based on state */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TICKET_162: Show selected history result (page41) */}
          {selectedHistoryResult ? (
            <div className="h-full flex flex-col">
              {/* TICKET_162: History result title header - two rows */}
              {selectedHistoryItem && (
                <div className="flex-shrink-0 mb-4 px-4 py-3 rounded border border-color-terminal-border bg-color-terminal-panel/50 space-y-2">
                  {/* Row 1: Strategy, Symbol, Timeframe, Data Range, Return */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-color-terminal-text">
                        {selectedHistoryItem.name}
                      </span>
                      <span className="text-xs text-color-terminal-text-muted">|</span>
                      <span className="text-sm font-bold text-color-terminal-accent-teal">
                        {selectedHistoryItem.symbol}
                      </span>
                      <span className="text-xs text-color-terminal-text-secondary">
                        {selectedHistoryItem.timeframe}
                      </span>
                      <span className="text-xs text-color-terminal-text-muted">
                        {selectedHistoryItem.startDate} ~ {selectedHistoryItem.endDate}
                      </span>
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      (selectedHistoryItem.totalReturn ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {selectedHistoryItem.totalReturn !== null
                        ? `${(selectedHistoryItem.totalReturn >= 0 ? '+' : '')}${(selectedHistoryItem.totalReturn * 100).toFixed(2)}%`
                        : '-'}
                    </span>
                  </div>
                  {/* Row 2: Cap, Size, Test Time */}
                  <div className="flex items-center justify-between text-[11px] text-color-terminal-text-muted">
                    <div className="flex items-center gap-4">
                      <span>Cap: <span className="text-color-terminal-text-secondary">
                        ${selectedHistoryItem.initialCapital >= 1000
                          ? `${(selectedHistoryItem.initialCapital / 1000).toFixed(0)}K`
                          : selectedHistoryItem.initialCapital}
                      </span></span>
                      {selectedHistoryItem.orderSize !== null && selectedHistoryItem.orderSizeUnit && (
                        <span>Size: <span className="text-color-terminal-text-secondary">
                          {selectedHistoryItem.orderSizeUnit === 'percent'
                            ? `${selectedHistoryItem.orderSize}%`
                            : selectedHistoryItem.orderSizeUnit === 'cash'
                              ? `$${selectedHistoryItem.orderSize}`
                              : `${selectedHistoryItem.orderSize}sh`}
                        </span></span>
                      )}
                    </div>
                    <span>Tested: <span className="text-color-terminal-text-secondary">{selectedHistoryItem.createdAt}</span></span>
                  </div>
                </div>
              )}
              <BacktestResultPanel
                results={[selectedHistoryResult]}
                className="flex-1"
                isExecuting={false}
                currentCaseIndex={1}
                totalCases={1}
              />
            </div>
          ) : /* TICKET_227: Show executing status or completed results */
          isExecuting ? (
            /* TICKET_227: During execution, show status panel with real-time data if available */
            currentResult ? (
              <BacktestResultPanel
                results={[currentResult]}
                className="h-full"
                isExecuting={isExecuting}
                currentCaseIndex={currentCaseIndex}
                totalCases={totalCases}
                onCaseSelect={handleCaseClick}
                scrollToCase={scrollToCaseIndex}
                processedBars={processedBars}
                backtestTotalBars={backtestTotalBars}
              />
            ) : (
              /* TICKET_227: No incremental data yet (backtrader), show execution status */
              /* TICKET_228: Use executorProgress for actual execution progress */
              <div className="h-full flex flex-col items-center justify-center">
                <ExecutorStatusPanel
                  status="running"
                  progress={executorProgress}
                  message={totalCases > 1
                    ? `Running backtest ${currentCaseIndex}/${totalCases}...`
                    : 'Running backtest...'
                  }
                />
                <div className="mt-4 text-xs text-color-terminal-text-muted">
                  Real-time chart will appear when data is available
                </div>
              </div>
            )
          ) : backtestResults.length > 0 ? (
            /* Component 9: Backtest Result Panel - pass all results for comparison */
            <BacktestResultPanel
              results={backtestResults}
              className="h-full"
              isExecuting={isExecuting}
              currentCaseIndex={currentCaseIndex}
              totalCases={totalCases}
              onCaseSelect={handleCaseClick}
              scrollToCase={scrollToCaseIndex}
            />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-color-terminal-text-muted">
                {t('page.loadingAlgorithms')}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Component 8: Executor Status Panel (shown when executing) */}
              {/* TICKET_151: Show progress for sequential execution */}
              {/* TICKET_228: Use executorProgress for actual execution progress */}
              {isExecuting && (
                <ExecutorStatusPanel
                  status="running"
                  progress={executorProgress}
                  message={totalCases > 1
                    ? `Running backtest ${currentCaseIndex}/${totalCases}...`
                    : 'Running backtest...'
                  }
                />
              )}

              {/* TICKET_176_1: Checkpoint Resume Panel */}
              {showCheckpointPanel && checkpointInfo && (
                <CheckpointResumePanel
                  checkpoint={checkpointInfo}
                  onResume={handleCheckpointResume}
                  onDiscard={handleCheckpointDiscard}
                  isResuming={isResuming}
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
                title={t('page.workflowTitle')}
                rows={workflowRows}
                onChange={setWorkflowRows}
                algorithms={algorithms}
                maxRows={10}
                disableConditions={true}
                disableAnalysis={cockpitMode === 'trader'}
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
          {/* TICKET_162: Check selectedHistoryResult or results array */}
          {selectedHistoryResult ? (
            /* Show "New Backtest" button when history result is displayed - smaller, right-aligned */
            <div className="flex justify-end">
              <button
                onClick={handleClearHistoryResult}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all border-color-terminal-accent-teal bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal hover:bg-color-terminal-accent-teal/20"
              >
                <PlayIcon className="w-3 h-3" />
                {t('buttons.newBacktest')}
              </button>
            </div>
          ) : /* TICKET_151: Check backtestResults array instead of single result */
          backtestResults.length > 0 ? (
            /* TICKET_171: Action buttons - Keep, Discard, Export (left-aligned) */
            <div className="flex justify-start gap-3">
              {/* Keep: preserve result, return to config, preserve config */}
              <button
                onClick={handleKeepResult}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all border-color-terminal-accent-teal bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal hover:bg-color-terminal-accent-teal/20"
              >
                <CheckIcon className="w-3 h-3" />
                {t('buttons.keep')}
              </button>
              {/* Discard: delete from DB, return to config, reset config */}
              <button
                onClick={handleDiscardResult}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                <XIcon className="w-3 h-3" />
                {t('buttons.discard')}
              </button>
              {/* TICKET_264: Export to Quant Lab - only shown when plugin is available */}
              {!isQuantLabLoading && isQuantLabAvailable && (
                <button
                  onClick={handleExportClick}
                  disabled={isExporting}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all",
                    isExporting
                      ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                      : "border-[#a78bfa] bg-[#a78bfa]/10 text-[#a78bfa] hover:bg-[#a78bfa]/20"
                  )}
                >
                  <ExportIcon className="w-3 h-3" />
                  {isExporting ? t('buttons.exporting') : t('buttons.exportToQuantLab')}
                </button>
              )}
            </div>
          ) : (
            /* TICKET_171: Reset left, Execute right */
            <div className="flex justify-between items-center">
              {/* Reset button - left */}
              <button
                onClick={handleReset}
                disabled={isExecuting}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all",
                  isExecuting
                    ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                    : "border-color-terminal-text-muted bg-transparent text-color-terminal-text-secondary hover:border-color-terminal-text-secondary hover:text-color-terminal-text"
                )}
              >
                <RotateCcwIcon className="w-3 h-3" />
                {t('buttons.reset')}
              </button>
              {/* Execute button - right (same height as Reset) */}
              <button
                onClick={handleShowNamingDialog}
                disabled={isExecuting}
                className={cn(
                  "flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-wider border rounded transition-all",
                  isExecuting
                    ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                    : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
                )}
              >
                {isExecuting ? (
                  <>
                    <LoaderIcon className="w-3 h-3 animate-spin" />
                    {t('buttons.executing')}
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-3 h-3" />
                    {t('buttons.execute')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TICKET_160: Delete confirmation dialog */}
      {deleteConfirm.visible && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
          onClick={handleCancelDelete}
        >
          <div
            className="min-w-[320px] max-w-[400px] rounded-lg border border-color-terminal-border bg-color-terminal-surface shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-color-terminal-border border-l-[3px] border-l-red-500 bg-color-terminal-panel rounded-t-lg">
              <TrashIcon className="w-[18px] h-[18px] text-red-500" />
              <span className="flex-1 font-mono text-xs font-semibold text-color-terminal-text uppercase tracking-wider">
                {t('dialog.deleteTitle')}
              </span>
            </div>
            {/* Body */}
            <div className="px-4 py-6">
              <p className="font-mono text-xs leading-relaxed text-color-terminal-text text-center">
                {t('dialog.deleteMessage')}
              </p>
            </div>
            {/* Footer */}
            <div className="flex justify-center gap-3 px-4 py-4 border-t border-color-terminal-border">
              <button
                onClick={handleCancelDelete}
                className="min-w-[80px] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider rounded border border-color-terminal-border bg-transparent text-color-terminal-text-secondary hover:border-color-terminal-text-muted hover:text-color-terminal-text transition-all"
              >
                {t('buttons.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="min-w-[80px] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider rounded border border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                autoFocus
              >
                {t('buttons.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET_163: Naming dialog (component10) */}
      <NamingDialog
        visible={namingDialogVisible}
        context="backtest"
        contextData={{
          symbol: dataConfig.symbol,
          timeframe: dataConfig.timeframe,
        }}
        onConfirm={handleConfirmNaming}
        onCancel={handleCancelNaming}
      />

      {/* TICKET_264: Export to Quant Lab naming dialog */}
      <NamingDialog
        visible={exportDialogVisible}
        context="export"
        contextData={{
          workflowName: currentResult ? `${dataConfig.symbol}_${dataConfig.timeframe}` : undefined,
          analysisName: workflowRows.find(r => r.type === 'trendRange')?.selectedAlgorithmId
            ? algorithms.trendRange.find(a => a.id === workflowRows.find(r => r.type === 'trendRange')?.selectedAlgorithmId)?.name
            : undefined,
          entryName: workflowRows.find(r => r.type === 'selectSteps')?.selectedAlgorithmId
            ? algorithms.selectSteps.find(a => a.id === workflowRows.find(r => r.type === 'selectSteps')?.selectedAlgorithmId)?.name
            : undefined,
        }}
        onConfirm={handleExportConfirm}
        onCancel={handleExportCancel}
      />
    </div>
  );
};

export default BacktestPage;
