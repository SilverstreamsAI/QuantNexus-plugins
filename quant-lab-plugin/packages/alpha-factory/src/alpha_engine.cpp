/**
 * Alpha Engine Implementation
 *
 * TICKET_250_6: Alpha Engine Core
 */

#include "alpha_engine.hpp"

#include <pybind11/embed.h>
#include <chrono>
#include <format>

namespace py = pybind11;

namespace quantnexus::alpha {

AlphaEngine::AlphaEngine()
    : pythonFactory_(std::make_unique<PythonAlphaFactory>()) {
}

AlphaEngine::~AlphaEngine() = default;

void AlphaEngine::cancel() noexcept {
    cancelled_.store(true, std::memory_order_release);
}

executor::ExecutionResult AlphaEngine::execute(
    const nlohmann::json& config,
    executor::ProgressCallback progressCallback
) {
    executor::ExecutionResult result;
    auto startTime = std::chrono::steady_clock::now();

    // Reset state
    cancelled_.store(false, std::memory_order_release);
    setProgress(0.0f);

    try {
        if (progressCallback) {
            progressCallback(0.0, "Initializing Alpha Factory...");
        }

        // Extract alpha factory config
        nlohmann::json alphaConfig = config.value("alphaFactory", nlohmann::json::object());

        // Initialize Python factory
        pythonFactory_->initialize(alphaConfig);
        setProgress(10.0f);

        if (progressCallback) {
            progressCallback(10.0, std::format(
                "Loaded {} signal sources",
                pythonFactory_->getSignalCount()));
        }

        // Check for cancellation
        if (cancelled()) {
            result.success = false;
            result.errorMessage = "Execution cancelled";
            return result;
        }

        // Get OHLCV data from config
        // TODO: Load from file path or receive as parameter
        nlohmann::json dataConfig = config.value("data", nlohmann::json::object());
        std::string dataPath = dataConfig.value("dataPath", "");

        if (dataPath.empty()) {
            throw std::runtime_error("No data path specified in config");
        }

        if (progressCallback) {
            progressCallback(20.0, "Loading market data...");
        }

        // TODO: Load OHLCV data from parquet file
        // For now, create dummy data for testing
        const size_t n_bars = 1000;
        py::array_t<double> ohlcv({n_bars, size_t(5)});
        auto buf = ohlcv.mutable_unchecked<2>();

        // Fill with dummy data
        for (size_t i = 0; i < n_bars; ++i) {
            double base = 100.0 + std::sin(i * 0.1) * 10;
            buf(i, 0) = base;           // open
            buf(i, 1) = base + 1.0;     // high
            buf(i, 2) = base - 1.0;     // low
            buf(i, 3) = base + 0.5;     // close
            buf(i, 4) = 1000000.0;      // volume
        }

        setProgress(30.0f);

        if (cancelled()) {
            result.success = false;
            result.errorMessage = "Execution cancelled";
            return result;
        }

        if (progressCallback) {
            progressCallback(30.0, "Computing signals...");
        }

        // Execute Python AlphaFactory
        py::array_t<double> signals = pythonFactory_->execute(ohlcv);
        setProgress(90.0f);

        if (progressCallback) {
            progressCallback(90.0, "Processing results...");
        }

        // Build result
        result.success = true;

        // Copy signals to result
        auto signalBuf = signals.unchecked<1>();
        std::vector<double> signalVec(signalBuf.shape(0));
        for (size_t i = 0; i < signalVec.size(); ++i) {
            signalVec[i] = signalBuf(i);
        }

        result.data["signals"] = signalVec;
        result.data["signalCount"] = pythonFactory_->getSignalCount();
        result.data["signalNames"] = pythonFactory_->getSignalNames();
        result.data["barCount"] = n_bars;

        // Calculate execution time
        auto endTime = std::chrono::steady_clock::now();
        auto executionMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            endTime - startTime).count();
        result.data["executionTimeMs"] = executionMs;

        setProgress(100.0f);

        if (progressCallback) {
            progressCallback(100.0, "Complete");
        }

    } catch (const py::error_already_set& e) {
        result.success = false;
        result.errorMessage = std::format("Python error: {}", e.what());
    } catch (const std::exception& e) {
        result.success = false;
        result.errorMessage = e.what();
    }

    return result;
}

} // namespace quantnexus::alpha
