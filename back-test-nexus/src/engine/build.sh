#!/bin/bash
#
# Build script for QuantNexus Backtest Engine Plugin (Cython)
#
# Usage:
#   ./build.sh          # Development build (in-place)
#   ./build.sh clean    # Clean build artifacts
#   ./build.sh wheel    # Build wheel package
#   ./build.sh all      # Clean + build + wheel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

clean() {
    log_info "Cleaning build artifacts..."

    # Remove Cython generated C files
    find src -name "*.c" -type f -delete 2>/dev/null || true

    # Remove compiled shared objects
    find src -name "*.so" -type f -delete 2>/dev/null || true
    find src -name "*.pyd" -type f -delete 2>/dev/null || true

    # Remove build directories
    rm -rf build/ dist/ *.egg-info/ 2>/dev/null || true

    # Remove __pycache__
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    # Remove .pyc files
    find . -name "*.pyc" -type f -delete 2>/dev/null || true

    log_info "Clean complete."
}

build_inplace() {
    log_info "Building Cython extensions in-place..."

    # Check if Cython is installed
    if ! python -c "import Cython" 2>/dev/null; then
        log_error "Cython not installed. Run: pip install cython>=3.0"
        exit 1
    fi

    # Build in-place
    python setup.py build_ext --inplace

    log_info "In-place build complete."

    # List compiled files
    log_info "Compiled files:"
    find src -name "*.so" -o -name "*.pyd" 2>/dev/null | head -20
}

build_wheel() {
    log_info "Building wheel package..."

    # Check if wheel is installed
    if ! python -c "import wheel" 2>/dev/null; then
        log_warn "wheel not installed. Installing..."
        pip install wheel
    fi

    # Build wheel
    python setup.py bdist_wheel

    log_info "Wheel build complete."
    log_info "Wheel packages:"
    ls -la dist/*.whl 2>/dev/null || log_warn "No wheel files found"
}

show_help() {
    echo "QuantNexus Backtest Engine - Cython Build Script"
    echo ""
    echo "Usage: ./build.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (none)    Development build (in-place)"
    echo "  clean     Clean all build artifacts"
    echo "  wheel     Build wheel package"
    echo "  all       Clean + build + wheel"
    echo "  help      Show this help message"
}

# Main
case "${1:-}" in
    clean)
        clean
        ;;
    wheel)
        build_wheel
        ;;
    all)
        clean
        build_inplace
        build_wheel
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        build_inplace
        ;;
esac
