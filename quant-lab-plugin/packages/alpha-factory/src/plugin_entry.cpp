/**
 * Plugin Entry Point
 *
 * TICKET_250_8: Executor Plugin Integration
 *
 * Export symbols for dynamic plugin loading.
 */

#include "alpha_engine.hpp"

using namespace quantnexus::alpha;
using namespace quantnexus::executor;

extern "C" {

/**
 * Create plugin instance
 */
IExecutorPlugin* create_plugin() {
    return new AlphaEngine();
}

/**
 * Destroy plugin instance
 */
void destroy_plugin(IExecutorPlugin* plugin) {
    delete plugin;
}

/**
 * Get plugin version
 */
const char* plugin_version() {
    return "1.0.0";
}

/**
 * Get plugin name
 */
const char* plugin_name() {
    return "alpha-factory";
}

} // extern "C"
