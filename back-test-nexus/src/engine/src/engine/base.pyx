"""
Abstract Backtest Engine Interface

Defines the contract for backtest engine implementations.
Supports pluggable engines (Backtrader, Zipline, VectorBT, etc.)
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Callable, Optional
from enum import Enum

from ..config import BacktestConfig
from ..account import BacktestAccountManager


class EngineType(Enum):
    """Supported engine types."""
    BACKTRADER = "backtrader"
    ZIPLINE = "zipline"
    VECTORBT = "vectorbt"
    CUSTOM = "custom"


class BacktestEngine(ABC):
    """
    Abstract base class for backtest engines.

    All engine implementations must inherit from this class
    and implement the required methods.

    Usage:
        class MyEngine(BacktestEngine):
            def run(self, config, strategy_code, ...):
                # Implementation
                pass

            def get_engine_type(self):
                return EngineType.CUSTOM
    """

    @abstractmethod
    def run(
        self,
        config: BacktestConfig,
        strategy_code: str,
        symbols: List[str],
        time_range: Any,
        account_manager: BacktestAccountManager,
        on_progress: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        """
        Execute a backtest.

        Args:
            config: Backtest configuration
            strategy_code: Strategy source code
            symbols: List of symbols to trade
            time_range: Time range for backtest
            account_manager: Account manager instance
            on_progress: Optional progress callback

        Returns:
            Dictionary with backtest results containing:
            - final_value: Final portfolio value
            - trade_count: Number of completed trades
            - sharpe: Sharpe ratio
            - max_drawdown: Maximum drawdown
            - progress_updates: List of progress updates
        """
        pass

    @abstractmethod
    def get_engine_type(self) -> EngineType:
        """
        Get the engine type identifier.

        Returns:
            EngineType enum value
        """
        pass

    @abstractmethod
    def get_supported_features(self) -> List[str]:
        """
        Get list of supported features.

        Returns:
            List of feature names, e.g.:
            - "multi_symbol": Supports multiple symbols
            - "leverage": Supports leveraged trading
            - "short_selling": Supports short selling
            - "fractional_shares": Supports fractional share trading
            - "streaming_progress": Supports progress streaming
        """
        pass

    def validate_strategy_code(self, strategy_code: str) -> bool:
        """
        Validate strategy code syntax.

        Args:
            strategy_code: Strategy source code

        Returns:
            True if valid

        Raises:
            ValueError: If code is invalid
        """
        if not strategy_code or not strategy_code.strip():
            return True  # Empty code uses default strategy

        try:
            compile(strategy_code, "<strategy>", "exec")
            return True
        except SyntaxError as e:
            raise ValueError(f"Invalid strategy syntax: {e}")

    def get_engine_info(self) -> Dict[str, Any]:
        """
        Get engine information.

        Returns:
            Dictionary with engine metadata
        """
        return {
            "type": self.get_engine_type().value,
            "features": self.get_supported_features(),
        }
