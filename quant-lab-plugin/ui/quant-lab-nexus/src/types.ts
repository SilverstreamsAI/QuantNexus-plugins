/**
 * Quant Lab Type Definitions
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 */

export type QuantLabSubPage = 'hub' | 'factory';

/**
 * PLUGIN_TICKET_010: Component detail for each slot (Analysis/Entry/Exit)
 */
export interface SignalChipComponent {
  algorithmName: string;
  timeframe: string;
}

export interface SignalChip {
  id: string;       // signal_source_registry.id
  name: string;     // signal_source_registry.name
  // PLUGIN_TICKET_010: Component details (from signal_source_registry)
  analysis?: SignalChipComponent;
  entry?: SignalChipComponent;
  exit?: SignalChipComponent;
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
