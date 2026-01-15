/**
 * Shared Memory Protocol Definition
 *
 * TICKET_097_6: Binary data format for zero-copy data transfer between
 * Data Nexus Plugin (Node.js) and C++ Core Engine.
 *
 * Memory Layout:
 * - [0x0000] Header (256 bytes)
 * - [0x0100] Symbol Index (4 KB)
 * - [0x1100] Data Sections (variable)
 *
 * Synchronization: Single-Writer Multiple-Reader (SWMR)
 * - Writer increments sequence on each update
 * - Readers check sequence before/after read
 * - No locks required
 */

#pragma once

#include <cstdint>
#include <cstring>
#include <string>
#include <chrono>

namespace quantnexus::data::shm {

// =============================================================================
// Constants
// =============================================================================

constexpr uint32_t MAGIC = 0x514E5853;              // "QNXS" magic number
constexpr uint32_t VERSION = 1;                     // Protocol version
constexpr size_t REGION_SIZE = 128 * 1024 * 1024;  // 128 MB total
constexpr size_t MAX_SYMBOLS = 256;                 // Max concurrent symbols
constexpr size_t MAX_CANDLES_PER_SYMBOL = 100000;  // Max bars per symbol
constexpr size_t SYMBOL_NAME_SIZE = 16;            // Symbol name length
constexpr size_t INTERVAL_SIZE = 8;                // Interval string length

constexpr size_t HEADER_OFFSET = 0;
constexpr size_t SYMBOL_INDEX_OFFSET = 256;
constexpr size_t SYMBOL_INDEX_SIZE = 16384;  // 16 KB (enough for 256 * 40-byte entries)
constexpr size_t DATA_SECTIONS_OFFSET = 16640;  // 256 + 16384

// =============================================================================
// Header Structure (256 bytes)
// =============================================================================

struct Header {
    uint32_t magic;              // Magic number for validation (0x514E5853)
    uint32_t version;            // Protocol version
    uint32_t writer_pid;         // Node.js process PID
    uint32_t reader_pid;         // C++ process PID (first reader)
    uint64_t last_update_us;     // Last update timestamp (microseconds since epoch)
    uint64_t sequence;           // Sequence number (odd=writing, even=complete)
    uint32_t symbol_count;       // Number of symbols in index
    uint32_t flags;              // Flags (reserved)
    uint32_t crc32;              // CRC32 checksum of entire region
    uint8_t reserved[212];       // Reserved for future use (256 - 44 = 212)

    /**
     * Validate header magic and version
     */
    bool IsValid() const {
        return magic == MAGIC && version == VERSION;
    }

    /**
     * Check if write is in progress (odd sequence number)
     */
    bool IsWriting() const {
        return (sequence & 1) != 0;
    }
} __attribute__((packed));

static_assert(sizeof(Header) == 256, "Header must be exactly 256 bytes");

// =============================================================================
// Symbol Index Entry (36 bytes)
// =============================================================================

struct SymbolIndexEntry {
    char symbol[SYMBOL_NAME_SIZE];  // Symbol name (null-terminated)
    uint64_t data_offset;           // Offset from region start to data block
    uint32_t data_size;             // Size of data block in bytes
    uint32_t candle_count;          // Number of candles in block
    uint64_t last_update_us;        // Last update timestamp

    /**
     * Set symbol name (truncates if too long)
     */
    void SetSymbol(const std::string& sym) {
        std::strncpy(symbol, sym.c_str(), SYMBOL_NAME_SIZE - 1);
        symbol[SYMBOL_NAME_SIZE - 1] = '\0';
    }

    /**
     * Get symbol name as string
     */
    std::string GetSymbol() const {
        return std::string(symbol, strnlen(symbol, SYMBOL_NAME_SIZE));
    }

    /**
     * Check if entry is empty
     */
    bool IsEmpty() const {
        return symbol[0] == '\0' || data_offset == 0;
    }
} __attribute__((packed));

static_assert(sizeof(SymbolIndexEntry) == 40, "SymbolIndexEntry must be 40 bytes");

// =============================================================================
// Symbol Index (16 KB)
// =============================================================================

struct SymbolIndex {
    uint32_t count;                        // Number of active entries
    uint8_t padding[4];                    // Alignment padding
    SymbolIndexEntry entries[MAX_SYMBOLS]; // Symbol entries

    /**
     * Find symbol in index
     * @return Pointer to entry or nullptr if not found
     */
    SymbolIndexEntry* Find(const std::string& symbol) {
        for (uint32_t i = 0; i < count && i < MAX_SYMBOLS; ++i) {
            if (entries[i].GetSymbol() == symbol) {
                return &entries[i];
            }
        }
        return nullptr;
    }

    /**
     * Find symbol in index (const version)
     */
    const SymbolIndexEntry* Find(const std::string& symbol) const {
        return const_cast<SymbolIndex*>(this)->Find(symbol);
    }

    /**
     * Add new symbol to index
     * @return Pointer to new entry or nullptr if full
     */
    SymbolIndexEntry* Add(const std::string& symbol) {
        if (count >= MAX_SYMBOLS) {
            return nullptr;
        }
        auto* entry = &entries[count++];
        entry->SetSymbol(symbol);
        return entry;
    }

