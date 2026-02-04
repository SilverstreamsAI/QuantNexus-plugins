/**
 * Python Alpha Factory Bridge
 *
 * TICKET_250_3: Python Batch Signal Source
 *
 * C++ wrapper for calling Python AlphaFactory via pybind11.
 * Single batch call for all signal computation.
 */

#pragma once

#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <nlohmann/json.hpp>

#include <string>
#include <optional>

namespace py = pybind11;

namespace quantnexus::alpha {

/**
 * Python Alpha Factory bridge
 *
 * Manages Python interpreter and calls AlphaFactory.execute()
 * with batch OHLCV data.
 */
class PythonAlphaFactory {
public:
    PythonAlphaFactory();
    ~PythonAlphaFactory();

    // Non-copyable
    PythonAlphaFactory(const PythonAlphaFactory&) = delete;
    PythonAlphaFactory& operator=(const PythonAlphaFactory&) = delete;

    /**
     * Initialize with configuration
     *
     * @param config Configuration JSON containing signal_sources and combinator
     */
    void initialize(const nlohmann::json& config);

    /**
     * Execute batch signal computation
     *
     * Single call to Python for all signal computation.
     * Returns combined signal array.
     *
     * @param ohlcv OHLCV data array (N x 5 or N x 6)
     * @return Combined signal array (N,)
     */
    py::array_t<double> execute(const py::array_t<double>& ohlcv);

    /**
     * Check if factory is initialized
     */
    [[nodiscard]] bool isInitialized() const noexcept {
        return initialized_;
    }

    /**
     * Get signal source names
     */
    [[nodiscard]] std::vector<std::string> getSignalNames() const;

    /**
     * Get number of signal sources
     */
    [[nodiscard]] size_t getSignalCount() const;

private:
    bool initialized_ = false;
    py::object alphaFactory_;     // Python AlphaFactory instance
    py::object nonaModule_;       // nona_algorithm module
};

} // namespace quantnexus::alpha
