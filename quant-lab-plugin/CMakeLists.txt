cmake_minimum_required(VERSION 3.20)
project(quant-lab-plugin VERSION 1.0.0 LANGUAGES CXX)

# =============================================================================
# Quant Lab Plugin - Top Level CMakeLists
#
# TICKET_250_1: Repository Setup
# =============================================================================

# Add subdirectories
add_subdirectory(packages/alpha-factory)

# =============================================================================
# Summary
# =============================================================================
message(STATUS "")
message(STATUS "Quant Lab Plugin Build:")
message(STATUS "  Version: ${PROJECT_VERSION}")
message(STATUS "")
