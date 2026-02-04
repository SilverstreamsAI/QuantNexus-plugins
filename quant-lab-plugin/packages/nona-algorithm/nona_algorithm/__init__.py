"""
NONA Algorithm - Signal Factory and Combinator

TICKET_250_7: Python Alpha Factory Framework

Provides batch signal computation and combination for the Alpha Factory plugin.
"""

from .alpha_factory import AlphaFactory
from .signal_factory import SignalFactory
from .combinator import Combinator

__version__ = "1.0.0"
__all__ = ["AlphaFactory", "SignalFactory", "Combinator"]
