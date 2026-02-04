"""
Alpha Factory - Main Entry Point

TICKET_250_7: Python Alpha Factory Framework

Main entry point for C++ to call via pybind11.
Orchestrates signal computation and combination.
"""

import numpy as np
from typing import Dict, Any, Optional

from .signal_factory import SignalFactory
from .combinator import Combinator


class AlphaFactory:
    """
    Main entry point for batch signal computation.

    Called from C++ via pybind11 with a single call to execute().
    All signal computation and combination happens in Python.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Alpha Factory.

        Args:
            config: Configuration dictionary containing:
                - signal_sources: List of signal source configurations
                - combinator: Combinator configuration
        """
        self.config = config

        # Initialize signal factory
        signal_config = config.get("signal_sources", [])
        self.signal_factory = SignalFactory(signal_config)

        # Initialize combinator
        combinator_config = config.get("combinator", {"method": "equal_weight"})
        self.combinator = Combinator(combinator_config)

    def execute(self, ohlcv: np.ndarray) -> np.ndarray:
        """
        Execute batch signal computation.

        Single entry point for C++ to call.
        Computes all signals and combines them.

        Args:
            ohlcv: OHLCV data array of shape (N, 5) or (N, 6)
                   Columns: [open, high, low, close, volume] or
                           [timestamp, open, high, low, close, volume]

        Returns:
            combined: Combined signal array of shape (N,)
                      Values in range [-1, 1]
        """
        # Validate input
        if ohlcv.ndim != 2:
            raise ValueError(f"Expected 2D array, got {ohlcv.ndim}D")

        n_bars = ohlcv.shape[0]
        n_cols = ohlcv.shape[1]

        # Extract OHLCV columns
        if n_cols == 5:
            # [open, high, low, close, volume]
            open_prices = ohlcv[:, 0]
            high_prices = ohlcv[:, 1]
            low_prices = ohlcv[:, 2]
            close_prices = ohlcv[:, 3]
            volume = ohlcv[:, 4]
        elif n_cols == 6:
            # [timestamp, open, high, low, close, volume]
            open_prices = ohlcv[:, 1]
            high_prices = ohlcv[:, 2]
            low_prices = ohlcv[:, 3]
            close_prices = ohlcv[:, 4]
            volume = ohlcv[:, 5]
        else:
            raise ValueError(f"Expected 5 or 6 columns, got {n_cols}")

        # 1. Compute all signals (vectorized)
        signals = self.signal_factory.compute_all(
            open_prices, high_prices, low_prices, close_prices, volume
        )

        if signals.size == 0:
            # No signal sources configured, return neutral
            return np.zeros(n_bars)

        # 2. Combine signals
        combined = self.combinator.combine(signals)

        return combined

    def get_signal_names(self) -> list:
        """Get names of all configured signal sources."""
        return self.signal_factory.get_signal_names()

    def get_signal_count(self) -> int:
        """Get number of configured signal sources."""
        return self.signal_factory.get_signal_count()


def create_alpha_factory(config: Dict[str, Any]) -> AlphaFactory:
    """
    Factory function for creating AlphaFactory instance.

    Used by C++ via pybind11.
    """
    return AlphaFactory(config)
