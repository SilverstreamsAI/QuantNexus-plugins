/**
 * TypeScript type definitions for quantnexus_shm_writer native addon
 *
 * TICKET_097_6: Shared memory writer for zero-copy data transfer
 */

export interface Candle {
  timestamp: number;  // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WriterStats {
  totalSymbols: number;   // Number of symbols in shared memory
  totalCandles: number;   // Total candles written
  memoryUsed: number;     // Memory used in bytes
  lastWriteUs: number;    // Last write timestamp (microseconds)
  writeCount: number;     // Total write operations
}

export class SharedMemoryWriter {
  /**
   * Create a new SharedMemoryWriter instance
   */
  constructor();

  /**
   * Initialize shared memory region
   * @param name Region name (e.g., 'quantnexus_ohlcv')
   * @param size Region size in bytes (default: 128 MB)
   * @throws Error if creation fails
   */
  create(name: string, size?: number): void;

  /**
   * Write OHLCV candles for a symbol
   * @param symbol Symbol name (e.g., 'BTCUSDT')
   * @param interval Time interval (e.g., '1h', '1d')
   * @param candles Array of candle data
   * @throws Error if write fails
   */
  writeCandles(symbol: string, interval: string, candles: Candle[]): void;

  /**
   * Get writer statistics
   */
  getStats(): WriterStats;

  /**
   * Check if writer is initialized
   */
  isInitialized(): boolean;

  /**
   * Close and unmap shared memory region
   */
  close(): void;
}
