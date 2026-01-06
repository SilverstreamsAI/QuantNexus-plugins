"""
Backtest Engine implementations.

Currently supports:
- BacktraderEngine: Integration with Backtrader library

Extensible via BacktestEngine abstract base class.
"""

from .base import BacktestEngine, EngineType
from .backtrader_engine import BacktraderEngine

__all__ = [
    "BacktestEngine",
    "EngineType",
    "BacktraderEngine",
]
