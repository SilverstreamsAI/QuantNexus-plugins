"""
NONA Algorithm Setup

TICKET_250_7: Python Alpha Factory Framework
"""

from setuptools import setup, find_packages

setup(
    name="nona-algorithm",
    version="1.0.0",
    description="Signal Factory and Combinator for Alpha Factory",
    author="QuantNexus",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "numpy>=1.20.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Financial and Insurance Industry",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
