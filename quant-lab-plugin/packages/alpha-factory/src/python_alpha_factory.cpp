/**
 * Python Alpha Factory Bridge Implementation
 *
 * TICKET_250_3: Python Batch Signal Source
 */

#include "python_alpha_factory.hpp"

#include <stdexcept>
#include <format>

namespace quantnexus::alpha {

PythonAlphaFactory::PythonAlphaFactory() = default;

PythonAlphaFactory::~PythonAlphaFactory() {
    // Release Python objects before interpreter shutdown
    alphaFactory_ = py::none();
    nonaModule_ = py::none();
}

void PythonAlphaFactory::initialize(const nlohmann::json& config) {
    if (initialized_) {
        return;
    }

    try {
        // Import nona_algorithm module
        nonaModule_ = py::module_::import("nona_algorithm");

        // Get AlphaFactory class
        py::object AlphaFactoryClass = nonaModule_.attr("AlphaFactory");

        // Convert config to Python dict
        py::object pyConfig = py::cast(config);

        // Create AlphaFactory instance
        alphaFactory_ = AlphaFactoryClass(pyConfig);

        initialized_ = true;

    } catch (const py::error_already_set& e) {
        throw std::runtime_error(std::format(
            "Failed to initialize Python AlphaFactory: {}", e.what()));
    }
}

py::array_t<double> PythonAlphaFactory::execute(const py::array_t<double>& ohlcv) {
    if (!initialized_) {
        throw std::runtime_error("PythonAlphaFactory not initialized");
    }

    try {
        // Call AlphaFactory.execute(ohlcv)
        py::object result = alphaFactory_.attr("execute")(ohlcv);

        // Convert result to numpy array
        return result.cast<py::array_t<double>>();

    } catch (const py::error_already_set& e) {
        throw std::runtime_error(std::format(
            "Python execution failed: {}", e.what()));
    }
}

std::vector<std::string> PythonAlphaFactory::getSignalNames() const {
    if (!initialized_) {
        return {};
    }

    try {
        py::list names = alphaFactory_.attr("get_signal_names")();
        std::vector<std::string> result;
        result.reserve(py::len(names));

        for (const auto& name : names) {
            result.push_back(name.cast<std::string>());
        }

        return result;

    } catch (const py::error_already_set&) {
        return {};
    }
}

size_t PythonAlphaFactory::getSignalCount() const {
    if (!initialized_) {
        return 0;
    }

    try {
        return alphaFactory_.attr("get_signal_count")().cast<size_t>();
    } catch (const py::error_already_set&) {
        return 0;
    }
}

} // namespace quantnexus::alpha
