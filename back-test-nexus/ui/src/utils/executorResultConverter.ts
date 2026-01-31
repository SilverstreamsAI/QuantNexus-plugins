/**
 * TICKET_230: Executor Result Converter
 *
 * Converts Python snake_case result to TypeScript camelCase ExecutorResult.
 * Python outputs snake_case field names, frontend ExecutorResult expects camelCase.
 *
 * @see TICKET_230_RESULT_FIELD_NAME_CONVERSION.md
 */

import type { ExecutorResult, ExecutorMetrics, ExecutorTrade, EquityPoint } from '../components/ui';

/**
 * Python result structure (snake_case)
 */
interface PythonResult {
  success?: boolean;
  error_message?: string;
  start_time?: number;
  end_time?: number;
  execution_time_ms?: number;
  metrics?: {
    total_pnl?: number;
    total_return?: number;
    sharpe_ratio?: number;
    max_drawdown?: number;
    total_trades?: number;
    winning_trades?: number;
    losing_trades?: number;
    win_rate?: number;
    profit_factor?: number;
  };
  equity_curve?: EquityPoint[];
  trades?: PythonTrade[];
}

interface PythonTrade {
  entry_time?: number;
  exit_time?: number;
  symbol?: string;
  side?: string;
  entry_price?: number;
  exit_price?: number;
  quantity?: number;
  pnl?: number;
  commission?: number;
  reason?: string;
}

/**
 * Convert Python snake_case metrics to TypeScript camelCase
 */
function convertMetrics(pythonMetrics?: PythonResult['metrics']): ExecutorMetrics {
  return {
    totalPnl: pythonMetrics?.total_pnl ?? 0,
    totalReturn: pythonMetrics?.total_return ?? 0,
    sharpeRatio: pythonMetrics?.sharpe_ratio ?? 0,
    maxDrawdown: pythonMetrics?.max_drawdown ?? 0,
    totalTrades: pythonMetrics?.total_trades ?? 0,
    winningTrades: pythonMetrics?.winning_trades ?? 0,
    losingTrades: pythonMetrics?.losing_trades ?? 0,
    winRate: pythonMetrics?.win_rate ?? 0,
    profitFactor: pythonMetrics?.profit_factor ?? 0,
  };
}

/**
 * Convert Python snake_case trade to TypeScript camelCase
 */
function convertTrade(pythonTrade: PythonTrade): ExecutorTrade {
  return {
    entryTime: pythonTrade.entry_time ?? 0,
    exitTime: pythonTrade.exit_time ?? 0,
    symbol: pythonTrade.symbol ?? '',
    side: pythonTrade.side ?? '',
    entryPrice: pythonTrade.entry_price ?? 0,
    exitPrice: pythonTrade.exit_price ?? 0,
    quantity: pythonTrade.quantity ?? 0,
    pnl: pythonTrade.pnl ?? 0,
    commission: pythonTrade.commission ?? 0,
    reason: pythonTrade.reason ?? '',
  };
}

/**
 * Convert Python snake_case result to TypeScript camelCase ExecutorResult.
 *
 * This function handles the field name mismatch between Python output
 * (snake_case) and TypeScript interface (camelCase).
 *
 * @param pythonResult - Raw result from Python executor (snake_case fields)
 * @returns ExecutorResult with camelCase fields
 */
export function convertPythonResultToExecutorResult(pythonResult: unknown): ExecutorResult {
  const result = pythonResult as PythonResult;

  return {
    success: result.success ?? false,
    errorMessage: result.error_message,
    startTime: result.start_time ?? 0,
    endTime: result.end_time ?? 0,
    executionTimeMs: result.execution_time_ms ?? 0,
    metrics: convertMetrics(result.metrics),
    equityCurve: result.equity_curve ?? [],
    trades: (result.trades ?? []).map(convertTrade),
    candles: [], // Candles come from incremental data, not final result
  };
}
