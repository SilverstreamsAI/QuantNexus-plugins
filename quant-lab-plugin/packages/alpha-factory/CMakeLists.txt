cmake_minimum_required(VERSION 3.20)
project(alpha-factory VERSION 1.0.0 LANGUAGES CXX)

# =============================================================================
# C++ Standard
# =============================================================================
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# =============================================================================
# Build Options
# =============================================================================
option(BUILD_SHARED_LIBS "Build shared libraries" ON)

# =============================================================================
# Compiler Flags
# =============================================================================
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" OR CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
    add_compile_options(-Wall -Wextra -Wpedantic -fPIC)
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
    add_compile_options(/W4 /permissive-)
endif()

# =============================================================================
# Dependencies
# =============================================================================
# Find main executor for IExecutorPlugin interface
set(QUANTNEXUS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../../")
set(EXECUTOR_INCLUDE "${QUANTNEXUS_ROOT}/packages/executor/include")

# Find vcpkg dependencies (from executor)
set(VCPKG_INSTALLED "${QUANTNEXUS_ROOT}/packages/executor/vcpkg_installed/x64-linux")
list(APPEND CMAKE_PREFIX_PATH "${VCPKG_INSTALLED}")

set(PYBIND11_FINDPYTHON ON)
find_package(pybind11 CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)

# =============================================================================
# Alpha Factory Library
# =============================================================================
set(ALPHA_FACTORY_SOURCES
    src/python_alpha_factory.cpp
    src/alpha_engine.cpp
    src/plugin_entry.cpp
)

add_library(alpha_factory SHARED ${ALPHA_FACTORY_SOURCES})

target_include_directories(alpha_factory PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${EXECUTOR_INCLUDE}
)

target_link_libraries(alpha_factory PUBLIC
    pybind11::embed
    nlohmann_json::nlohmann_json
)

# Set output name without 'lib' prefix on Windows
set_target_properties(alpha_factory PROPERTIES
    OUTPUT_NAME "alpha_factory"
    PREFIX "lib"
)

# =============================================================================
# Install
# =============================================================================
install(TARGETS alpha_factory
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)

install(DIRECTORY include/
    DESTINATION include
)

# =============================================================================
# Summary
# =============================================================================
message(STATUS "")
message(STATUS "Alpha Factory Plugin Configuration:")
message(STATUS "  C++ Standard:     ${CMAKE_CXX_STANDARD}")
message(STATUS "  Build Type:       ${CMAKE_BUILD_TYPE}")
message(STATUS "  Executor Include: ${EXECUTOR_INCLUDE}")
message(STATUS "")
