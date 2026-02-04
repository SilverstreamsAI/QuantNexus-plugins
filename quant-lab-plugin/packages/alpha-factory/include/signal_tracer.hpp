/**
 * Signal Tracer
 *
 * TICKET_250_13: Signal Tracing
 *
 * Records signal values at each layer for debugging.
 * Exports trace data for UI visualization.
 */

#pragma once

#include "signal_types.hpp"

#include <vector>
#include <string>
#include <chrono>
#include <mutex>
#include <nlohmann/json.hpp>

namespace quantnexus::alpha {

/**
 * Trace entry for a single signal at a specific point
 */
struct TraceEntry {
    int64_t barIndex;
    std::string nodeId;
    Signal signal;
    std::chrono::steady_clock::time_point timestamp;
    std::string layer;  // "source", "filter", "combinator", "output"

    nlohmann::json toJson() const {
        return nlohmann::json{
            {"barIndex", barIndex},
            {"nodeId", nodeId},
            {"signal", signal},
            {"layer", layer},
            {"timestampNs", std::chrono::duration_cast<std::chrono::nanoseconds>(
                timestamp.time_since_epoch()).count()}
        };
    }
};

/**
 * Signal flow tracer
 *
 * Records signal values at each processing layer.
 * Thread-safe for concurrent access.
 */
class SignalTracer {
public:
    SignalTracer() = default;

    /**
     * Enable/disable tracing
     */
    void setEnabled(bool enabled) noexcept {
        enabled_ = enabled;
    }

    [[nodiscard]] bool isEnabled() const noexcept {
        return enabled_;
    }

    /**
     * Clear all traces
     */
    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        traces_.clear();
    }

    /**
     * Record a signal trace
     *
     * @param barIndex Current bar index
     * @param nodeId Node identifier (e.g., "rsi_14", "combinator")
     * @param signal Signal value
     * @param layer Processing layer
     */
    void trace(int64_t barIndex, const std::string& nodeId,
               const Signal& signal, const std::string& layer = "source") {
        if (!enabled_) return;

        std::lock_guard<std::mutex> lock(mutex_);

        TraceEntry entry;
        entry.barIndex = barIndex;
        entry.nodeId = nodeId;
        entry.signal = signal;
        entry.timestamp = std::chrono::steady_clock::now();
        entry.layer = layer;

        traces_.push_back(std::move(entry));
    }

    /**
     * Record batch traces for multiple signals at same bar
     */
    void traceBatch(int64_t barIndex,
                    const std::vector<std::pair<std::string, Signal>>& signals,
                    const std::string& layer = "source") {
        if (!enabled_) return;

        std::lock_guard<std::mutex> lock(mutex_);
        auto now = std::chrono::steady_clock::now();

        for (const auto& [nodeId, signal] : signals) {
            TraceEntry entry;
            entry.barIndex = barIndex;
            entry.nodeId = nodeId;
            entry.signal = signal;
            entry.timestamp = now;
            entry.layer = layer;

            traces_.push_back(std::move(entry));
        }
    }

    /**
     * Export all traces as JSON
     */
    [[nodiscard]] nlohmann::json exportTrace() const {
        std::lock_guard<std::mutex> lock(mutex_);

        nlohmann::json result = nlohmann::json::array();
        for (const auto& entry : traces_) {
            result.push_back(entry.toJson());
        }

        return result;
    }

    /**
     * Export traces for specific bar range
     */
    [[nodiscard]] nlohmann::json exportTraceRange(int64_t startBar, int64_t endBar) const {
        std::lock_guard<std::mutex> lock(mutex_);

        nlohmann::json result = nlohmann::json::array();
        for (const auto& entry : traces_) {
            if (entry.barIndex >= startBar && entry.barIndex <= endBar) {
                result.push_back(entry.toJson());
            }
        }

        return result;
    }

    /**
     * Get trace count
     */
    [[nodiscard]] size_t traceCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return traces_.size();
    }

    /**
     * Export signal flow graph (nodes and edges)
     *
     * For react-flow visualization
     */
    [[nodiscard]] nlohmann::json exportFlowGraph() const {
        std::lock_guard<std::mutex> lock(mutex_);

        // Collect unique nodes
        std::set<std::string> nodeIds;
        std::map<std::string, std::string> nodeLayer;

        for (const auto& entry : traces_) {
            nodeIds.insert(entry.nodeId);
            nodeLayer[entry.nodeId] = entry.layer;
        }

        // Build nodes array
        nlohmann::json nodes = nlohmann::json::array();
        int y = 0;
        std::map<std::string, int> layerY{
            {"source", 0},
            {"filter", 100},
            {"combinator", 200},
            {"output", 300}
        };

        int x = 0;
        std::string lastLayer;
        for (const auto& nodeId : nodeIds) {
            const auto& layer = nodeLayer[nodeId];
            if (layer != lastLayer) {
                x = 0;
                lastLayer = layer;
            }

            nodes.push_back({
                {"id", nodeId},
                {"type", "signalNode"},
                {"position", {{"x", x * 200}, {"y", layerY[layer]}}},
                {"data", {{"label", nodeId}, {"layer", layer}}}
            });

            x++;
        }

        // Build edges (source -> combinator -> output)
        nlohmann::json edges = nlohmann::json::array();
        for (const auto& nodeId : nodeIds) {
            if (nodeLayer[nodeId] == "source") {
                // Connect to combinator
                edges.push_back({
                    {"id", nodeId + "-combinator"},
                    {"source", nodeId},
                    {"target", "combinator"},
                    {"animated", true}
                });
            } else if (nodeLayer[nodeId] == "combinator") {
                // Connect to output
                edges.push_back({
                    {"id", "combinator-output"},
                    {"source", "combinator"},
                    {"target", "output"},
                    {"animated", true}
                });
            }
        }

        return {{"nodes", nodes}, {"edges", edges}};
    }

private:
    bool enabled_ = false;
    mutable std::mutex mutex_;
    std::vector<TraceEntry> traces_;
};

} // namespace quantnexus::alpha
