/**
 * Signal Source Interface
 *
 * TICKET_250_2: Define ISignalSource abstract interface
 *
 * Base interface for all signal sources in the Alpha Factory.
 */

#pragma once

#include "signal_types.hpp"

#include <string>
#include <string_view>
#include <span>
#include <vector>
#include <memory>

namespace quantnexus::alpha {

// =============================================================================
// OHLCV Data Structure
// =============================================================================

/**
 * Single OHLCV bar
 */
struct OHLCVBar {
    int64_t timestamp;
    double open;
    double high;
    double low;
    double close;
    double volume;
};

/**
 * OHLCV data span (non-owning view)
 */
struct OHLCVData {
    std::span<const int64_t> timestamp;
    std::span<const double> open;
    std::span<const double> high;
    std::span<const double> low;
    std::span<const double> close;
    std::span<const double> volume;

    [[nodiscard]] size_t size() const noexcept {
        return timestamp.size();
    }

    [[nodiscard]] bool empty() const noexcept {
        return timestamp.empty();
    }
};

// =============================================================================
// ISignalSource Interface
// =============================================================================

/**
 * Abstract interface for signal sources
 *
 * Signal sources generate trading signals based on market data.
 * They can be implemented in C++ or Python.
 */
class ISignalSource {
public:
    virtual ~ISignalSource() = default;

    // =========================================================================
    // Metadata
    // =========================================================================

    /**
     * Get unique identifier for this signal source
     */
    [[nodiscard]] virtual std::string_view id() const noexcept = 0;

    /**
     * Get human-readable name
     */
    [[nodiscard]] virtual std::string_view name() const noexcept = 0;

    /**
     * Get description
     */
    [[nodiscard]] virtual std::string_view description() const noexcept = 0;

    /**
     * Get algorithm category
     */
    [[nodiscard]] virtual AlgorithmCategory category() const noexcept = 0;

    /**
     * Get version string
     */
    [[nodiscard]] virtual std::string_view version() const noexcept {
        return "1.0.0";
    }

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Get default parameters as JSON
     */
    [[nodiscard]] virtual nlohmann::json defaultParams() const {
        return nlohmann::json::object();
    }

    /**
     * Set parameters from JSON
     */
    virtual void setParams(const nlohmann::json& params) {
        (void)params;  // Default: ignore
    }

    // =========================================================================
    // Signal Generation
    // =========================================================================

    /**
     * Compute signals for all bars (batch computation)
     *
     * @param data OHLCV data
     * @return Vector of signals, one per bar
     *
     * This is the primary computation method. Signal sources should
     * implement vectorized computation for efficiency.
     */
    [[nodiscard]] virtual std::vector<Signal> compute(const OHLCVData& data) = 0;

    /**
     * Get warmup period required
     *
     * Number of bars needed before valid signals can be generated.
     * For example, a 20-period SMA needs 20 bars of warmup.
     */
    [[nodiscard]] virtual size_t warmupPeriod() const noexcept = 0;
};

// =============================================================================
// Signal Source Factory
// =============================================================================

/**
 * Factory function type for creating signal sources
 */
using SignalSourceFactory = std::unique_ptr<ISignalSource> (*)();

/**
 * Signal source registration info
 */
struct SignalSourceInfo {
    std::string id;
    std::string name;
    std::string description;
    AlgorithmCategory category;
    SignalSourceFactory factory;
};

} // namespace quantnexus::alpha
