"""
Signal Source Base Class

TICKET_250_7: Abstract base class for signal sources
"""

import numpy as np
from abc import ABC, abstractmethod
from typing import Optional


class SignalSourceBase(ABC):
    """
    Abstract base class for signal sources.

    All signal sources must implement the compute() method
    which returns a signal array in the range [-1, 1].
    """

    def __init__(self, name: Optional[str] = None):
        """
        Initialize signal source.

        Args:
            name: Optional name override
        """
        self._name = name or self.__class__.__name__

    @property
    def name(self) -> str:
        """Get signal source name."""
        return self._name

    @abstractmethod
    def compute(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """
        Compute signal values.

        Args:
            open_prices: Open prices array
            high_prices: High prices array
            low_prices: Low prices array
            close_prices: Close prices array
            volume: Volume array

        Returns:
            signal: Signal array of same length as input, values in [-1, 1]
        """
        pass

    @property
    def warmup_period(self) -> int:
        """Number of bars needed before valid signals."""
        return 0

    def _normalize_signal(self, values: np.ndarray, center: float = 0.0) -> np.ndarray:
        """
        Normalize values to [-1, 1] range.

        Args:
            values: Raw signal values
            center: Center value (values above -> positive, below -> negative)

        Returns:
            Normalized signal in [-1, 1]
        """
        # Clip to prevent extreme values
        signal = np.clip(values - center, -100, 100) / 100
        return np.clip(signal, -1, 1)
