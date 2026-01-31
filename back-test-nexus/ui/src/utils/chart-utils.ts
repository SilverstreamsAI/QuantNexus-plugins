/**
 * Chart Utilities
 *
 * TICKET_231: Centralized chart helper functions.
 * Provides candle coloring logic for synchronized display.
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Color for bullish (up) candles - processed */
export const CANDLE_COLOR_BULLISH = '#22C55E';

/** Color for bearish (down) candles - processed */
export const CANDLE_COLOR_BEARISH = '#EF4444';

/** Color for unprocessed candles (gray) */
export const CANDLE_COLOR_UNPROCESSED = '#4B5563';

// -----------------------------------------------------------------------------
// Candle Color Logic
// -----------------------------------------------------------------------------

/**
 * TICKET_231: Get candle color based on processed state.
 *
 * Implements gray-to-color transition for synchronized display:
 * - Processed candles: green (bullish) or red (bearish)
 * - Unprocessed candles: gray
 *
 * @param isUp - Whether candle is bullish (close >= open)
 * @param isProcessed - Whether this candle has been processed by backtest
 * @returns Color string for the candle
 */
export function getCandleColor(isUp: boolean, isProcessed: boolean): string {
  if (!isProcessed) {
    return CANDLE_COLOR_UNPROCESSED;
  }
  return isUp ? CANDLE_COLOR_BULLISH : CANDLE_COLOR_BEARISH;
}

/**
 * TICKET_231: Check if candle index is processed.
 *
 * @param candleIndex - Index of the candle (0-based)
 * @param processedBars - Number of bars processed so far
 * @param totalBars - Total number of bars (optional, for validation)
 * @returns True if candle is processed
 */
export function isCandleProcessed(
  candleIndex: number,
  processedBars: number,
  totalBars?: number
): boolean {
  // If processedBars is 0 or undefined, treat all as unprocessed
  if (!processedBars || processedBars <= 0) {
    return false;
  }
  // If totalBars provided and processedBars >= totalBars, all are processed
  if (totalBars !== undefined && processedBars >= totalBars) {
    return true;
  }
  return candleIndex < processedBars;
}
