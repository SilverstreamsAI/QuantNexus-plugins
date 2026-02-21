/**
 * useAlphaFactoryBacktest Hook
 *
 * PLUGIN_TICKET_015: Orchestrates the Alpha Factory backtest execution flow:
 * 1. Validate inputs
 * 2. data.ensure() / data.ensureMultiTimeframe() -> get dataPath
 * 3. alphaFactory.run() -> get strategyPath
 * 4. executor.runBacktest() -> get taskId
 * 5. Subscribe to executor events (onProgress/onCompleted/onError)
 * 6. Cleanup on unmount
 *
 * Same pattern as BacktestPage (lines 1374-1519).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BacktestStatus,
  ExecutorResult,
  DataConfig,
  SignalChip,
  FactorChip,
  ExitRules,
  TimeframeDownloadStatus,
} from '../types';

interface UseAlphaFactoryBacktestReturn {
  status: BacktestStatus;
  progress: number;
  result: ExecutorResult | null;
  error: string | null;
  timeframeStatus: TimeframeDownloadStatus[];
  runBacktest: () => Promise<void>;
  // TICKET_384: Expose active taskId for host-level pipeline rendering
  activeTaskId: string | null;
  // TICKET_386: Progressive candle rendering (gray-to-colored)
  processedBars: number;
  totalBars: number;
}

// TICKET_388: Recovered state from host stores (passed via props)
interface RecoveredBacktestState {
  taskId: string;
  status: string;
  progress: number;
  result: ExecutorResult | null;
  executionState: {
    isExecuting: boolean;
    processedBars: number;
    totalBars: number;
  } | null;
}

interface UseAlphaFactoryBacktestParams {
  signals: SignalChip[];
  signalMethod: string;
  lookback: number;
  exitMethod: string;
  exitRules: ExitRules;
  // TICKET_276: Factor layer
  factors: FactorChip[];
  factorMethod: string;
  factorLookback: number;
  dataConfig: DataConfig;
  // TICKET_384: Callback for host-level pipeline phase updates
  onPipelinePhase?: (taskId: string, phase: string) => void;
  // TICKET_388: Recovered state for lifecycle persistence
  recoveredState?: RecoveredBacktestState;
}

// TICKET_388: Map AF store status -> hook BacktestStatus
function mapAfStatusToBacktestStatus(afStatus: string): BacktestStatus {
  switch (afStatus) {
    case 'running':
    case 'queued':
    case 'preparing':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
      return 'error';
    default:
      return 'idle';
  }
}

export function useAlphaFactoryBacktest({
  signals,
  signalMethod,
  lookback,
  exitMethod,
  exitRules,
  factors,
  factorMethod,
  factorLookback,
  dataConfig,
  onPipelinePhase,
  recoveredState,
}: UseAlphaFactoryBacktestParams): UseAlphaFactoryBacktestReturn {
  // TICKET_388: Initialize from recovered state if available
  const [status, setStatus] = useState<BacktestStatus>(
    () => recoveredState ? mapAfStatusToBacktestStatus(recoveredState.status) : 'idle'
  );
  const [progress, setProgress] = useState(
    () => recoveredState?.progress ?? 0
  );
  const [result, setResult] = useState<ExecutorResult | null>(
    () => recoveredState?.result ?? null
  );
  const [error, setError] = useState<string | null>(null);
  // TICKET_077_P3: Per-timeframe download status
  const [timeframeStatus, setTimeframeStatus] = useState<TimeframeDownloadStatus[]>([]);
  // TICKET_386: Progressive candle rendering (gray-to-colored)
  const [processedBars, setProcessedBars] = useState(
    () => recoveredState?.executionState?.processedBars ?? 0
  );
  const [totalBars, setTotalBars] = useState(
    () => recoveredState?.executionState?.totalBars ?? 0
  );

  // Track active task for event filtering
  const activeTaskIdRef = useRef<string | null>(recoveredState?.taskId ?? null);
  // Track cleanup functions for event subscriptions
  const cleanupRef = useRef<Array<() => void>>([]);
  // PLUGIN_TICKET_017: Throttled buffer for real-time incremental updates
  const pendingBufferRef = useRef<any[]>([]);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCompletedRef = useRef(false);

  // PLUGIN_TICKET_017: Flush buffered increments into result state
  const flushBuffer = useCallback(() => {
    const buffer = pendingBufferRef.current;
    if (isCompletedRef.current || buffer.length === 0) return;

    const merged = buffer.reduce((acc, inc) => ({
      newEquityPoints: acc.newEquityPoints.concat(inc.newEquityPoints || []),
      newTrades: acc.newTrades.concat(inc.newTrades || []),
      newCandles: acc.newCandles.concat(inc.newCandles || []),
      currentMetrics: inc.currentMetrics,
      // TICKET_386: Take latest processedBars/totalBars from last increment
      processedBars: inc.processedBars ?? acc.processedBars,
      totalBars: inc.totalBars ?? acc.totalBars,
    }), {
      newEquityPoints: [] as any[],
      newTrades: [] as any[],
      newCandles: [] as any[],
      currentMetrics: buffer[0].currentMetrics,
      processedBars: buffer[0].processedBars ?? 0,
      totalBars: buffer[0].totalBars ?? 0,
    });

    buffer.length = 0;

    // TICKET_386: Update progressive candle state
    if (merged.processedBars > 0) setProcessedBars(merged.processedBars);
    if (merged.totalBars > 0) setTotalBars(merged.totalBars);

    setResult(prev => {
      if (!prev) {
        return {
          success: true,
          startTime: 0,
          endTime: 0,
          executionTimeMs: 0,
          metrics: {
            totalPnl: merged.currentMetrics?.totalPnl || 0,
            totalReturn: merged.currentMetrics?.totalReturn || 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            totalTrades: merged.currentMetrics?.totalTrades || 0,
            winningTrades: merged.currentMetrics?.winningTrades || 0,
            losingTrades: merged.currentMetrics?.losingTrades || 0,
            winRate: merged.currentMetrics?.winRate || 0,
            profitFactor: 0,
          },
          equityCurve: merged.newEquityPoints,
          trades: merged.newTrades,
          candles: merged.newCandles,
        };
      }

      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          totalPnl: merged.currentMetrics?.totalPnl ?? prev.metrics.totalPnl,
          totalReturn: merged.currentMetrics?.totalReturn ?? prev.metrics.totalReturn,
          totalTrades: merged.currentMetrics?.totalTrades ?? prev.metrics.totalTrades,
          winningTrades: merged.currentMetrics?.winningTrades ?? prev.metrics.winningTrades,
          losingTrades: merged.currentMetrics?.losingTrades ?? prev.metrics.losingTrades,
          winRate: merged.currentMetrics?.winRate ?? prev.metrics.winRate,
        },
        equityCurve: [...prev.equityCurve, ...merged.newEquityPoints],
        trades: [...prev.trades, ...merged.newTrades],
        candles: [...prev.candles, ...merged.newCandles],
      };
    });
  }, []);

  // Cleanup subscriptions
  const cleanupSubscriptions = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    pendingBufferRef.current.length = 0;
    for (const unsub of cleanupRef.current) {
      unsub();
    }
    cleanupRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, [cleanupSubscriptions]);

  // TICKET_388: Re-subscribe to executor events if recovered task is still running
  useEffect(() => {
    if (!recoveredState) return;
    const { taskId, status: afStatus } = recoveredState;
    const isActive = afStatus === 'running' || afStatus === 'queued' || afStatus === 'preparing';
    if (!isActive) return;

    const api = window.electronAPI;
    if (!api?.executor) return;

    activeTaskIdRef.current = taskId;
    isCompletedRef.current = false;

    const THROTTLE_MS = 100;

    const unsubProgress = api.executor.onProgress((data: { taskId: string; percent: number }) => {
      if (data.taskId === taskId) {
        setProgress(data.percent);
      }
    });
    cleanupRef.current.push(unsubProgress);

    const unsubIncrement = api.executor.onIncrement((data: { taskId: string; increment: any }) => {
      if (data.taskId !== taskId) return;
      pendingBufferRef.current.push(data.increment);
      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          flushBuffer();
        }, THROTTLE_MS);
      }
    });
    cleanupRef.current.push(unsubIncrement);

    const unsubCompleted = api.executor.onCompleted((data: { taskId: string; result: any }) => {
      if (data.taskId !== taskId) return;
      isCompletedRef.current = true;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingBufferRef.current.length = 0;

      const r = data.result as {
        success: boolean; metrics?: any;
        equityCurve?: any[]; trades?: any[]; candles?: any[];
        startTime?: number; endTime?: number; executionTimeMs?: number;
        errorMessage?: string;
      };
      if (r?.success && r.metrics) {
        setResult((prev: ExecutorResult | null) => {
          const finalResult: ExecutorResult = {
            success: r.success,
            errorMessage: r.errorMessage,
            startTime: r.startTime ?? 0,
            endTime: r.endTime ?? 0,
            executionTimeMs: r.executionTimeMs ?? 0,
            metrics: r.metrics!,
            equityCurve: r.equityCurve ?? [],
            trades: r.trades ?? [],
            candles: r.candles ?? [],
          };
          if (!prev) return finalResult;
          return {
            ...finalResult,
            equityCurve: prev.equityCurve.length > finalResult.equityCurve.length
              ? prev.equityCurve : finalResult.equityCurve,
            trades: prev.trades.length > 0 ? prev.trades : finalResult.trades,
            candles: prev.candles.length > finalResult.candles.length
              ? prev.candles : finalResult.candles,
          };
        });
        setStatus('completed');
        setProgress(100);
      } else {
        setError('Backtest completed but no metrics returned');
        setStatus('error');
      }
      // TICKET_393: Keep activeTaskIdRef so host can read pipeline 'complete' state
      cleanupSubscriptions();
    });
    cleanupRef.current.push(unsubCompleted);

    const unsubError = api.executor.onError((data: { taskId: string; error: string }) => {
      if (data.taskId !== taskId) return;
      setError(data.error);
      setStatus('error');
      // TICKET_393: Keep activeTaskIdRef so host can read pipeline 'error' state
      cleanupSubscriptions();
    });
    cleanupRef.current.push(unsubError);

    return () => {
      cleanupSubscriptions();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  // TICKET_388: Sync result from recovered state (e.g. loaded from DB after mount)
  // TICKET_394: Only sync during cold recovery (idle), not during active backtest run
  useEffect(() => {
    if (!recoveredState?.result) return;
    if (status !== 'idle') return;
    setResult((prev: ExecutorResult | null) => prev === null ? recoveredState.result : prev);
  }, [recoveredState?.result, status]);

  // TICKET_388: Sync status from recovered state when task completes while away
  useEffect(() => {
    if (!recoveredState) return;
    const mappedStatus = mapAfStatusToBacktestStatus(recoveredState.status);
    // Only sync terminal states (completed/error) to avoid overwriting active running state
    if (mappedStatus === 'completed' || mappedStatus === 'error') {
      setStatus((prev) => {
        // Don't downgrade from completed to something else
        if (prev === 'completed') return prev;
        return mappedStatus;
      });
    }
    if (recoveredState.executionState) {
      if (recoveredState.executionState.processedBars > 0) {
        setProcessedBars(recoveredState.executionState.processedBars);
      }
      if (recoveredState.executionState.totalBars > 0) {
        setTotalBars(recoveredState.executionState.totalBars);
      }
    }
  }, [recoveredState?.status, recoveredState?.executionState]);

  const runBacktest = useCallback(async () => {
    const api = window.electronAPI;
    console.log('[AlphaFactoryBacktest] runBacktest called, signals:', signals.length, 'symbol:', dataConfig.symbol);

    // Validate inputs - TICKET_276: Hybrid model allows either signals or factors
    if (signals.length === 0 && factors.length === 0) {
      setError('No signals or factors selected');
      setStatus('error');
      return;
    }
    if (!dataConfig.symbol) {
      setError('Symbol is required');
      setStatus('error');
      return;
    }
    if (!dataConfig.startDate || !dataConfig.endDate) {
      setError('Start and end dates are required');
      setStatus('error');
      return;
    }

    // Reset state
    console.log('[AlphaFactoryBacktest] Setting status: loading_data');
    isCompletedRef.current = false;
    setStatus('loading_data');
    setProgress(0);
    setResult(null);
    setError(null);
    setTimeframeStatus([]);
    // TICKET_386: Reset progressive candle state
    setProcessedBars(0);
    setTotalBars(0);
    cleanupSubscriptions();

    // TICKET_382: Generate AF-prefixed taskId and register with AF queue
    // TICKET_384: Notify host pipeline immediately
    const taskId = `af_${Date.now()}`;
    const strategyName = `AlphaFactory_${signals.length}sig_${factors.length}fac_${signalMethod}`;
    activeTaskIdRef.current = taskId;

    try {
      // Register task in AF queue (preparing state, enables cancel during download)
      await api.alphaFactory.registerTask(taskId, strategyName);
      // TICKET_384: Set downloading phase in host pipeline
      onPipelinePhase?.(taskId, 'downloading');

      // Step 1: Extract unique timeframes from signals
      const timeframes = new Set<string>();
      for (const sig of signals) {
        if (sig.analysis?.timeframe) timeframes.add(sig.analysis.timeframe);
        if (sig.entry?.timeframe) timeframes.add(sig.entry.timeframe);
        if (sig.exit?.timeframe) timeframes.add(sig.exit.timeframe);
      }
      const uniqueTimeframes = Array.from(timeframes);
      if (uniqueTimeframes.length === 0) {
        uniqueTimeframes.push('1d');
      }

      // TICKET_077_P3: Initialize per-timeframe status and subscribe to data:progress
      setTimeframeStatus(uniqueTimeframes.map(tf => ({ timeframe: tf, state: 'pending' })));

      const CONSOLE_MAX_LINES = 8;

      /** Append a message to the rolling buffer of the active timeframe */
      const appendMessage = (
        prev: TimeframeDownloadStatus[],
        targetIdx: number,
        msg: string,
        newState?: 'downloading',
      ): TimeframeDownloadStatus[] =>
        prev.map((tf, idx) => {
          if (idx < targetIdx) {
            return tf.state === 'completed' ? tf : { ...tf, state: 'completed', message: undefined, messageBuffer: undefined };
          }
          if (idx === targetIdx) {
            const buf = [...(tf.messageBuffer || []).slice(-(CONSOLE_MAX_LINES - 1)), msg];
            return { ...tf, state: newState || tf.state, message: msg, messageBuffer: buf };
          }
          return tf;
        });

      const unsubDataProgress = api.data.onProgress((_event: unknown, data: unknown) => {
        const d = data as {
          phase?: string;
          currentChunk?: number;
          totalChunks?: number;
          message?: string;
        };
        if (!d || !d.phase) return;

        if (d.phase === 'multi_timeframe_loading' && d.currentChunk && d.totalChunks) {
          const activeIdx = d.currentChunk - 1;
          setTimeframeStatus(prev => appendMessage(prev, activeIdx, d.message || '', 'downloading'));
        } else if (d.phase === 'downloading' && d.message) {
          setTimeframeStatus(prev => {
            let dlIdx = prev.findIndex(tf => tf.state === 'downloading');
            if (dlIdx < 0) {
              dlIdx = prev.findIndex(tf => tf.state === 'pending');
              if (dlIdx < 0) return prev;
            }
            return appendMessage(prev, dlIdx, d.message!, 'downloading');
          });
        } else if (d.phase === 'caching' && d.message) {
          // Merging / caching phase messages go to active timeframe
          setTimeframeStatus(prev => {
            let dlIdx = prev.findIndex(tf => tf.state === 'downloading');
            if (dlIdx < 0) {
              dlIdx = prev.findIndex(tf => tf.state === 'pending');
              if (dlIdx < 0) return prev;
            }
            return appendMessage(prev, dlIdx, d.message!, 'downloading');
          });
        } else if (d.phase === 'complete') {
          setTimeframeStatus(prev => prev.map(tf => ({
            ...tf, state: 'completed', message: undefined, messageBuffer: undefined,
          })));
        }
      });
      cleanupRef.current.push(unsubDataProgress);

      // Step 2: Ensure data is available
      let dataPath = '';
      let dataFeeds: Array<{ interval: string; dataPath: string }> | undefined;

      if (uniqueTimeframes.length > 1 && api.data.ensureMultiTimeframe) {
        const dataResult = await api.data.ensureMultiTimeframe({
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          timeframes: uniqueTimeframes,
          provider: dataConfig.dataSource,
          callerId: 'alpha-factory',
        });
        if (!dataResult.success) {
          throw new Error(dataResult.error || 'Failed to load market data');
        }
        dataPath = dataResult.dataPath || '';
        if (dataResult.dataFeeds) {
          dataFeeds = Object.entries(dataResult.dataFeeds).map(
            ([interval, info]) => ({ interval, dataPath: info.dataPath })
          );
        }
      } else {
        const primaryTimeframe = uniqueTimeframes[0] || '1d';
        const dataResult = await api.data.ensure({
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          interval: primaryTimeframe,
          provider: dataConfig.dataSource,
          callerId: 'alpha-factory',
        });
        if (!dataResult.success) {
          throw new Error(dataResult.error || 'Failed to load market data');
        }
        dataPath = dataResult.dataPath || '';
      }

      // TICKET_077_P3: Mark all timeframes completed after data loading
      setTimeframeStatus(prev => prev.map(tf => ({
        ...tf, state: 'completed', message: undefined, messageBuffer: undefined,
      })));

      // Step 3: Generate strategy code
      console.log('[AlphaFactoryBacktest] Data loaded, dataPath:', dataPath, 'dataFeeds:', dataFeeds?.length);
      setStatus('generating');
      setProgress(0);
      // TICKET_384: Set generating phase in host pipeline
      onPipelinePhase?.(taskId, 'generating');

      const genResult = await api.alphaFactory.run({
        signalIds: signals.map((s) => s.id),
        signalMethod,
        lookback,
        exitMethod,
        exitRules,
        // TICKET_276: Factor layer
        factorIds: factors.map((f) => f.id),
        factorMethod,
        factorLookback,
      });

      if (!genResult.success || !genResult.strategyPath) {
        throw new Error(genResult.error || 'Failed to generate strategy code');
      }

      // Step 4: Run backtest via executor
      console.log('[AlphaFactoryBacktest] Strategy generated:', genResult.strategyPath);
      setStatus('running');
      setProgress(0);

      const startTime = Math.floor(new Date(dataConfig.startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(dataConfig.endDate).getTime() / 1000) + 86400 - 1;

      // TICKET_382: Enqueue via AF-specific queue (independent from backtest plugin)
      const backtestResult = await api.alphaFactory.runBacktest({
        taskId,
        strategyPath: genResult.strategyPath,
        strategyName,
        symbol: dataConfig.symbol,
        interval: uniqueTimeframes[0] || '1d',
        startTime,
        endTime,
        dataPath,
        dataSourceType: 'parquet',
        dataFeeds,
        initialCapital: dataConfig.initialCapital,
        orderSize: dataConfig.orderSize,
        orderSizeUnit: dataConfig.orderSizeUnit,
      });

      if (!backtestResult.success || !backtestResult.taskId) {
        throw new Error(backtestResult.error || 'Failed to start backtest');
      }

      console.log('[AlphaFactoryBacktest] Executor started, taskId:', taskId);

      // Step 5: Subscribe to executor events
      // TICKET_384: Use executor percent directly (no offset formula).
      // Pipeline model: each phase has its own 0-100% progress.
      const unsubProgress = api.executor.onProgress((data) => {
        if (data.taskId === taskId) {
          setProgress(data.percent);
        }
      });
      cleanupRef.current.push(unsubProgress);

      // PLUGIN_TICKET_017: Throttled buffer for real-time result accumulation
      const THROTTLE_MS = 100;
      const unsubIncrement = api.executor.onIncrement((data) => {
        if (data.taskId !== taskId) return;
        pendingBufferRef.current.push(data.increment);
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
            flushBuffer();
          }, THROTTLE_MS);
        }
      });
      cleanupRef.current.push(unsubIncrement);

      const unsubCompleted = api.executor.onCompleted((data) => {
        console.log('[AlphaFactoryBacktest] onCompleted received, data.taskId:', data.taskId, 'expected:', taskId);
        if (data.taskId !== taskId) return;

        // PLUGIN_TICKET_017: Stop buffer processing on completion
        isCompletedRef.current = true;
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        pendingBufferRef.current.length = 0;

        // PLUGIN_TICKET_016: Store full ExecutorResult (metrics + equityCurve + trades)
        const r = data.result as {
          success: boolean;
          errorMessage?: string;
          startTime: number;
          endTime: number;
          executionTimeMs: number;
          metrics?: {
            totalPnl: number;
            totalReturn: number;
            sharpeRatio: number;
            maxDrawdown: number;
            totalTrades: number;
            winningTrades: number;
            losingTrades: number;
            winRate: number;
            profitFactor: number;
          };
          equityCurve?: Array<{ timestamp: number; equity: number; drawdown: number }>;
          trades?: Array<{
            entryTime: number; exitTime: number; symbol: string; side: string;
            entryPrice: number; exitPrice: number; quantity: number;
            pnl: number; commission: number; reason: string;
          }>;
          candles?: Array<{
            timestamp: number; open: number; high: number; low: number;
            close: number; volume: number;
          }>;
        };

        console.log('[AlphaFactoryBacktest] result.success:', r?.success, 'metrics:', r?.metrics ? 'present' : 'missing');

        if (r?.success && r.metrics) {
          console.log('[AlphaFactoryBacktest] Setting completed result:', r.metrics.totalReturn, r.metrics.sharpeRatio);
          // PLUGIN_TICKET_017: Preserve accumulated data from incremental updates
          setResult(prev => {
            const finalResult: ExecutorResult = {
              success: r.success,
              errorMessage: r.errorMessage,
              startTime: r.startTime ?? 0,
              endTime: r.endTime ?? 0,
              executionTimeMs: r.executionTimeMs ?? 0,
              metrics: r.metrics!,
              equityCurve: r.equityCurve ?? [],
              trades: r.trades ?? [],
              candles: r.candles ?? [],
            };
            if (!prev) return finalResult;
            return {
              ...finalResult,
              equityCurve: prev.equityCurve.length > finalResult.equityCurve.length
                ? prev.equityCurve : finalResult.equityCurve,
              trades: prev.trades.length > 0 ? prev.trades : finalResult.trades,
              candles: prev.candles.length > finalResult.candles.length
                ? prev.candles : finalResult.candles,
            };
          });
          setStatus('completed');
          setProgress(100);
        } else {
          console.log('[AlphaFactoryBacktest] No metrics in result:', JSON.stringify(data.result).substring(0, 200));
          setError('Backtest completed but no metrics returned');
          setStatus('error');
        }

        // TICKET_393: Keep activeTaskIdRef so host can read pipeline 'complete' state
        cleanupSubscriptions();
      });
      cleanupRef.current.push(unsubCompleted);

      const unsubError = api.executor.onError((data) => {
        console.log('[AlphaFactoryBacktest] onError received:', data.taskId, data.error);
        if (data.taskId !== taskId) return;
        setError(data.error);
        setStatus('error');
        // TICKET_393: Keep activeTaskIdRef so host can read pipeline 'error' state
        cleanupSubscriptions();
      });
      cleanupRef.current.push(unsubError);

    } catch (err) {
      console.error('[AlphaFactoryBacktest] Error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      cleanupSubscriptions();
    }
  }, [signals, signalMethod, lookback, exitMethod, exitRules, factors, factorMethod, factorLookback, dataConfig, cleanupSubscriptions, flushBuffer, onPipelinePhase]);

  return { status, progress, result, error, timeframeStatus, runBacktest, activeTaskId: activeTaskIdRef.current, processedBars, totalBars };
}
