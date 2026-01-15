/**
 * Test script for SharedMemoryWriter native addon
 *
 * TICKET_097_6: Verify shared memory writing functionality
 */

const path = require('path');

// Try to load the addon
let addon;
try {
  addon = require('../build/Release/quantnexus_shm_writer.node');
} catch (err) {
  console.error('Failed to load addon. Have you run `npm run build`?');
  console.error(err.message);
  process.exit(1);
}

const { SharedMemoryWriter } = addon;

console.log('=== SharedMemoryWriter Test ===\n');

// Test 1: Create writer
console.log('Test 1: Create writer');
const writer = new SharedMemoryWriter();
console.log('✓ Writer instantiated\n');

// Test 2: Initialize shared memory
console.log('Test 2: Initialize shared memory');
try {
  writer.create('quantnexus_test', 10 * 1024 * 1024);  // 10 MB
  console.log('✓ Shared memory created: quantnexus_test (10 MB)\n');
} catch (err) {
  console.error('✗ Failed to create shared memory:', err.message);
  process.exit(1);
}

// Test 3: Write OHLCV data
console.log('Test 3: Write OHLCV data');
const candles = [
  {
    timestamp: 1704067200000,  // 2024-01-01 00:00:00
    open: 42000.0,
    high: 42500.0,
    low: 41800.0,
    close: 42300.0,
    volume: 125.5
  },
  {
    timestamp: 1704070800000,  // 2024-01-01 01:00:00
    open: 42300.0,
    high: 42800.0,
    low: 42100.0,
    close: 42600.0,
    volume: 98.3
  },
  {
    timestamp: 1704074400000,  // 2024-01-01 02:00:00
    open: 42600.0,
    high: 43000.0,
    low: 42400.0,
    close: 42900.0,
    volume: 156.7
  }
];

try {
  writer.writeCandles('BTCUSDT', '1h', candles);
  console.log('✓ Written 3 candles for BTCUSDT (1h)\n');
} catch (err) {
  console.error('✗ Failed to write candles:', err.message);
  process.exit(1);
}

// Test 4: Write more symbols
console.log('Test 4: Write multiple symbols');
try {
  writer.writeCandles('ETHUSDT', '1h', candles.map(c => ({
    ...c,
    open: c.open / 10,
    high: c.high / 10,
    low: c.low / 10,
    close: c.close / 10
  })));
  writer.writeCandles('BTCUSDT', '1d', [candles[0]]);
  console.log('✓ Written ETHUSDT (1h) and BTCUSDT (1d)\n');
} catch (err) {
  console.error('✗ Failed to write additional symbols:', err.message);
  process.exit(1);
}

// Test 5: Get statistics
console.log('Test 5: Get statistics');
const stats = writer.getStats();
console.log('Statistics:');
console.log(`  Total Symbols: ${stats.totalSymbols}`);
console.log(`  Total Candles: ${stats.totalCandles}`);
console.log(`  Memory Used: ${(stats.memoryUsed / 1024).toFixed(2)} KB`);
console.log(`  Write Count: ${stats.writeCount}`);
console.log(`  Last Write: ${stats.lastWriteUs} μs\n`);

// Test 6: Close writer
console.log('Test 6: Close writer');
writer.close();
console.log('✓ Writer closed\n');

console.log('=== All Tests Passed ===');
console.log('\nNote: Shared memory region "quantnexus_test" remains in system.');
console.log('Linux: Check with `ls /dev/shm/quantnexus_test`');
console.log('macOS: Check with `ls /tmp/quantnexus_test`');
console.log('To clean up: rm /dev/shm/quantnexus_test (Linux) or rm /tmp/quantnexus_test (macOS)');
