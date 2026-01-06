"""
BacktestConfig - Configuration Management

Based on nona_server's src/backtest/backtest_config.py pattern.

Responsibilities:
1. Encapsulate backtest configuration parameters
2. Provide type-safe configuration access
3. Validate configuration values
4. Apply configuration to Backtrader Cerebro
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Default values
DEFAULT_INITIAL_CAPITAL = 100000.0
DEFAULT_ORDER_SIZE = 1000.0
DEFAULT_ORDER_UNIT = "cash"
DEFAULT_COMMISSION_RATE = 0.001
DEFAULT_SLIPPAGE_RATE = 0.0005


@dataclass
class BacktestConfig:
    """
    Backtest configuration container.

    Attributes:
        initial_capital: Starting capital
        order_size_value: Order size value
        order_size_unit: Order unit ("cash", "fixed", "percent")
        commission_rate: Commission rate per trade (0.001 = 0.1%)
        slippage_rate: Slippage rate per trade (0.0005 = 0.05%)
        leverage: Maximum leverage (1 = no leverage)
        allow_short: Allow short selling
        task_id: Task ID for tracking
        user_id: User ID for tracking

    Example:
        >>> config = BacktestConfig.from_proto(proto_config)
        >>> config.apply_to_cerebro(cerebro)
    """

    # Core configuration
    initial_capital: float = DEFAULT_INITIAL_CAPITAL
    order_size_value: float = DEFAULT_ORDER_SIZE
    order_size_unit: str = DEFAULT_ORDER_UNIT
    commission_rate: float = DEFAULT_COMMISSION_RATE
    slippage_rate: float = DEFAULT_SLIPPAGE_RATE
    leverage: int = 1
    allow_short: bool = True

    # Tracking
    task_id: Optional[str] = None
    user_id: Optional[str] = None

    # Benchmark
    benchmark: Optional[str] = None

    def __post_init__(self):
        """Validate configuration after initialization."""
        self._validate()

    def _validate(self):
        """Validate configuration parameters."""
        # Validate initial_capital
        if self.initial_capital <= 0:
            raise ValueError(
                f"initial_capital must be positive, got {self.initial_capital}"
            )

        # Validate order_size_value
        if self.order_size_value <= 0:
            raise ValueError(
                f"order_size_value must be positive, got {self.order_size_value}"
            )

        # Validate order_size_unit
        valid_units = ["cash", "fixed", "percent"]
        if self.order_size_unit not in valid_units:
            raise ValueError(
                f"order_size_unit must be one of {valid_units}, got '{self.order_size_unit}'"
            )

        # Validate percent range
        if self.order_size_unit == "percent":
            if not (0 < self.order_size_value <= 100):
                raise ValueError(
                    f"order_size_value must be 0-100 when unit is 'percent', "
                    f"got {self.order_size_value}"
                )

        # Validate commission_rate
        if not (0 <= self.commission_rate < 1):
            raise ValueError(
                f"commission_rate must be 0-1, got {self.commission_rate}"
            )

        # Validate slippage_rate
        if not (0 <= self.slippage_rate < 1):
            raise ValueError(
                f"slippage_rate must be 0-1, got {self.slippage_rate}"
            )

        # Validate leverage
        if self.leverage < 1:
            raise ValueError(
                f"leverage must be >= 1, got {self.leverage}"
            )

    @classmethod
    def from_proto(cls, proto_config) -> "BacktestConfig":
        """
        Create BacktestConfig from protobuf BacktestConfig message.

        Args:
            proto_config: backtest_pb2.BacktestConfig message

        Returns:
            BacktestConfig instance
        """
        return cls(
            initial_capital=proto_config.initial_capital or DEFAULT_INITIAL_CAPITAL,
            commission_rate=proto_config.commission_rate or DEFAULT_COMMISSION_RATE,
            slippage_rate=proto_config.slippage_rate or DEFAULT_SLIPPAGE_RATE,
            leverage=proto_config.leverage or 1,
            allow_short=proto_config.allow_short,
            benchmark=proto_config.benchmark or None,
        )

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BacktestConfig":
        """
        Create BacktestConfig from dictionary.

        Args:
            data: Configuration dictionary

        Returns:
            BacktestConfig instance
        """
        return cls(
            initial_capital=data.get("initial_capital", DEFAULT_INITIAL_CAPITAL),
            order_size_value=data.get("order_size_value", DEFAULT_ORDER_SIZE),
            order_size_unit=data.get("order_size_unit", DEFAULT_ORDER_UNIT),
            commission_rate=data.get("commission_rate", DEFAULT_COMMISSION_RATE),
            slippage_rate=data.get("slippage_rate", DEFAULT_SLIPPAGE_RATE),
            leverage=data.get("leverage", 1),
            allow_short=data.get("allow_short", True),
            task_id=data.get("task_id"),
            user_id=data.get("user_id"),
            benchmark=data.get("benchmark"),
        )

    @classmethod
    def create_default(cls) -> "BacktestConfig":
        """Create default configuration for testing."""
        return cls()

    def apply_to_cerebro(self, cerebro) -> None:
        """
        Apply configuration to Backtrader Cerebro instance.

        Args:
            cerebro: backtrader.Cerebro instance
        """
        cerebro.broker.setcash(self.initial_capital)
        cerebro.broker.setcommission(commission=self.commission_rate)
        cerebro.broker.set_slippage_perc(self.slippage_rate)

        logger.info(
            f"Config applied to Cerebro: initial_capital={self.initial_capital}, "
            f"commission={self.commission_rate}, slippage={self.slippage_rate}"
        )

    def inject_to_strategy_params(self, params: Dict[str, Any]) -> None:
        """
        Inject configuration into strategy parameters.

        Args:
            params: Strategy parameters dictionary
        """
        params["order_size_value"] = self.order_size_value
        params["order_size_unit"] = self.order_size_unit
        params["initial_capital"] = self.initial_capital

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "initial_capital": self.initial_capital,
            "order_size_value": self.order_size_value,
            "order_size_unit": self.order_size_unit,
            "commission_rate": self.commission_rate,
            "slippage_rate": self.slippage_rate,
            "leverage": self.leverage,
            "allow_short": self.allow_short,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "benchmark": self.benchmark,
        }

    def __repr__(self) -> str:
        return (
            f"BacktestConfig("
            f"initial_capital={self.initial_capital}, "
            f"order_size={self.order_size_value} {self.order_size_unit}, "
            f"commission={self.commission_rate}, "
            f"task_id={self.task_id})"
        )
