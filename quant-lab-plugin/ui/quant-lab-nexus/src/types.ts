/**
 * Quant Lab Type Definitions
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 */

export type QuantLabSubPage = 'hub' | 'factory';

export interface SignalChip {
  id: string;       // signal_source_registry.id
  name: string;     // signal_source_registry.name
  // Backtest metrics (display reference)
  sharpe?: number | null;
  winRate?: number | null;
  totalTrades?: number | null;
}

export interface CombinatorMethod {
  id: string;
  name: string;
  description: string;
}
