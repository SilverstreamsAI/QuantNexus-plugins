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

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// TICKET_151_1: ChevronDown icon for BACKTESTING tree
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
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

// TICKET_176_1: Pause icon for checkpoint badge
const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

// TICKET_171: Reset icon for config page
const RotateCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HistoryItem {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  totalReturn: number | null;
  // Backtest parameters
  startDate: string;
  endDate: string;
  initialCapital: number;
  orderSize: number | null;
  orderSizeUnit: string | null;
  // Timestamp with seconds
  createdAt: string;
  status: 'completed' | 'failed' | 'running';
}

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

// TICKET_173: API types from Host (use any to avoid type dependency on Host types)
interface BacktestPageProps {
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
  executorAPI,
  dataAPI,
  messageAPI,
  onResultViewChange,
  resetKey = 0,
}) => {
  const { t } = useTranslation('backtest');

  // TICKET_173: State moved from Host Shell
  const [backtestResults, setBacktestResults] = useState<ExecutorResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ExecutorResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const pendingBacktestRef = useRef<BacktestResolver | null>(null);
  // TICKET_153_1: History from SQLite
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
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
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // TICKET_163: Naming dialog state
  const [namingDialogVisible, setNamingDialogVisible] = useState(false);

  // TICKET_176_1: Checkpoint state
  const [checkpointInfo, setCheckpointInfo] = useState<CheckpointInfo | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [showCheckpointPanel, setShowCheckpointPanel] = useState(false);

  // TICKET_173: Track if viewing history result (for breadcrumb)
  const [hasHistoryResult, setHasHistoryResult] = useState(false);

  // TICKET_173: Determine if viewing results (execution or history)
  const isResultView = backtestResults.length > 0 || hasHistoryResult;

  // TICKET_173: Centralized state reset helper
  const clearResultState = useCallback(() => {
    setBacktestResults([]);
    setCurrentResult(null);
    setCurrentCaseIndex(0);
    setTotalCases(0);
    setHasHistoryResult(false);
    setCurrentTaskId(null);
  }, []);

  // TICKET_173: Notify Host when result view state changes
  useEffect(() => {
    onResultViewChange?.(isResultView);
  }, [isResultView, onResultViewChange]);

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
        const items: HistoryItem[] = result.data.map((record: any) => ({
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
      if (pendingBacktestRef.current) {
        pendingBacktestRef.current.resolve(data.result as ExecutorResult);
        pendingBacktestRef.current = null;
      }
      setCurrentResult(data.result as ExecutorResult);
    });

    const unsubError = api.onError((data: any) => {
      console.error('[BacktestPage] Backtest error:', data);
      if (pendingBacktestRef.current) {
        pendingBacktestRef.current.reject(new Error(data.error));
        pendingBacktestRef.current = null;
      }
      setIsExecuting(false);
      messageAPI?.error(`Backtest failed: ${data.error}`);
    });

    const unsubProgress = api.onProgress((data: any) => {
      console.debug('[BacktestPage] Backtest progress:', data);
    });

    // Throttled buffer for incremental updates
    type IncrementData = any;
    const pendingBuffer: IncrementData[] = [];
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const THROTTLE_MS = 100;

    const flushBuffer = () => {
      if (isCompleted || pendingBuffer.length === 0) return;

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
  }, [executorAPI, messageAPI]);

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

    // Generate strategy for this specific workflow
    messageAPI?.info(`Generating strategy (${caseIndex}/${totalWorkflows})...`);
    const genResult = await api?.generateWorkflowStrategy({
      workflows: [workflow],
      symbol: config.symbol,
      interval: config.timeframe,
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
    const executorRequest = {
      strategyPath: genResult.strategyPath,
      strategyName,
      symbol: config.symbol,
      interval: config.timeframe,
      startTime,
      endTime,
      dataPath: dataResult.dataPath,
      dataSourceType: 'parquet',
      initialCapital: config.initialCapital,
      orderSize: config.orderSize,
      orderSizeUnit: config.orderSizeUnit,
    };

    const result = await api?.runBacktest(executorRequest);

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to start backtest');
    }

    console.debug(`[BacktestPage] Backtest ${caseIndex} started with taskId:`, result.taskId);

    if (result.taskId) {
      setCurrentTaskId(result.taskId);
    }

    // Wait for completion via Promise
    return new Promise<ExecutorResult>((resolve, reject) => {
      pendingBacktestRef.current = { resolve, reject };
    });
  }, [executorAPI, messageAPI]);

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

      const dataRequest = {
        symbol: dataConfig.symbol,
        startDate: dataConfig.startDate,
        endDate: dataConfig.endDate,
        interval: dataConfig.timeframe,
        provider: dataConfig.dataSource,
        forceDownload: false,
      };

      console.debug('[BacktestPage] Fetching data:', dataRequest);
      const dataResult = await dataApi?.ensure(dataRequest);

      if (!dataResult?.success) {
        messageAPI?.error(`Failed to load market data: ${dataResult?.error}`);
        setIsExecuting(false);
        return;
      }

      const barsLoaded = dataResult.coverage?.totalBars || dataResult.downloadStats?.barsImported || 0;
      messageAPI?.success(`Loaded ${barsLoaded} bars for ${dataConfig.symbol}`);
      console.debug('[BacktestPage] Data loaded:', dataResult);

      // Execute each workflow sequentially
      const results: ExecutorResult[] = [];

      for (let i = 0; i < activeWorkflows.length; i++) {
        const workflow = activeWorkflows[i];
        setCurrentCaseIndex(i + 1);

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
      {/* Zone B: History Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-color-terminal-border bg-color-terminal-panel/30 flex flex-col">
        <div className="px-4 py-3 border-b border-color-terminal-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-color-terminal-text-muted" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
                {t('sidebar.history')}
              </span>
            </div>
            {/* TICKET_176_1: Checkpoint badge indicator */}
            {checkpointInfo && !showCheckpointPanel && (
              <button
                onClick={() => setShowCheckpointPanel(true)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-amber-500/15 border border-amber-500/50 text-amber-400 hover:bg-amber-500/25 transition-colors"
                title={`Checkpoint: ${checkpointInfo.progressPercent}% completed`}
              >
                <PauseIcon className="w-3 h-3" />
                <span>{checkpointInfo.progressPercent}%</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* TICKET_151_1: Show BACKTESTING tree during execution or when results exist */}
          {(isExecuting || backtestResults.length > 0) ? (
            <div className="space-y-1">
              {/* L1: BACKTESTING header */}
              <div className="w-full px-3 py-2 text-left">
                <ChevronDownIcon className="w-3 h-3 inline mr-1 text-color-terminal-text-muted" />
                <span className="text-xs font-bold uppercase text-color-terminal-text-secondary">
                  {t('sidebar.backtesting')}
                </span>
              </div>

              {/* L2: Case list */}
              {Array.from({ length: totalCases || backtestResults.length }).map((_, i) => {
                const caseNum = i + 1;
                const isCompleted = caseNum < currentCaseIndex || !isExecuting;
                const isRunning = isExecuting && caseNum === currentCaseIndex;
                // isPending = isExecuting && caseNum > currentCaseIndex (gray color)

                return (
                  <button
                    key={i}
                    onClick={() => handleCaseClick(i)}
                    className={cn(
                      "w-full px-6 py-1.5 text-left text-xs rounded transition-colors",
                      "hover:bg-white/5"
                    )}
                  >
                    <span style={{ color: isCompleted ? '#4ade80' : isRunning ? '#fbbf24' : '#6b7280' }}>
                      {caseNum}{isRunning ? ` ${t('sidebar.testing')}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : historyLoading ? (
            <div className="px-2 py-8 text-center">
              <LoaderIcon className="w-6 h-6 mx-auto mb-2 text-color-terminal-text-muted animate-spin" />
              <p className="text-[11px] text-color-terminal-text-muted">{t('sidebar.loading')}</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <HistoryIcon className="w-8 h-8 mx-auto mb-3 text-color-terminal-text-muted opacity-50" />
              <p className="text-[11px] text-color-terminal-text-muted">
                {t('sidebar.noHistory')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item) => {
                const isProfit = (item.totalReturn ?? 0) >= 0;
                const returnStr = item.totalReturn !== null
                  ? `${isProfit ? '+' : ''}${(item.totalReturn * 100).toFixed(1)}%`
                  : '-';
                const capitalStr = item.initialCapital >= 1000
                  ? `$${(item.initialCapital / 1000).toFixed(0)}K`
                  : `$${item.initialCapital}`;
                // Format order size display
                const orderSizeStr = item.orderSize !== null && item.orderSizeUnit
                  ? item.orderSizeUnit === 'percent'
                    ? `${item.orderSize}%`
                    : item.orderSizeUnit === 'cash'
                      ? `$${item.orderSize}`
                      : `${item.orderSize}sh`
                  : null;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleHistoryItemClick(item.id)}
                    className={cn(
                      "group w-full px-3 py-2 text-left rounded transition-colors cursor-pointer",
                      "hover:bg-white/5 border border-transparent hover:border-white/10"
                    )}
                  >
                    {/* Row 1: Strategy name + Return */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-color-terminal-text truncate flex-1">
                        {item.name}
                      </span>
                      <span className={cn(
                        "text-xs font-bold ml-2",
                        isProfit ? "text-green-400" : "text-red-400"
                      )}>
                        {returnStr}
                      </span>
                    </div>
                    {/* Row 2: Symbol + Timeframe */}
                    <div className="flex items-center gap-2 text-[10px] text-color-terminal-text-muted mb-1">
                      <span className="text-color-terminal-accent-teal">{item.symbol}</span>
                      <span>{item.timeframe}</span>
                    </div>
                    {/* Row 3: Capital + OrderSize with labels */}
                    <div className="flex items-center gap-3 text-[9px] text-color-terminal-text-muted/80 mb-1">
                      <span>Cap: <span className="text-color-terminal-text-secondary">{capitalStr}</span></span>
                      {orderSizeStr && <span>Size: <span className="text-color-terminal-text-secondary">{orderSizeStr}</span></span>}
                    </div>
                    {/* Row 4: Date range */}
                    <div className="text-[9px] text-color-terminal-text-muted/70 mb-1">
                      {item.startDate} ~ {item.endDate}
                    </div>
                    {/* Row 5: Created timestamp + Delete button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-color-terminal-text-muted/50">
                        {item.createdAt}
                      </span>
                      {/* TICKET_160: Delete button - always visible, highlight on hover */}
                      <button
                        onClick={(e) => handleDeleteClick(e, item.id)}
                        className={cn(
                          "p-0.5 rounded transition-all",
                          "text-color-terminal-text-muted opacity-50 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10"
                        )}
                        title="Delete"
                      >
                        <TrashIcon className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
          ) : /* TICKET_151: Show results if we have completed results */
          backtestResults.length > 0 ? (
            /* Component 9: Backtest Result Panel - pass all results for comparison */
            /* TICKET_151_1: Pass execution state for Charts stacking and Compare tab behavior */
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
            /* TICKET_171: Two action buttons - Keep, Discard (left-aligned) */
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
    </div>
  );
};

export default BacktestPage;
