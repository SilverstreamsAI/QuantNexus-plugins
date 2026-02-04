"""
MACD Signal Source

TICKET_250_7: MACD-based signal generation
"""

import numpy as np
from .base import SignalSourceBase


class MACDSignal(SignalSourceBase):
    """
    Moving Average Convergence Divergence (MACD) signal source.

    Generates signals based on MACD line crossing signal line.

    Parameters:
        fast_period: Fast EMA period (default: 12)
        slow_period: Slow EMA period (default: 26)
        signal_period: Signal line EMA period (default: 9)
    """

    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period

    @property
    def warmup_period(self) -> int:
        return self.slow_period + self.signal_period

    def _ema(self, data: np.ndarray, period: int) -> np.ndarray:
        """Calculate Exponential Moving Average."""
        multiplier = 2 / (period + 1)
        ema = np.zeros(len(data))
        ema[0] = data[0]

        for i in range(1, len(data)):
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1]

        return ema

    def compute(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """Compute MACD-based signals."""
        n = len(close_prices)
        signal = np.zeros(n)

        # Calculate MACD components
        fast_ema = self._ema(close_prices, self.fast_period)
        slow_ema = self._ema(close_prices, self.slow_period)

        macd_line = fast_ema - slow_ema
        signal_line = self._ema(macd_line, self.signal_period)
        histogram = macd_line - signal_line

        # Generate signals based on histogram
        # Positive histogram -> bullish
        # Negative histogram -> bearish

        # Normalize histogram to signal range
        hist_std = np.std(histogram[self.warmup_period:]) if n > self.warmup_period else 1
        if hist_std < 1e-8:
            hist_std = 1

        signal = histogram / (2 * hist_std)
        signal = np.clip(signal, -1, 1)

        # Set warmup period to zero
        signal[:self.warmup_period] = 0

        return signal
