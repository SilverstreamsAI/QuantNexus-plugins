"""
RSI Signal Source

TICKET_250_7: RSI-based signal generation
"""

import numpy as np
from .base import SignalSourceBase


class RSISignal(SignalSourceBase):
    """
    Relative Strength Index (RSI) signal source.

    Generates signals based on RSI overbought/oversold levels.

    Parameters:
        period: RSI calculation period (default: 14)
        overbought: Overbought threshold (default: 70)
        oversold: Oversold threshold (default: 30)
    """

    def __init__(
        self,
        period: int = 14,
        overbought: float = 70,
        oversold: float = 30,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.period = period
        self.overbought = overbought
        self.oversold = oversold

    @property
    def warmup_period(self) -> int:
        return self.period + 1

    def compute(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """Compute RSI-based signals."""
        n = len(close_prices)
        signal = np.zeros(n)

        # Calculate price changes
        delta = np.diff(close_prices, prepend=close_prices[0])

        # Separate gains and losses
        gains = np.where(delta > 0, delta, 0)
        losses = np.where(delta < 0, -delta, 0)

        # Calculate smoothed averages (Wilder's method)
        avg_gain = np.zeros(n)
        avg_loss = np.zeros(n)

        # Initial SMA
        if n > self.period:
            avg_gain[self.period] = np.mean(gains[1:self.period + 1])
            avg_loss[self.period] = np.mean(losses[1:self.period + 1])

            # Smoothed moving average
            for i in range(self.period + 1, n):
                avg_gain[i] = (avg_gain[i - 1] * (self.period - 1) + gains[i]) / self.period
                avg_loss[i] = (avg_loss[i - 1] * (self.period - 1) + losses[i]) / self.period

        # Calculate RSI
        rs = np.where(avg_loss != 0, avg_gain / avg_loss, 100)
        rsi = 100 - (100 / (1 + rs))

        # Generate signals
        # Oversold -> bullish signal (positive)
        # Overbought -> bearish signal (negative)
        # Map RSI to [-1, 1] with 50 as center
        signal = (50 - rsi) / 50  # RSI 30 -> +0.4, RSI 70 -> -0.4

        # Amplify signals in extreme zones
        signal = np.where(rsi < self.oversold, signal * 2, signal)
        signal = np.where(rsi > self.overbought, signal * 2, signal)

        # Clip to [-1, 1]
        signal = np.clip(signal, -1, 1)

        # Set warmup period to zero
        signal[:self.warmup_period] = 0

        return signal
