/**
 * Signal Types
 *
 * TICKET_250_2: Define C++ Signal struct and related types
 *
 * Core data structures for signal generation and combination
 * in the Alpha Factory plugin.
 */

#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <chrono>
#include <nlohmann/json.hpp>

namespace quantnexus::alpha {

// =============================================================================
// Signal Direction
// =============================================================================

/**
 * Signal direction indicator
 */
enum class SignalDirection : int8_t {
    SHORT = -1,     // Bearish signal
    NEUTRAL = 0,    // No signal / flat
    LONG = 1        // Bullish signal
};

/**
 * Convert SignalDirection to string
 */
constexpr std::string_view to_string(SignalDirection dir) noexcept {
    switch (dir) {
        case SignalDirection::SHORT: return "SHORT";
        case SignalDirection::NEUTRAL: return "NEUTRAL";
        case SignalDirection::LONG: return "LONG";
    }
    return "UNKNOWN";
}

// =============================================================================
// Algorithm Category
// =============================================================================

/**
 * Algorithm category for signal sources
 *
 * Used for filtering and organizing signal sources in the UI.
 */
enum class AlgorithmCategory : uint8_t {
    TREND = 0,          // Trend-following (MA, MACD, ADX)
    MOMENTUM = 1,       // Momentum indicators (RSI, Stochastic)
    VOLATILITY = 2,     // Volatility-based (Bollinger, ATR)
    VOLUME = 3,         // Volume indicators (OBV, VWAP)
    PATTERN = 4,        // Chart patterns (candlestick, price action)
    MACHINE_LEARNING = 5, // ML-based signals
    COMPOSITE = 6,      // Combined multiple sources
    CUSTOM = 7          // User-defined
};

/**
 * Convert AlgorithmCategory to string
 */
constexpr std::string_view to_string(AlgorithmCategory cat) noexcept {
    switch (cat) {
        case AlgorithmCategory::TREND: return "TREND";
        case AlgorithmCategory::MOMENTUM: return "MOMENTUM";
        case AlgorithmCategory::VOLATILITY: return "VOLATILITY";
        case AlgorithmCategory::VOLUME: return "VOLUME";
        case AlgorithmCategory::PATTERN: return "PATTERN";
        case AlgorithmCategory::MACHINE_LEARNING: return "MACHINE_LEARNING";
        case AlgorithmCategory::COMPOSITE: return "COMPOSITE";
        case AlgorithmCategory::CUSTOM: return "CUSTOM";
    }
    return "UNKNOWN";
}

// =============================================================================
// Signal Struct (64-byte cache-aligned)
// =============================================================================

/**
 * Trading signal structure
 *
 * Designed for cache efficiency with 64-byte alignment.
 * Contains all information needed for signal combination.
 */
struct alignas(64) Signal {
    // Primary signal data (16 bytes)
    int64_t timestamp;              // Unix timestamp (ms)
    double value;                   // Signal strength [-1.0, 1.0]

    // Direction and metadata (8 bytes)
    SignalDirection direction;      // LONG, SHORT, NEUTRAL
    AlgorithmCategory category;     // Signal category
    uint8_t confidence;             // Confidence level [0-100]
    uint8_t reserved[5];            // Padding for alignment

    // Source identification (32 bytes)
    char sourceId[24];              // Signal source identifier
    uint64_t sourceHash;            // Pre-computed hash of sourceId

    // Padding to 64 bytes (8 bytes)
    uint64_t padding;

    // ==========================================================================
    // Constructors
    // ==========================================================================

    Signal() noexcept
        : timestamp(0)
        , value(0.0)
        , direction(SignalDirection::NEUTRAL)
        , category(AlgorithmCategory::CUSTOM)
        , confidence(0)
        , reserved{0}
        , sourceId{0}
        , sourceHash(0)
        , padding(0)
    {}

    Signal(int64_t ts, double val, SignalDirection dir,
           std::string_view source, AlgorithmCategory cat = AlgorithmCategory::CUSTOM,
           uint8_t conf = 50) noexcept
        : timestamp(ts)
        , value(val)
        , direction(dir)
        , category(cat)
        , confidence(conf)
        , reserved{0}
        , sourceHash(0)
        , padding(0)
    {
        setSourceId(source);
    }

    // ==========================================================================
    // Methods
    // ==========================================================================

    /**
     * Set source identifier
     */
    void setSourceId(std::string_view source) noexcept {
        size_t len = std::min(source.size(), sizeof(sourceId) - 1);
        std::copy_n(source.begin(), len, sourceId);
        sourceId[len] = '\0';

        // Compute FNV-1a hash
        sourceHash = 14695981039346656037ULL;
        for (size_t i = 0; i < len; ++i) {
            sourceHash ^= static_cast<uint64_t>(sourceId[i]);
            sourceHash *= 1099511628211ULL;
        }
    }

    /**
     * Get source identifier as string_view
     */
    [[nodiscard]] std::string_view getSourceId() const noexcept {
        return std::string_view(sourceId);
    }

    /**
     * Check if signal is bullish
     */
    [[nodiscard]] bool isBullish() const noexcept {
        return direction == SignalDirection::LONG;
    }

    /**
     * Check if signal is bearish
     */
    [[nodiscard]] bool isBearish() const noexcept {
        return direction == SignalDirection::SHORT;
    }

    /**
     * Check if signal is neutral
     */
    [[nodiscard]] bool isNeutral() const noexcept {
        return direction == SignalDirection::NEUTRAL;
    }

    /**
     * Get weighted value (value * confidence / 100)
     */
    [[nodiscard]] double weightedValue() const noexcept {
        return value * (confidence / 100.0);
    }
};

// Verify size is exactly 64 bytes
static_assert(sizeof(Signal) == 64, "Signal must be 64 bytes for cache alignment");

// =============================================================================
// JSON Serialization
// =============================================================================

inline void to_json(nlohmann::json& j, const Signal& s) {
    j = nlohmann::json{
        {"timestamp", s.timestamp},
        {"value", s.value},
        {"direction", static_cast<int>(s.direction)},
        {"category", static_cast<int>(s.category)},
        {"confidence", s.confidence},
        {"sourceId", std::string(s.sourceId)}
    };
}

inline void from_json(const nlohmann::json& j, Signal& s) {
    s.timestamp = j.value("timestamp", int64_t(0));
    s.value = j.value("value", 0.0);
    s.direction = static_cast<SignalDirection>(j.value("direction", 0));
    s.category = static_cast<AlgorithmCategory>(j.value("category", 7));
    s.confidence = j.value("confidence", uint8_t(50));
    s.setSourceId(j.value("sourceId", std::string("")));
}

} // namespace quantnexus::alpha
