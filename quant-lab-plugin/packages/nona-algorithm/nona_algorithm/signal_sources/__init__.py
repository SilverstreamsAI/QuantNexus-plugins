"""
Signal Sources

TICKET_250_7: Example signal source implementations
"""

from .base import SignalSourceBase
from .rsi_signal import RSISignal
from .macd_signal import MACDSignal
from .sma_cross_signal import SMACrossSignal

__all__ = ["SignalSourceBase", "RSISignal", "MACDSignal", "SMACrossSignal"]
