/**
 * Format Utilities
 *
 * PLUGIN_TICKET_016: Pure format functions for result display.
 * Adapted from back-test-nexus BacktestResultPanel.tsx (lines 111-152).
 */

export const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '$0.00';
  const capped = Math.max(-1e12, Math.min(1e12, value));
  const sign = capped >= 0 ? '+' : '';
  return `${sign}$${Math.abs(capped).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPercent = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '0.00%';
  const capped = Math.max(-9999, Math.min(9999, value));
  const sign = capped >= 0 ? '+' : '';
  return `${sign}${capped.toFixed(2)}%`;
};

export const formatRatio = (value: number | null | undefined): string => {
  if (value == null) return '0.00';
  return value.toFixed(2);
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getColorClass = (value: number | null | undefined): string => {
  if (value == null) return 'text-color-terminal-text';
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-color-terminal-text';
};

export const safeNum = (value: number | null | undefined, defaultVal = 0): number => {
  return value ?? defaultVal;
};
