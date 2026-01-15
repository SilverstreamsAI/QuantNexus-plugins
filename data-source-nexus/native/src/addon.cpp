/**
 * QuantNexus Shared Memory Writer - Native Addon Entry Point
 *
 * TICKET_097_6: N-API addon for writing OHLCV data to shared memory.
 *
 * Usage from Node.js:
 *   const { SharedMemoryWriter } = require('./build/Release/quantnexus_shm_writer');
 *   const writer = new SharedMemoryWriter();
 *   writer.create('quantnexus_ohlcv', 128 * 1024 * 1024);
 *   writer.writeCandles('BTCUSDT', '1h', candles);
 *   const stats = writer.getStats();
 *   writer.close();
 */

#include <napi.h>
#include "shm_writer.h"

/**
 * Module initialization
 */
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return quantnexus::shm::writer::SharedMemoryWriterWrapper::Init(env, exports);
}

NODE_API_MODULE(quantnexus_shm_writer, InitAll)
