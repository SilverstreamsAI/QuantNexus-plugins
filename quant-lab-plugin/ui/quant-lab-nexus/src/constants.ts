/**
 * Quant Lab Constants
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 */

import { CombinatorMethod } from './types';

/**
 * PLUGIN_TICKET_010: Timeframe options for signal component dropdowns.
 * Same values as back-test-nexus TimeframeDropdown (cannot cross-plugin import).
 */
export const TIMEFRAME_OPTIONS = [
  '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M',
] as const;

export const SIGNAL_COMBINATOR_METHODS: CombinatorMethod[] = [
  { id: 'equal', name: 'Equal Weight', description: 'Simple average of all signals' },
  { id: 'sharpe_weighted', name: 'Sharpe Weighted', description: 'Weight by historical Sharpe ratio' },
  { id: 'correlation_adjusted', name: 'Correlation Adjusted', description: 'Penalize highly correlated signals' },
  { id: 'regime_based', name: 'Regime Based', description: 'Regime-dependent weights' },
];

export const EXIT_COMBINATOR_METHODS: CombinatorMethod[] = [
  { id: 'any', name: 'Any', description: 'Any exit triggers (conservative)' },
  { id: 'all', name: 'All', description: 'All exits must trigger (aggressive)' },
  { id: 'majority', name: 'Majority', description: 'More than 50% exits trigger' },
  { id: 'priority', name: 'Priority', description: 'Check in order, first trigger wins' },
];
