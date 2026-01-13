"""
Cython build configuration for QuantNexus Backtest Engine Plugin.

Usage:
    Development build (in-place):
        python setup.py build_ext --inplace

    Production wheel:
        python setup.py bdist_wheel
"""

import os
import sys
from pathlib import Path

from setuptools import setup, find_packages
from setuptools.extension import Extension

# Check if Cython is available
try:
    from Cython.Build import cythonize
    from Cython.Distutils import build_ext
    USE_CYTHON = True
except ImportError:
    USE_CYTHON = False
    cythonize = None
    build_ext = None

# Try to import numpy for include path
try:
    import numpy as np
    NUMPY_INCLUDE = [np.get_include()]
except ImportError:
    NUMPY_INCLUDE = []


def get_extension_modules():
    """
    Get list of extension modules to compile.

    Files to compile:
    - All .pyx files in src/
    - Excludes:
      - proto/ directory (generated gRPC code)
      - __pycache__/ directories
    """
    # Use relative path from setup.py directory
    base_dir = Path(__file__).parent.resolve()
    src_dir = base_dir / "src"
    extensions = []

    # Directories to exclude
    exclude_dirs = {
        "proto",
        "__pycache__",
    }

    # Find all .pyx files
    for pyx_file in src_dir.rglob("*.pyx"):
        # Skip excluded directories
        if any(excl in pyx_file.parts for excl in exclude_dirs):
            continue

        # Convert to relative path from base_dir
        rel_path = pyx_file.relative_to(base_dir)
        module_name = str(rel_path.with_suffix("")).replace(os.sep, ".")

        # Use relative path string for sources
        rel_source = str(rel_path)

        ext = Extension(
            name=module_name,
            sources=[rel_source],
            include_dirs=NUMPY_INCLUDE,
            define_macros=[("NPY_NO_DEPRECATED_API", "NPY_1_7_API_VERSION")],
        )
        extensions.append(ext)

    return extensions


def get_ext_modules():
    """Get extension modules, with or without Cython."""
    extensions = get_extension_modules()

    if USE_CYTHON and extensions:
        return cythonize(
            extensions,
            compiler_directives={
                "language_level": "3",
                "boundscheck": False,
                "wraparound": False,
                "initializedcheck": False,
                "cdivision": True,
                "embedsignature": True,
            },
            annotate=False,  # Set True to generate HTML annotation files
        )

    return extensions


# Only build extensions if Cython is available
ext_modules = get_ext_modules() if USE_CYTHON else []
cmdclass = {"build_ext": build_ext} if USE_CYTHON and build_ext else {}

setup(
    name="quantnexus-backtest-engine",
    version="1.0.0",
    description="QuantNexus Backtest Engine Plugin with Cython optimization",
    author="QuantNexus Team",
    author_email="team@quantnexus.io",
    packages=find_packages(where="."),
    package_dir={"": "."},
    ext_modules=ext_modules,
    cmdclass=cmdclass,
    python_requires=">=3.10",
    install_requires=[
        "grpcio>=1.60.0",
        "grpcio-tools>=1.60.0",
        "protobuf>=4.25.0",
        "backtrader>=1.9.78",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "python-dateutil>=2.8.0",
        "pytz>=2024.1",
        "structlog>=24.1.0",
    ],
    extras_require={
        "dev": [
            "cython>=3.0",
            "pytest>=7.4.0",
            "pytest-asyncio>=0.23.0",
            "pytest-cov>=4.1.0",
        ],
    },
    zip_safe=False,
)
