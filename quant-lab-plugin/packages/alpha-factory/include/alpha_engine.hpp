/**
 * Alpha Engine
 *
 * TICKET_250_6: Alpha Engine Core
 *
 * Main execution engine implementing IExecutorPlugin interface.
 * Thin C++ layer that delegates to Python AlphaFactory.
 */

#pragma once

#include "signal_types.hpp"
#include "python_alpha_factory.hpp"

// Include from main executor
#include <quantnexus/executor/plugin_interface.hpp>

#include <atomic>
#include <memory>

namespace quantnexus::alpha {

/**
 * Alpha Factory execution engine
 *
 * Implements IExecutorPlugin to integrate with main Executor.
 * Delegates signal computation to Python AlphaFactory.
 */
class AlphaEngine : public executor::IExecutorPlugin {
public:
    AlphaEngine();
    ~AlphaEngine() override;

    // Non-copyable
    AlphaEngine(const AlphaEngine&) = delete;
    AlphaEngine& operator=(const AlphaEngine&) = delete;

    // =========================================================================
    // IExecutorPlugin Implementation
    // =========================================================================

    [[nodiscard]] std::string_view name() const noexcept override {
        return "alpha-factory";
    }

    [[nodiscard]] std::string_view version() const noexcept override {
        return "1.0.0";
    }

    [[nodiscard]] std::string_view description() const noexcept override {
        return "Alpha Factory - Signal combination and evaluation";
    }

    executor::ExecutionResult execute(
        const nlohmann::json& config,
        executor::ProgressCallback progressCallback = nullptr
    ) override;

    void cancel() noexcept override;

    [[nodiscard]] bool cancelled() const noexcept override {
        return cancelled_.load(std::memory_order_acquire);
    }

    [[nodiscard]] float progress() const noexcept override {
        return progress_.load(std::memory_order_acquire);
    }

private:
    void setProgress(float value) noexcept {
        progress_.store(value, std::memory_order_release);
    }

    std::unique_ptr<PythonAlphaFactory> pythonFactory_;
    std::atomic<bool> cancelled_{false};
    std::atomic<float> progress_{0.0f};
};

} // namespace quantnexus::alpha
