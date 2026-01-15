# QuantNexus Shared Memory Writer - Native Addon

**TICKET_097_6**: Node.js native addon for writing OHLCV data to shared memory.

## Purpose

Provides zero-copy data transfer from Data Nexus Plugin (Node.js) to C++ Core Engine for high-performance backtesting.

## Architecture

```
Data Nexus Plugin (Node.js)
  ↓ fetch from ClickHouse/Binance
  ↓ cache in memory
  ↓ write via Native Addon
Shared Memory Region (128 MB)
  ↓ read via C++ Core
C++ Core Engine (BacktestRunner)
  ↓ zero-copy access to OHLCV data
```

## Installation

```bash
cd plugins/data-source-nexus/native
npm install
npm run build
```

## Usage

```javascript
const { SharedMemoryWriter } = require('./build/Release/quantnexus_shm_writer');

// Create writer instance
const writer = new SharedMemoryWriter();

// Initialize shared memory (name, size in bytes)
writer.create('quantnexus_ohlcv', 128 * 1024 * 1024);

// Write OHLCV candles
const candles = [
  {
    timestamp: 1704067200000,  // Unix timestamp in milliseconds
    open: 42000.0,
    high: 42500.0,
    low: 41800.0,
    close: 42300.0,
    volume: 125.5
  },
  // ... more candles
];

writer.writeCandles('BTCUSDT', '1h', candles);

// Get statistics
const stats = writer.getStats();
console.log(stats);
// {
//   totalSymbols: 2,
//   totalCandles: 100,
//   memoryUsed: 52480,
//   lastWriteUs: 1704067200000000,
//   writeCount: 5
// }

// Close writer
writer.close();
```

## API Reference

### `new SharedMemoryWriter()`

Creates a new writer instance.

### `create(name: string, size?: number): void`

Initializes shared memory region.

- **name**: Region name (e.g., `'quantnexus_ohlcv'`)
- **size**: Region size in bytes (default: 128 MB)

**Throws**: Error if creation fails

### `writeCandles(symbol: string, interval: string, candles: Candle[]): void`

Writes OHLCV candles for a symbol.

- **symbol**: Symbol name (e.g., `'BTCUSDT'`)
- **interval**: Time interval (e.g., `'1h'`, `'1d'`)
- **candles**: Array of candle objects

**Candle Format**:
```typescript
interface Candle {
  timestamp: number;  // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

**Throws**: Error if write fails

### `getStats(): WriterStats`

Returns writer statistics.

**Returns**:
```typescript
interface WriterStats {
  totalSymbols: number;   // Number of symbols in memory
  totalCandles: number;   // Total candles written
  memoryUsed: number;     // Memory used in bytes
  lastWriteUs: number;    // Last write timestamp (microseconds)
  writeCount: number;     // Total write operations
}
```

### `close(): void`

Closes and unmaps shared memory region.

### `isInitialized(): boolean`

Returns whether writer is initialized.

## Protocol

Binary protocol defined in `include/shm_protocol.h`:

```
Memory Layout:
┌─────────────────────────────────────┐
│ Header (256 bytes)                  │
│ - Magic: 0x514E5853 ("QNXS")       │
│ - Version: 1                        │
│ - Sequence number (SWMR sync)       │
│ - Last update timestamp             │
├─────────────────────────────────────┤
│ Symbol Index (4 KB)                 │
│ - Max 256 symbols                   │
│ - Each entry: 36 bytes              │
│   - Symbol name (16 bytes)          │
│   - Data offset (8 bytes)           │
│   - Candle count (4 bytes)          │
├─────────────────────────────────────┤
│ Data Sections (variable)            │
│ - OHLCV blocks for each symbol      │
│ - Each candle: 48 bytes             │
│   - Timestamp (8 bytes)             │
│   - OHLCV (5 × 8 bytes)             │
└─────────────────────────────────────┘
```

## Synchronization

Uses **SWMR (Single-Writer Multiple-Reader)** pattern:

- Writer increments sequence number to odd before write
- Writer increments sequence number to even after write
- Readers check sequence before/after read
- If sequence is odd or changed, retry read
- No locks required, lock-free design

## Performance

- **Zero-copy**: Data written once, read directly by C++
- **Lock-free**: No mutex overhead
- **Latency**: ~1-5 μs write time per symbol
- **Throughput**: ~100,000 candles/sec on modern CPU

## Platform Support

- ✅ **Linux**: POSIX shared memory (`shm_open`, `mmap`)
- ✅ **macOS**: POSIX shared memory
- ✅ **Windows**: File mapping (`CreateFileMapping`, `MapViewOfFile`)

## Testing

```bash
npm test
```

Runs test script that:
1. Creates shared memory region
2. Writes sample OHLCV data
3. Verifies statistics
4. Cleans up

## Troubleshooting

### Build Errors

**"node-gyp not found"**:
```bash
npm install -g node-gyp
```

**"Python not found"** (Windows):
```bash
npm install --global windows-build-tools
```

**"Cannot find node-addon-api"**:
```bash
npm install
```

### Runtime Errors

**"Failed to create shared memory: error code 2"**:
- Insufficient permissions
- Check `/dev/shm` permissions on Linux

**"Failed to write candles: error code 7"**:
- Symbol limit exceeded (max 256 symbols)
- Increase REGION_SIZE in protocol

**"Memory limit exceeded"**:
- Increase size parameter in `create()`
- Default 128 MB can hold ~2.7M candles

## Cleanup

Shared memory regions persist after process exit.

**Linux**:
```bash
rm /dev/shm/quantnexus_ohlcv
```

**macOS**:
```bash
rm /tmp/quantnexus_ohlcv
```

**Windows**:
Automatically cleaned by OS on reboot.

## Development

### File Structure
```
native/
├── binding.gyp           # node-gyp configuration
├── package.json          # npm metadata
├── src/
│   ├── addon.cpp         # N-API entry point
│   ├── shm_writer.cpp    # Writer implementation
│   └── shm_writer.h      # Writer header
├── include/
│   └── shm_protocol.h    # Binary protocol definition
└── test/
    └── test.js           # Test script
```

### Rebuild
```bash
npm run clean
npm run build
```

### Debug Build
```bash
node-gyp rebuild --debug
```

## License

MIT
