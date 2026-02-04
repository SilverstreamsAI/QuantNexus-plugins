"""
Signal Factory - Batch Signal Computation

TICKET_250_7: Python Alpha Factory Framework

Manages signal sources and computes all signals in batch.
"""

import numpy as np
from typing import Dict, Any, List, Optional
import importlib


class SignalFactory:
    """
    Factory for computing multiple signals in batch.

    Maintains a collection of signal sources and computes
    all signals in a single vectorized pass.
    """

    def __init__(self, config: List[Dict[str, Any]]):
        """
        Initialize signal factory.

        Args:
            config: List of signal source configurations, each containing:
                - type: Signal source type (e.g., "rsi", "macd", "sma_cross")
                - params: Parameters for the signal source
        """
        self.sources = []
        self.source_names = []

        for source_config in config:
            source_type = source_config.get("type", "")
            params = source_config.get("params", {})
            name = source_config.get("name", source_type)

            source = self._create_source(source_type, params)
            if source is not None:
                self.sources.append(source)
                self.source_names.append(name)

    def _create_source(self, source_type: str, params: Dict[str, Any]):
        """Create a signal source by type."""
        # Built-in sources
        if source_type == "rsi":
            from .signal_sources.rsi_signal import RSISignal
            return RSISignal(**params)
        elif source_type == "macd":
            from .signal_sources.macd_signal import MACDSignal
            return MACDSignal(**params)
        elif source_type == "sma_cross":
            from .signal_sources.sma_cross_signal import SMACrossSignal
            return SMACrossSignal(**params)

        # Try to load as module path
        if "." in source_type:
            try:
                module_path, class_name = source_type.rsplit(".", 1)
                module = importlib.import_module(module_path)
                source_class = getattr(module, class_name)
                return source_class(**params)
            except (ImportError, AttributeError) as e:
                print(f"Warning: Failed to load signal source {source_type}: {e}")

        return None

    def compute_all(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """
        Compute all signals in batch.

        Args:
            open_prices: Open prices array
            high_prices: High prices array
            low_prices: Low prices array
            close_prices: Close prices array
            volume: Volume array

        Returns:
            signals: Array of shape (N, M) where N is bars and M is sources
        """
        if not self.sources:
            return np.array([])

        n_bars = len(close_prices)
        n_sources = len(self.sources)

        # Pre-allocate output
        signals = np.zeros((n_bars, n_sources))

        # Compute each signal source
        for i, source in enumerate(self.sources):
            try:
                signal = source.compute(
                    open_prices, high_prices, low_prices, close_prices, volume
                )
                signals[:, i] = signal
            except Exception as e:
                print(f"Warning: Signal source {self.source_names[i]} failed: {e}")
                # Keep zeros for failed sources

        return signals

    def get_signal_names(self) -> List[str]:
        """Get names of all signal sources."""
        return self.source_names.copy()

    def get_signal_count(self) -> int:
        """Get number of signal sources."""
        return len(self.sources)
