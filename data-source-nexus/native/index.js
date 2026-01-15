/**
 * Native addon wrapper with error handling
 *
 * TICKET_097_6: Shared memory writer for Data Nexus plugin
 */

const path = require('path');

// Load native addon
let nativeAddon;
try {
  nativeAddon = require('./build/Release/quantnexus_shm_writer.node');
} catch (err) {
  console.error('[DataNexus] Failed to load native shared memory writer:', err.message);
  console.error('[DataNexus] Shared memory integration disabled. Install with: npm run build');
  nativeAddon = null;
}

/**
 * SharedMemoryWriter wrapper with graceful fallback
 */
class SharedMemoryWriterWrapper {
  constructor() {
    if (nativeAddon) {
      this._writer = new nativeAddon.SharedMemoryWriter();
      this._enabled = true;
    } else {
      this._writer = null;
      this._enabled = false;
    }
  }

  isEnabled() {
    return this._enabled;
  }

  create(name, size) {
    if (!this._enabled) {
      console.warn('[DataNexus] SharedMemoryWriter not available');
      return false;
    }
    try {
      this._writer.create(name, size);
      return true;
    } catch (err) {
      console.error('[DataNexus] Failed to create shared memory:', err.message);
      this._enabled = false;
      return false;
    }
  }

  writeCandles(symbol, interval, candles) {
    if (!this._enabled) {
      return false;
    }
    try {
      this._writer.writeCandles(symbol, interval, candles);
      return true;
    } catch (err) {
      console.error('[DataNexus] Failed to write candles:', err.message);
      return false;
    }
  }

  getStats() {
    if (!this._enabled) {
      return {
        totalSymbols: 0,
        totalCandles: 0,
        memoryUsed: 0,
        lastWriteUs: 0,
        writeCount: 0
      };
    }
    return this._writer.getStats();
  }

  isInitialized() {
    return this._enabled && this._writer && this._writer.isInitialized();
  }

  close() {
    if (this._enabled && this._writer) {
      this._writer.close();
    }
  }
}

module.exports = {
  SharedMemoryWriter: SharedMemoryWriterWrapper,
  isNativeAddonAvailable: () => nativeAddon !== null
};
