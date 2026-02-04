"""
SMA Crossover Signal Source

TICKET_250_7: SMA crossover-based signal generation
"""

import numpy as np
from .base import SignalSourceBase


class SMACrossSignal(SignalSourceBase):
    """
    Simple Moving Average Crossover signal source.

    Generates signals based on fast SMA crossing slow SMA.

    Parameters:
        fast_period: Fast SMA period (default: 10)
        slow_period: Slow SMA period (default: 30)
    """

    def __init__(
        self,
        fast_period: int = 10,
        slow_period: int = 30,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.fast_period = fast_period
        self.slow_period = slow_period

    @property
    def warmup_period(self) -> int:
        return self.slow_period

    def _sma(self, data: np.ndarray, period: int) -> np.ndarray:
        """Calculate Simple Moving Average."""
        sma = np.zeros(len(data))

        # Cumulative sum for efficient SMA calculation
        cumsum = np.cumsum(data)

        sma[period - 1:] = (cumsum[period - 1:] - np.concatenate([[0], cumsum[:-period]])) / period
        sma[:period - 1] = np.nan

        return sma

    def compute(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """Compute SMA crossover signals."""
        n = len(close_prices)
        signal = np.zeros(n)

        # Calculate SMAs
        fast_sma = self._sma(close_prices, self.fast_period)
        slow_sma = self._sma(close_prices, self.slow_period)

        # Calculate distance between SMAs (normalized)
        # Positive when fast > slow (bullish)
        # Negative when fast < slow (bearish)
        distance = fast_sma - slow_sma

        # Normalize by slow SMA to get percentage
        with np.errstate(divide='ignore', invalid='ignore'):
            normalized = np.where(slow_sma != 0, distance / slow_sma * 100, 0)

        # Map to signal range [-1, 1]
        # 1% difference maps to ~0.5 signal strength
        signal = np.clip(normalized / 2, -1, 1)

        # Set warmup period to zero
        signal[:self.warmup_period] = 0

        # Replace NaN with 0
        signal = np.nan_to_num(signal, nan=0.0)

        return signal