    /**
     * Get index size in bytes
     */
    static constexpr size_t Size() {
        return sizeof(uint32_t) + 4 + sizeof(SymbolIndexEntry) * MAX_SYMBOLS;
    }
} __attribute__((packed));

static_assert(sizeof(SymbolIndex) <= SYMBOL_INDEX_SIZE, "SymbolIndex must fit in allocated space");

// =============================================================================
// OHLCV Candle (48 bytes)
// =============================================================================

struct Candle {
    uint64_t timestamp;  // Unix timestamp in milliseconds
    double open;         // Open price
    double high;         // High price
    double low;          // Low price
    double close;        // Close price
    double volume;       // Volume

    Candle() = default;

    Candle(uint64_t ts, double o, double h, double l, double c, double v)
        : timestamp(ts), open(o), high(h), low(l), close(c), volume(v) {}
} __attribute__((packed));

static_assert(sizeof(Candle) == 48, "Candle must be exactly 48 bytes");

// =============================================================================
// OHLCV Data Block (variable size)
// =============================================================================

struct OHLCVDataBlock {
    char symbol[SYMBOL_NAME_SIZE];   // Symbol name
    char interval[INTERVAL_SIZE];    // Interval (e.g., "1d", "1h")
    uint32_t count;                  // Number of candles
    uint32_t capacity;               // Allocated capacity
    uint64_t start_timestamp;        // First candle timestamp
    uint64_t end_timestamp;          // Last candle timestamp
    uint8_t padding[8];              // Alignment padding
    Candle candles[];                // Flexible array member

    /**
     * Set symbol name
     */
    void SetSymbol(const std::string& sym) {
        std::strncpy(symbol, sym.c_str(), SYMBOL_NAME_SIZE - 1);
        symbol[SYMBOL_NAME_SIZE - 1] = '\0';
    }

    /**
     * Set interval
     */
    void SetInterval(const std::string& intvl) {
        std::strncpy(interval, intvl.c_str(), INTERVAL_SIZE - 1);
        interval[INTERVAL_SIZE - 1] = '\0';
    }

    /**
     * Get symbol name
     */
    std::string GetSymbol() const {
        return std::string(symbol, strnlen(symbol, SYMBOL_NAME_SIZE));
    }

    /**
     * Get interval
     */
    std::string GetInterval() const {
        return std::string(interval, strnlen(interval, INTERVAL_SIZE));
    }

    /**
     * Get total size of this block including candles
     */
    size_t TotalSize() const {
        return sizeof(OHLCVDataBlock) + count * sizeof(Candle);
    }

    /**
     * Get header size (excluding candles array)
     */
    static constexpr size_t HeaderSize() {
        return sizeof(OHLCVDataBlock);
    }

    /**
     * Calculate required size for N candles
     */
    static constexpr size_t RequiredSize(uint32_t n) {
        return HeaderSize() + n * sizeof(Candle);
    }
} __attribute__((packed));

// =============================================================================
// Shared Memory Region (root structure)
// =============================================================================

struct SharedMemoryRegion {
    Header header;                  // Offset 0, Size 256
    SymbolIndex symbol_index;       // Offset 256, Size 10248
    uint8_t index_padding[SYMBOL_INDEX_SIZE - sizeof(SymbolIndex)];  // Pad to 16 KB
    uint8_t data_sections[];        // Flexible array for OHLCV blocks

    /**
     * Map raw pointer to SharedMemoryRegion
     */
    static SharedMemoryRegion* Map(void* ptr) {
        return static_cast<SharedMemoryRegion*>(ptr);
    }

    /**
     * Map raw pointer to SharedMemoryRegion (const)
     */
    static const SharedMemoryRegion* Map(const void* ptr) {
        return static_cast<const SharedMemoryRegion*>(ptr);
    }

    /**
     * Validate region magic and version
     */
    bool IsValid() const {
        return header.IsValid();
    }

    /**
     * Get OHLCV data block for symbol
     * @return Pointer to block or nullptr if not found
     */
    OHLCVDataBlock* GetDataBlock(const std::string& symbol) {
        auto* entry = symbol_index.Find(symbol);
        if (!entry || entry->data_offset == 0) {
            return nullptr;
        }
        return reinterpret_cast<OHLCVDataBlock*>(
            reinterpret_cast<uint8_t*>(this) + entry->data_offset
        );
    }

    /**
     * Get OHLCV data block for symbol (const)
     */
    const OHLCVDataBlock* GetDataBlock(const std::string& symbol) const {
        return const_cast<SharedMemoryRegion*>(this)->GetDataBlock(symbol);
    }

    /**
     * Get header offset in bytes
     */
    static constexpr size_t GetHeaderOffset() {
        return HEADER_OFFSET;
    }

    /**
     * Get symbol index offset in bytes
     */
    static constexpr size_t GetSymbolIndexOffset() {
        return SYMBOL_INDEX_OFFSET;
    }

    /**
     * Get data sections offset in bytes
     */
    static constexpr size_t GetDataSectionsOffset() {
        return DATA_SECTIONS_OFFSET;
    }
} __attribute__((packed));

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate CRC32 checksum (simple implementation)
 */
inline uint32_t CalculateCRC32(const void* data, size_t size) {
    const uint8_t* bytes = static_cast<const uint8_t*>(data);
    uint32_t crc = 0xFFFFFFFF;

    for (size_t i = 0; i < size; ++i) {
        crc ^= bytes[i];
        for (int j = 0; j < 8; ++j) {
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }

    return ~crc;
}

/**
 * Get current timestamp in microseconds
 */
inline uint64_t GetTimestampMicros() {
    return std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

} // namespace quantnexus::data::shm
