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
  ExitRules,
} from '../types';

interface UseAlphaFactoryBacktestReturn {
  status: BacktestStatus;
  progress: number;
  result: ExecutorResult | null;
  error: string | null;
  runBacktest: () => Promise<void>;
}

interface UseAlphaFactoryBacktestParams {
  signals: SignalChip[];
  signalMethod: string;
  lookback: number;
  exitMethod: string;
  exitRules: ExitRules;
  dataConfig: DataConfig;
}

export function useAlphaFactoryBacktest({
  signals,
  signalMethod,
  lookback,
  exitMethod,
  exitRules,
  dataConfig,
}: UseAlphaFactoryBacktestParams): UseAlphaFactoryBacktestReturn {
  const [status, setStatus] = useState<BacktestStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExecutorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track active task for event filtering
  const activeTaskIdRef = useRef<string | null>(null);
  // Track cleanup functions for event subscriptions
  const cleanupRef = useRef<Array<() => void>>([]);

  // Cleanup subscriptions
  const cleanupSubscriptions = useCallback(() => {
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

  const runBacktest = useCallback(async () => {
    const api = window.electronAPI;
    console.log('[AlphaFactoryBacktest] runBacktest called, signals:', signals.length, 'symbol:', dataConfig.symbol);

    // Validate inputs
    if (signals.length === 0) {
      setError('No signals selected');
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
    setStatus('loading_data');
    setProgress(0);
    setResult(null);
    setError(null);
    cleanupSubscriptions();

    try {
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

      // Step 2: Ensure data is available
      let dataPath = '';
      let dataFeeds: Array<{ interval: string; dataPath: string }> | undefined;

      if (uniqueTimeframes.length > 1 && api.data.ensureMultiTimeframe) {
        const dataResult = await api.data.ensureMultiTimeframe({
          symbol: dataConfig.symbol,
          startDate: dataConfig.startDate,
          endDate: dataConfig.endDate,
          timeframes: uniqueTimeframes,
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
        });
        if (!dataResult.success) {
          throw new Error(dataResult.error || 'Failed to load market data');
        }
        dataPath = dataResult.dataPath || '';
      }

      // Step 3: Generate strategy code
      console.log('[AlphaFactoryBacktest] Data loaded, dataPath:', dataPath, 'dataFeeds:', dataFeeds?.length);
      setStatus('generating');
      setProgress(10);

      const genResult = await api.alphaFactory.run({
        signalIds: signals.map((s) => s.id),
        signalMethod,
        lookback,
        exitMethod,
        exitRules,
      });

      if (!genResult.success || !genResult.strategyPath) {
        throw new Error(genResult.error || 'Failed to generate strategy code');
      }

      // Step 4: Run backtest via executor
      console.log('[AlphaFactoryBacktest] Strategy generated:', genResult.strategyPath);
      setStatus('running');
      setProgress(20);

      const startTime = Math.floor(new Date(dataConfig.startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(dataConfig.endDate).getTime() / 1000);

      const backtestResult = await api.executor.runBacktest({
        strategyPath: genResult.strategyPath,
        strategyName: `AlphaFactory_${signals.length}sig_${signalMethod}`,
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

      const taskId = backtestResult.taskId;
      activeTaskIdRef.current = taskId;
      console.log('[AlphaFactoryBacktest] Executor started, taskId:', taskId);

      // Step 5: Subscribe to executor events
      const unsubProgress = api.executor.onProgress((data) => {
        if (data.taskId === taskId) {
          console.log('[AlphaFactoryBacktest] onProgress:', data.percent);
          setProgress(20 + (data.percent * 0.8));
        }
      });
      cleanupRef.current.push(unsubProgress);

      const unsubIncrement = api.executor.onIncrement((data) => {
        if (data.taskId === taskId && data.increment.totalBars > 0) {
          const pct = (data.increment.processedBars / data.increment.totalBars) * 100;
          setProgress(20 + (pct * 0.8));
        }
      });
      cleanupRef.current.push(unsubIncrement);

      const unsubCompleted = api.executor.onCompleted((data) => {
        console.log('[AlphaFactoryBacktest] onCompleted received, data.taskId:', data.taskId, 'expected:', taskId);
        if (data.taskId !== taskId) return;

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
        };

        console.log('[AlphaFactoryBacktest] result.success:', r?.success, 'metrics:', r?.metrics ? 'present' : 'missing');

        if (r?.success && r.metrics) {
          console.log('[AlphaFactoryBacktest] Setting completed result:', r.metrics.totalReturn, r.metrics.sharpeRatio);
          setResult({
            success: r.success,
            errorMessage: r.errorMessage,
            startTime: r.startTime ?? 0,
            endTime: r.endTime ?? 0,
            executionTimeMs: r.executionTimeMs ?? 0,
            metrics: r.metrics,
            equityCurve: r.equityCurve ?? [],
            trades: r.trades ?? [],
          });
          setStatus('completed');
          setProgress(100);
        } else {
          console.log('[AlphaFactoryBacktest] No metrics in result:', JSON.stringify(data.result).substring(0, 200));
          setError('Backtest completed but no metrics returned');
          setStatus('error');
        }

        activeTaskIdRef.current = null;
        cleanupSubscriptions();
      });
      cleanupRef.current.push(unsubCompleted);

      const unsubError = api.executor.onError((data) => {
        console.log('[AlphaFactoryBacktest] onError received:', data.taskId, data.error);
        if (data.taskId !== taskId) return;
        setError(data.error);
        setStatus('error');
        activeTaskIdRef.current = null;
        cleanupSubscriptions();
      });
      cleanupRef.current.push(unsubError);

    } catch (err) {
      console.error('[AlphaFactoryBacktest] Error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      cleanupSubscriptions();
    }
  }, [signals, signalMethod, lookback, exitMethod, exitRules, dataConfig, cleanupSubscriptions]);

  return { status, progress, result, error, runBacktest };
}
