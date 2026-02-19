/**
 * BacktestPage Component - Plugin Layer
 *
 * Backtest Nexus page following TICKET_077 layout specification.
 * Zones: B (Sidebar - History), C (BacktestDataConfigPanel + WorkflowRowSelector), D (Action Bar - Execute)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_077_COMPONENT8 - BacktestDataConfigPanel Design
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  type ExecutorResult,
  NamingDialog,
  CheckpointResumePanel,
  BacktestHistorySidebar,
  type BacktestHistoryItem,
  PageHeader,
} from '../ui';
import { algorithmService, toAlgorithmOption } from '../../services/algorithmService';
import { extractUniqueTimeframes } from '../../utils/timeframe-utils';
import { formatDateTime } from '@shared/utils/format-locale';
import { computeMinStartDate } from '@shared/utils/lookback-constraints';
import type { TimeframeValue } from '../ui/TimeframeDropdown';
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

/** Cockpit mode determines algorithm filtering */
export type CockpitMode = 'indicators' | 'kronos' | 'trader';

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
  /** TICKET_268: Include workflowExportData for Quant Lab export */
  onBacktestStart?: (
    taskId: string,
    strategyName: string,
    workflowTimeframes?: {
      analysis: string | null;
      entryFilter: string | null;
      entrySignal: string | null;
      exitStrategy: string | null;
    },
    workflowExportData?: {
      analysis: { algorithmId: string; algorithmName: string; algorithmCode: string; baseClass: string; timeframe: string; parameters: Record<string, unknown> };
      entry: { algorithmId: string; algorithmName: string; algorithmCode: string; baseClass: string; timeframe: string; parameters: Record<string, unknown> };
      exit?: { algorithmId: string; algorithmName: string; algorithmCode: string; baseClass: string; timeframe: string; parameters: Record<string, unknown> } | null;
      symbol: string;
      dateRange: { start: string; end: string };
    },
    /** TICKET_378: Backtest configuration summary for result page display */
    backtestConfig?: {
      dataSource: string;
      symbol: string;
      startDate: string;
      endDate: string;
      initialCapital: number;
      orderSize: number;
      orderSizeUnit: string;
    }
  ) => void;
  /** TICKET_327: Notify Host when execution begins (before data download)
   *  TICKET_352_5: Includes caller-generated taskId for immediate tab creation
   *  TICKET_365: 3rd arg is config snapshot for cancel -> go back preservation */
  onExecutionBegin?: (strategyName: string, taskId: string, configSnapshot?: {
    cockpit: string;
    dataConfig: { symbol: string; dataSource: string; startDate: string; endDate: string; initialCapital: number; orderSize: number; orderSizeUnit: string };
    workflowRows: unknown[];
  }) => void;
  /** TICKET_308: Page title for PageHeader Zone A */
  pageTitle?: string;
  /** TICKET_308: Settings gear click handler for PageHeader Zone A */
  onSettingsClick?: () => void;
  /** TICKET_365: Restored config from cancel -> go back flow */
  initialConfig?: {
    dataConfig: { symbol: string; dataSource: string; startDate: string; endDate: string; initialCapital: number; orderSize: number; orderSizeUnit: string };
    workflowRows: unknown[];
  };
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
  dataSource: 'yfinance',
  startDate: '',
  endDate: '',
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
  onExecutionBegin,
  pageTitle,
  onSettingsClick,
  initialConfig,
}) => {
  const { t } = useTranslation('backtest');

  // TICKET_173: State moved from Host Shell
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  // TICKET_153_1: History from SQLite
  const [historyItems, setHistoryItems] = useState<BacktestHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // TICKET_365: Restore workflowRows from initialConfig if available (cancel -> go back)
  const [workflowRows, setWorkflowRows] = useState<WorkflowRow[]>(
    () => (initialConfig?.workflowRows as WorkflowRow[]) || [createInitialRow()]
  );
  const [algorithms, setAlgorithms] = useState(EMPTY_ALGORITHMS);
  const [loading, setLoading] = useState(true);

  // Component 8: Data configuration state
  // TICKET_365: Restore dataConfig from initialConfig if available (cancel -> go back)
  const [dataConfig, setDataConfig] = useState<BacktestDataConfig>(
    () => (initialConfig?.dataConfig as BacktestDataConfig) || createDefaultDataConfig()
  );
  // TICKET_077_COMPONENT8: Empty initial state, populated by two-phase loading
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [dataConfigErrors, setDataConfigErrors] = useState<Partial<Record<keyof BacktestDataConfig, string>>>({});
  // TICKET_143: Separate execution error from field errors
  const [executeError, setExecuteError] = useState<string | null>(null);

  // TICKET_139: Track auth state to refresh ClickHouse connection on login
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // TICKET_334: Ref for isAuthenticated so provider effect callback reads latest value
  // without requiring isAuthenticated in the effect dependency array
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

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
  const { isAvailable: isQuantLabAvailable, isLoading: isQuantLabLoading, error: quantLabError } = useQuantLabAvailable();
  const { exportWorkflow, isExporting } = useExportToQuantLab();
  const [exportDialogVisible, setExportDialogVisible] = useState(false);

  // TICKET_267: Log QuantLab availability state
  useEffect(() => {
    console.log('[TICKET_267] BacktestPage: QuantLab state - isAvailable:', isQuantLabAvailable, 'isLoading:', isQuantLabLoading, 'error:', quantLabError);
  }, [isQuantLabAvailable, isQuantLabLoading, quantLabError]);

  // TICKET_267: Log render branch state
  useEffect(() => {
    const renderBranch = selectedHistoryResult ? 'PAGE41_HISTORY' : isExecuting ? 'EXECUTING' : 'CONFIG_VIEW';
    console.log('[TICKET_267] BacktestPage: Render branch=' + renderBranch + ', selectedHistoryResult=' + !!selectedHistoryResult + ', isExecuting=' + isExecuting);
  }, [selectedHistoryResult, isExecuting]);

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
  const isResultView = isExecuting || hasHistoryResult;

  // TICKET_173: Centralized state reset helper
  const clearResultState = useCallback(() => {
    setCurrentCaseIndex(0);
    setTotalCases(0);
    setHasHistoryResult(false);
    setCurrentTaskId(null);
  }, []);

  // TICKET_173: Notify Host when result view state changes
  // TICKET_227: Debug logging for page switch
  useEffect(() => {
    console.debug('[TICKET_227] isResultView changed:', {
      isResultView,
      isExecuting,
      hasHistoryResult,
    });
    onResultViewChange?.(isResultView);
  }, [isResultView, onResultViewChange, isExecuting, hasHistoryResult]);

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
          createdAt: formatDateTime(record.created_at),
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

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
    // WorkflowRow has: analysisSelections, preConditionSelections, stepSelections, postConditionSelections
    const firstRow = workflowRows[0];
    if (!firstRow) {
      messageAPI?.error('No workflow configuration found');
      return;
    }

    const analysisSelection = firstRow.analysisSelections[0];
    const entrySelection = firstRow.stepSelections[0];
    const exitSelection = firstRow.postConditionSelections[0];

    if (!analysisSelection || !entrySelection) {
      messageAPI?.error('Missing analysis or entry algorithm');
      return;
    }

    try {
      await exportWorkflow({
        name: finalName,
        workflow: {
          analysis: {
            algorithmId: String(analysisSelection.id),
            algorithmName: analysisSelection.strategyName,
            algorithmCode: analysisSelection.code || '',
            baseClass: 'RegimeStateBase',
            timeframe: analysisSelection.timeframe || dataConfig.timeframe || '1d',
            parameters: {},
          },
          entry: {
            algorithmId: String(entrySelection.id),
            algorithmName: entrySelection.strategyName,
            algorithmCode: entrySelection.code || '',
            baseClass: 'RegimeTrendEntryBase',
            timeframe: entrySelection.timeframe || dataConfig.timeframe || '1d',
            parameters: {},
          },
          exit: exitSelection ? {
            algorithmId: String(exitSelection.id),
            algorithmName: exitSelection.strategyName,
            algorithmCode: exitSelection.code || '',
            baseClass: 'ExitSignalBase',
            timeframe: exitSelection.timeframe || dataConfig.timeframe || '1d',
            parameters: {},
          } : undefined,
          symbol: dataConfig.symbol,
          dateRange: {
            start: dataConfig.startDate,
            end: dataConfig.endDate,
          },
        },
        backtestMetrics: {
          sharpe: selectedHistoryResult?.metrics?.sharpeRatio || 0,
          maxDrawdown: selectedHistoryResult?.metrics?.maxDrawdown || 0,
          winRate: selectedHistoryResult?.metrics?.winRate || 0,
          totalTrades: selectedHistoryResult?.metrics?.totalTrades || 0,
          profitFactor: selectedHistoryResult?.metrics?.profitFactor,
        },
      });

      messageAPI?.success(`Exported "${finalName}" to Quant Lab`);
    } catch (error) {
      console.error('[BacktestPage] Export error:', error);
      messageAPI?.error('Failed to export to Quant Lab');
    }
  }, [workflowRows, dataConfig, selectedHistoryResult, exportWorkflow, messageAPI]);

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

  // TICKET_077_COMPONENT8: Two-phase provider loading
  // Phase 1: Sync metadata (instant) -> all providers with status='checking'
  // Phase 2: TICKET_332 Progressive per-provider events -> each provider enables independently
  useEffect(() => {
    const api = (window as any).electronAPI;

    // Phase 1: Sync provider list (no connection checks, instant)
    try {
      if (api?.data?.getProviderList) {
        api.data.getProviderList().then((providers: Array<{
          id: string; name: string;
          capabilities?: { requiresAuth?: boolean; intervals?: string[]; maxLookback?: Record<string, string> }
        }>) => {
          const syncSources: DataSourceOption[] = providers.map((p) => ({
            id: p.id,
            name: p.name,
            status: 'checking' as const,
            requiresAuth: p.capabilities?.requiresAuth ?? false,
            intervals: p.capabilities?.intervals,
            maxLookback: p.capabilities?.maxLookback,
          }));
          setDataSources(syncSources);
          console.log('[BacktestPage] Phase 1: Provider list loaded:', syncSources.map((s: DataSourceOption) => s.name).join(', '));
        }).catch((error: unknown) => {
          console.error('[BacktestPage] Phase 1 failed:', error);
        });
      }
    } catch (error) {
      console.error('[BacktestPage] Phase 1 failed:', error);
    }

    // Phase 2: TICKET_332 Progressive per-provider status events
    let unsubProviderStatus: (() => void) | undefined;
    try {
      if (api?.data?.onProviderStatus) {
        unsubProviderStatus = api.data.onProviderStatus((event: {
          id: string;
          status: 'connected' | 'disconnected' | 'error';
          latencyMs?: number;
          error?: string;
        }) => {
          setDataSources(prev => prev.map(ds =>
            ds.id === event.id
              ? { ...ds, status: event.status, latencyMs: event.latencyMs }
              : ds
          ));

          // TICKET_293: Auto-switch away from auth-required provider when not authenticated
          if (!isAuthRef.current && (event.status === 'connected')) {
            setDataConfig(prev => {
              const currentSource = prev.dataSource;
              if (currentSource === event.id) return prev;
              return prev;
            });
          }

          console.log(`[BacktestPage] Phase 2: ${event.id} -> ${event.status}${event.latencyMs !== undefined ? ` (${event.latencyMs}ms)` : ''}`);
        });

        // Trigger the progressive check
        api.data.checkProvidersProgressive().catch((error: unknown) => {
          console.error('[BacktestPage] Progressive check trigger failed:', error);
        });
      } else if (api?.data?.listProviders) {
        // Fallback: legacy blocking check if progressive API not available
        api.data.listProviders().then((providers: Array<{
          id: string; name: string; status: string;
          capabilities?: { requiresAuth?: boolean; intervals?: string[]; maxLookback?: Record<string, string> }
        }>) => {
          const sources: DataSourceOption[] = providers.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status as DataSourceOption['status'],
            requiresAuth: p.capabilities?.requiresAuth ?? false,
            intervals: p.capabilities?.intervals,
            maxLookback: p.capabilities?.maxLookback,
          }));
          setDataSources(sources);
        }).catch((error: unknown) => {
          console.error('[BacktestPage] Phase 2 fallback failed:', error);
        });
      }
    } catch (error) {
      console.error('[BacktestPage] Phase 2 failed:', error);
    }

    return () => {
      if (unsubProviderStatus) unsubProviderStatus();
    };
  }, []);

  // TICKET_305: Derive provider capability constraints for current data source
  const currentProvider = useMemo(
    () => dataSources.find(s => s.id === dataConfig.dataSource),
    [dataSources, dataConfig.dataSource]
  );
  const allowedIntervals = currentProvider?.intervals as TimeframeValue[] | undefined;
  const maxLookback = currentProvider?.maxLookback;

  // TICKET_305 Phase 3: Derive most restrictive lookback (in days) across selected timeframes
  const mostRestrictiveLookbackDays = useMemo(() => {
    if (!maxLookback) return undefined;

    const timeframes = extractUniqueTimeframes(workflowRows);
    if (timeframes.length === 0) return undefined;

    let minDays: number | undefined;
    for (const tf of timeframes) {
      const lb = maxLookback[tf];
      if (!lb) continue;
      // Parse lookback string: '7d' -> 7, '60d' -> 60, '730d' -> 730
      const match = lb.match(/^(\d+)d$/);
      if (match) {
        const days = parseInt(match[1], 10);
        if (minDays === undefined || days < minDays) {
          minDays = days;
        }
      }
    }
    return minDays;
  }, [maxLookback, workflowRows]);

  // TICKET_364: Auto-adjust startDate when maxLookback is exceeded
  const constrainStartDate = useCallback((config: BacktestDataConfig): BacktestDataConfig => {
    if (!maxLookback || !config.startDate || !config.endDate) return config;

    const timeframes = extractUniqueTimeframes(workflowRows);
    if (timeframes.length === 0) return config;

    // Find most restrictive minStartDate across all timeframes
    let latestMin: string | null = null;
    for (const tf of timeframes) {
      const min = computeMinStartDate(tf, maxLookback, config.endDate);
      if (min && (!latestMin || min > latestMin)) {
        latestMin = min;
      }
    }

    if (latestMin && config.startDate < latestMin) {
      return { ...config, startDate: latestMin };
    }
    return config;
  }, [maxLookback, workflowRows]);

  const handleDataConfigChange = useCallback((newConfig: BacktestDataConfig) => {
    const adjusted = constrainStartDate(newConfig);
    if (adjusted.startDate !== newConfig.startDate) {
      messageAPI?.info(`Start date auto-adjusted to ${adjusted.startDate} (maxLookback constraint)`);
    }
    setDataConfig(adjusted);
  }, [constrainStartDate, messageAPI]);

  // TICKET_364: Re-constrain startDate when workflowRows timeframes change
  useEffect(() => {
    const adjusted = constrainStartDate(dataConfig);
    if (adjusted.startDate !== dataConfig.startDate) {
      messageAPI?.info(`Start date auto-adjusted to ${adjusted.startDate} (timeframe changed)`);
      setDataConfig(adjusted);
    }
  }, [workflowRows]); // eslint-disable-line react-hooks/exhaustive-deps

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

      const results = await api.data.searchSymbols(query, dataConfig.dataSource);

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
  }, [dataConfig.dataSource]);

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
    strategyName?: string,
    taskId?: string,  // TICKET_352_5: Caller-generated task ID
  ): Promise<void> => {
    const api = executorAPI || (window as any).electronAPI?.executor;
    const startTime = Math.floor(new Date(config.startDate).getTime() / 1000);
    const endTime = Math.floor(new Date(config.endDate).getTime() / 1000) + 86400 - 1;

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

    // Build executor request inline (TICKET_173: replaces toExecutorRequest import)
    // TICKET_248 Phase 2: Include dataFeeds for multi-timeframe support
    const executorRequest: any = {
      taskId,  // TICKET_352_5: Caller-generated task ID
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
      // TICKET_368: Silently skip if task was cancelled during preparation
      if (result?.error?.includes('cancelled during preparation')) {
        console.info(`[BacktestPage] Backtest ${caseIndex} skipped: cancelled during preparation`);
        return;
      }
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

      // TICKET_268: Build workflowExportData for Quant Lab export
      const analysisSelection = workflow.analysisSelections[0];
      const entrySelection = workflow.stepSelections[0];
      const exitSelection = workflow.postConditionSelections[0];

      // TICKET_264_1: Use config parameter instead of dataConfig to avoid stale closure
      const workflowExportData = analysisSelection && entrySelection ? {
        analysis: {
          algorithmId: String(analysisSelection.id),
          algorithmName: analysisSelection.strategyName,
          algorithmCode: analysisSelection.code || '',
          baseClass: 'RegimeStateBase',
          timeframe: analysisSelection.timeframe || config.timeframe || '1d',
          parameters: {},
        },
        entry: {
          algorithmId: String(entrySelection.id),
          algorithmName: entrySelection.strategyName,
          algorithmCode: entrySelection.code || '',
          baseClass: 'EntrySignalBase',
          timeframe: entrySelection.timeframe || config.timeframe || '1d',
          parameters: {},
        },
        exit: exitSelection ? {
          algorithmId: String(exitSelection.id),
          algorithmName: exitSelection.strategyName,
          algorithmCode: exitSelection.code || '',
          baseClass: 'ExitStrategyBase',
          timeframe: exitSelection.timeframe || config.timeframe || '1d',
          parameters: {},
        } : null,
        // TICKET_264_1: Use config parameter instead of dataConfig to avoid stale closure
        symbol: config.symbol,
        dateRange: {
          start: config.startDate,
          end: config.endDate,
        },
      } : undefined;

      // TICKET_233: Notify global status
      // TICKET_257: Include workflowTimeframes for result page display
      // TICKET_268: Include workflowExportData for Quant Lab export
      // TICKET_378: Include backtestConfig for result page config summary
      const backtestConfig = {
        dataSource: config.dataSource,
        symbol: config.symbol,
        startDate: config.startDate,
        endDate: config.endDate,
        initialCapital: config.initialCapital,
        orderSize: config.orderSize,
        orderSizeUnit: config.orderSizeUnit,
      };
      onBacktestStart?.(result.taskId, strategyName || 'Backtest', workflowTimeframes, workflowExportData, backtestConfig);

      // TICKET_375_2: Wait for executor to finish this task before returning.
      // Without this, the sequential case loop fires all cases immediately because
      // runBacktest IPC only enqueues the task and returns without waiting for completion.
      const actualTaskId = result.taskId;
      await new Promise<void>((resolve, reject) => {
        const unsubCompleted = api.onCompleted?.((data: { taskId: string }) => {
          if (data.taskId === actualTaskId) {
            unsubCompleted?.();
            unsubError?.();
            resolve();
          }
        });
        const unsubError = api.onError?.((data: { taskId: string; error: string }) => {
          if (data.taskId === actualTaskId) {
            unsubCompleted?.();
            unsubError?.();
            reject(new Error(data.error));
          }
        });
      });
      console.debug(`[BacktestPage] Backtest ${caseIndex} completed, taskId:`, actualTaskId);
    }
  }, [executorAPI, messageAPI, onBacktestStart]);

  // TICKET_375: Independent case execution - each case gets its own data download + backtest
  const runIndependentCase = useCallback(async (
    workflow: WorkflowRow,
    config: BacktestDataConfig,
    taskId: string,
    caseIndex: number,
    totalCases: number,
    strategyName: string,
  ): Promise<void> => {
    const dataApi = dataAPI || (window as any).electronAPI?.data;

    // Step A: Extract timeframes for THIS case only
    const timeframes = extractUniqueTimeframes([workflow]);
    console.log(`[BacktestPage] Case ${caseIndex}/${totalCases} timeframes:`, timeframes);

    // Step B: Download data for THIS case's timeframes
    let dataResult: any;

    if (timeframes.length > 1 && dataApi?.ensureMultiTimeframe) {
      dataResult = await dataApi.ensureMultiTimeframe({
        symbol: config.symbol,
        startDate: config.startDate,
        endDate: config.endDate,
        timeframes,
        provider: config.dataSource,
        forceDownload: false,
      });
    } else {
      dataResult = await dataApi?.ensure({
        symbol: config.symbol,
        startDate: config.startDate,
        endDate: config.endDate,
        interval: timeframes[0] || '1d',
        provider: config.dataSource,
        forceDownload: false,
      });
    }

    if (!dataResult?.success) {
      throw new Error(`Failed to load data: ${dataResult?.error}`);
    }

    // Step C: Run backtest with per-case data
    await runSingleBacktest(workflow, config, dataResult, caseIndex, totalCases, strategyName, taskId);
  }, [dataAPI, runSingleBacktest]);

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

    // TICKET_305 Phase 3: Validate date range against maxLookback for selected timeframes
    if (config.startDate && config.endDate && maxLookback) {
      const timeframes = extractUniqueTimeframes(workflowRows);
      const startMs = new Date(config.startDate).getTime();
      const endMs = new Date(config.endDate).getTime();
      const selectedDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));

      for (const tf of timeframes) {
        const lb = maxLookback[tf];
        if (!lb) continue;
        const match = lb.match(/^(\d+)d$/);
        if (match) {
          const maxDays = parseInt(match[1], 10);
          if (selectedDays > maxDays) {
            errors.startDate = `${tf} interval: max ${lb} lookback (${selectedDays}d selected)`;
            break;
          }
        }
      }
    }

    if (config.initialCapital <= 0) {
      errors.initialCapital = 'Initial capital must be positive';
    }

    if (config.orderSize <= 0) {
      errors.orderSize = 'Order size must be positive';
    }

    setDataConfigErrors(errors);
    return Object.keys(errors).length === 0;
  }, [maxLookback, workflowRows]);

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

    // TICKET_375: Generate independent taskId for each case
    const caseTasks = activeWorkflows.map(workflow => ({
      workflow,
      taskId: crypto.randomUUID(),
    }));

    // TICKET_366: Register all tasks in main process queue before execution starts
    const executorApi = executorAPI || (window as any).electronAPI?.executor;
    for (const ct of caseTasks) {
      await executorApi?.registerTask?.(ct.taskId, strategyName);
    }

    setIsExecuting(true);

    try {
      messageAPI?.info(`Loading market data for ${dataConfig.symbol}...`);

      // TICKET_375_1: Sequential case execution to prevent concurrent file writes
      // TICKET_375_2: Create tab per case only when that case starts (not all upfront)
      const failures: Array<{ caseIndex: number; error: string }> = [];
      for (let i = 0; i < caseTasks.length; i++) {
        const { workflow, taskId: caseTaskId } = caseTasks[i];

        // TICKET_375_2: Create result tab just before this case executes
        if (i === 0) {
          onExecutionBegin?.(strategyName, caseTaskId, {
            cockpit: cockpitMode,
            dataConfig: { ...dataConfig },
            workflowRows: workflowRows.map(row => ({ ...row })),
          });
        } else {
          onExecutionBegin?.(strategyName, caseTaskId);
        }

        try {
          await runIndependentCase(workflow, dataConfig, caseTaskId, i + 1, caseTasks.length, strategyName);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[BacktestPage] Case ${i + 1} failed:`, error);
          messageAPI?.error(`Case ${i + 1} failed: ${msg}`);
          failures.push({ caseIndex: i + 1, error: msg });
        }
      }

      setIsExecuting(false);
    } catch (error) {
      messageAPI?.error('Failed to execute backtest. Please check the logs.');
      console.error('[BacktestPage] Execute error:', error);
      setExecuteError(error instanceof Error ? error.message : 'Execution failed');
      setIsExecuting(false);
    }
  }, [dataConfig, workflowRows, hasWorkflowContent, findDuplicateWorkflows, runIndependentCase, dataAPI, executorAPI, messageAPI, onExecutionBegin, cockpitMode]);

  // TICKET_163: Handle naming dialog cancel
  const handleCancelNaming = useCallback(() => {
    setNamingDialogVisible(false);
  }, []);

  return (
    <div className="h-full flex flex-col bg-color-terminal-bg text-color-terminal-text">
      {/* Zone A: Page Header - TICKET_308 (full width, above sidebar + content) */}
      <PageHeader
        title={pageTitle || 'Backtest Nexus'}
        onSettingsClick={onSettingsClick}
      />

      {/* Zone B + C + D */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone B: History Sidebar - TICKET_077_18 Modularized */}
        <BacktestHistorySidebar
          isExecuting={isExecuting}
          currentCaseIndex={currentCaseIndex}
          totalCases={totalCases}
          resultsCount={0}
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
                isQuantLabAvailable={isQuantLabAvailable}
                isQuantLabLoading={isQuantLabLoading}
                isExporting={isExporting}
                onExportToQuantLab={handleExportClick}
              />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-color-terminal-text-muted">
                {t('page.loadingAlgorithms')}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
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
                onChange={handleDataConfigChange}
                dataSources={dataSources}
                onSymbolSearch={handleSymbolSearch}
                errors={dataConfigErrors}
                disabled={isExecuting}
                isAuthenticated={isAuthenticated}
                maxLookback={maxLookback}
                mostRestrictiveLookbackDays={mostRestrictiveLookbackDays}
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
                allowedIntervals={allowedIntervals}
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
          workflowName: `${dataConfig.symbol}_${dataConfig.timeframe || ''}`,
          // Get first analysis algorithm name from workflowRows
          analysisName: workflowRows[0]?.analysisSelections[0]?.strategyName,
          // Get first entry signal algorithm name from workflowRows
          entryName: workflowRows[0]?.stepSelections[0]?.strategyName,
        }}
        onConfirm={handleExportConfirm}
        onCancel={handleExportCancel}
      />
    </div>
  );
};

export default BacktestPage;
