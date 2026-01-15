/**
 * Shared Memory Writer for Data Nexus Plugin
 *
 * TICKET_097_6: Node.js native addon for writing OHLCV data to shared memory.
 * Provides zero-copy data transfer from Node.js to C++ Core Engine.
 *
 * Architecture:
 * - Writer: Data Nexus Plugin (Node.js process)
 * - Reader: C++ Core Engine (backtest process)
 * - Protocol: shm_protocol.h binary format
 * - Synchronization: SWMR (Single-Writer Multiple-Reader) via sequence numbers
 */

#pragma once

#include <napi.h>
#include <string>
#include <vector>
#include <cstdint>
#include <memory>
#include <expected>

#ifdef _WIN32
#include <windows.h>
#else
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#endif

#include "../include/shm_protocol.h"

namespace quantnexus::shm::writer {

/**
 * OHLCV Candle data structure (matches JavaScript interface)
 */
struct CandleData {
    uint64_t timestamp;  // Unix timestamp in milliseconds
    double open;
    double high;
    double low;
    double close;
    double volume;
};

/**
 * Error codes for SharedMemoryWriter operations
 */
enum class WriterError {
    OK = 0,
    INVALID_NAME,
    INVALID_SIZE,
    CREATE_FAILED,
    MAPPING_FAILED,
    WRITE_FAILED,
    SYMBOL_NOT_FOUND,
    SYMBOL_LIMIT_EXCEEDED,
    CANDLE_LIMIT_EXCEEDED,
    NOT_INITIALIZED
};

/**
 * Writer statistics
 */
struct WriterStats {
    size_t total_symbols;
    size_t total_candles;
    size_t memory_used;
    uint64_t last_write_us;
    uint64_t write_count;
};

/**
 * Shared Memory Writer Implementation
 *
 * Manages a single shared memory region for OHLCV data storage.
 * Thread-safe for single writer, multiple readers.
 */
class SharedMemoryWriter {
public:
    SharedMemoryWriter();
    ~SharedMemoryWriter();

    // Non-copyable, non-movable
    SharedMemoryWriter(const SharedMemoryWriter&) = delete;
    SharedMemoryWriter& operator=(const SharedMemoryWriter&) = delete;

    /**
     * Create and initialize shared memory region
     * @param name Region name (e.g., "quantnexus_ohlcv")
     * @param size Region size in bytes (default 128MB)
     * @return WriterError::OK on success
     */
    WriterError Create(const std::string& name, size_t size = data::shm::REGION_SIZE);

    /**
     * Close and unmap shared memory region
     */
    void Close();

    /**
     * Write OHLCV candles for a symbol
     * @param symbol Symbol name (e.g., "BTCUSDT")
     * @param interval Interval (e.g., "1h", "1d")
     * @param candles Array of candle data
     * @return WriterError::OK on success
     */
    WriterError WriteCandles(
        const std::string& symbol,
        const std::string& interval,
        const std::vector<CandleData>& candles
    );

    /**
     * Get writer statistics
     */
    WriterStats GetStats() const;

    /**
     * Check if writer is initialized
     */
    bool IsInitialized() const { return region_ != nullptr; }

    /**
     * Get region name
     */
    std::string GetName() const { return name_; }

    /**
     * Get region size
     */
    size_t GetSize() const { return size_; }

private:
    // Platform-specific handle types
#ifdef _WIN32
    using Handle = HANDLE;
    static constexpr Handle INVALID_HANDLE_VALUE_ = INVALID_HANDLE_VALUE;
#else
    using Handle = int;
    static constexpr Handle INVALID_HANDLE_VALUE_ = -1;
#endif

    std::string name_;
    size_t size_;
    Handle handle_;
    void* base_ptr_;
    data::shm::SharedMemoryRegion* region_;
    size_t next_data_offset_;

    /**
     * Platform-specific create implementation
     */
    WriterError platform_create(const std::string& name, size_t size);

    /**
     * Platform-specific close implementation
     */
    void platform_close();

    /**
     * Initialize region header and symbol index
     */
    void initialize_region();

    /**
     * Find or add symbol to index
     * @return Pointer to SymbolIndexEntry or nullptr on error
     */
    data::shm::SymbolIndexEntry* find_or_add_symbol(const std::string& symbol);

    /**
     * Allocate space for data block
     * @param size Required size in bytes
     * @return Offset from region start, or 0 on failure
     */
    uint64_t allocate_data_block(size_t size);

    /**
     * Begin write transaction (increment sequence number)
     */
    void begin_write();

    /**
     * End write transaction (increment sequence number, update timestamp)
     */
    void end_write();
};

/**
 * N-API Wrapper Class
 *
 * Wraps SharedMemoryWriter for Node.js binding.
 */
class SharedMemoryWriterWrapper : public Napi::ObjectWrap<SharedMemoryWriterWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    explicit SharedMemoryWriterWrapper(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;
    std::unique_ptr<SharedMemoryWriter> writer_;

    // JavaScript-callable methods
    Napi::Value Create(const Napi::CallbackInfo& info);
    Napi::Value Close(const Napi::CallbackInfo& info);
    Napi::Value WriteCandles(const Napi::CallbackInfo& info);
    Napi::Value GetStats(const Napi::CallbackInfo& info);
    Napi::Value IsInitialized(const Napi::CallbackInfo& info);
};

} // namespace quantnexus::shm::writer
