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
    list: () => Promise<{
      success: boolean;
      data?: SignalSourceRecord[];
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
