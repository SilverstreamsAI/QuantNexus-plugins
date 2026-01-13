#!/bin/bash
#
# back-test-nexus Plugin Build Script
#
# Usage:
#   ./build.sh          # Build Cython modules (in-place)
#   ./build.sh wheel    # Build wheel package
#   ./build.sh clean    # Clean build artifacts
#   ./build.sh ui       # Build UI components
#   ./build.sh all      # Build everything
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Build Cython engine
build_engine() {
    log_info "Building Cython engine..."

    local ENGINE_DIR="$SCRIPT_DIR/src/engine"

    if [ ! -f "$ENGINE_DIR/setup.py" ]; then
        log_error "Engine setup.py not found at $ENGINE_DIR"
        return 1
    fi

    # Check Cython
    if ! python -c "import Cython" 2>/dev/null; then
        log_warn "Cython not installed, installing..."
        pip install "cython>=3.0" || {
            log_error "Failed to install Cython"
            return 1
        }
    fi

    # Build
    (cd "$ENGINE_DIR" && python setup.py build_ext --inplace) || {
        log_error "Cython build failed"
        return 1
    }

    log_info "Cython engine build complete"

    # Count compiled files
    local SO_COUNT=$(find "$ENGINE_DIR/src" -name "*.so" | wc -l)
    log_info "Compiled $SO_COUNT .so modules"
}

# Build wheel package
build_wheel() {
    log_info "Building wheel package..."

    local ENGINE_DIR="$SCRIPT_DIR/src/engine"

    (cd "$ENGINE_DIR" && ./build.sh clean && ./build.sh wheel) || {
        log_error "Wheel build failed"
        return 1
    }

    log_info "Wheel package built: $(ls "$ENGINE_DIR/dist/"*.whl 2>/dev/null | head -1)"
}

# Build UI
build_ui() {
    log_info "Building UI components..."

    local UI_DIR="$SCRIPT_DIR/ui"

    if [ ! -f "$UI_DIR/package.json" ]; then
        log_warn "UI package.json not found, skipping"
        return 0
    fi

    # Detect package manager
    if command -v pnpm &> /dev/null; then
        PM="pnpm"
    else
        PM="npm"
    fi

    (cd "$UI_DIR" && $PM install && $PM run build) || {
        log_error "UI build failed"
        return 1
    }

    log_info "UI build complete"
}

# Clean
clean() {
    log_info "Cleaning build artifacts..."

    local ENGINE_DIR="$SCRIPT_DIR/src/engine"

    if [ -f "$ENGINE_DIR/build.sh" ]; then
        (cd "$ENGINE_DIR" && ./build.sh clean)
    fi

    log_info "Clean complete"
}

# Show help
show_help() {
    echo "back-test-nexus Plugin Build Script"
    echo ""
    echo "Usage: ./build.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (none)    Build Cython engine (in-place)"
    echo "  wheel     Build wheel package"
    echo "  ui        Build UI components"
    echo "  clean     Clean build artifacts"
    echo "  all       Build everything (engine + UI)"
    echo "  help      Show this help"
}

# Main
case "${1:-}" in
    wheel|w)
        build_wheel
        ;;
    ui|u)
        build_ui
        ;;
    clean|c)
        clean
        ;;
    all|a)
        build_engine
        build_ui
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        build_engine
        ;;
esac
