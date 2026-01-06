"""
LLMTriggerEstimator - LLM Trigger Count Estimation (Dry Run Mode)

Estimates the number of LLM calls a strategy will make during backtest.
Based on nona_server's llm_trigger_estimator.py pattern.

Features:
1. Dry Run mode - runs precondition logic without LLM calls
2. Counts trigger occurrences
3. Estimates execution time and cost
4. Records trigger bar positions

Usage:
    estimator = LLMTriggerEstimator()
    result = estimator.estimate(strategy_class, data_feed)
    print(f"Triggers: {result.trigger_count}, Time: {result.estimated_time_seconds}s")
"""

import logging
from typing import Type, List, Optional, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

try:
    import backtrader as bt
except ImportError:
    bt = None

logger = logging.getLogger(__name__)


class WarningLevel(Enum):
    """Warning level based on trigger rate."""
    NORMAL = "normal"      # 0-10%
    MEDIUM = "medium"      # 10-30%
    HIGH = "high"          # 30-50%
    CRITICAL = "critical"  # 50%+


@dataclass
class EstimationResult:
    """
    LLM trigger estimation result.

    Attributes:
        total_bars: Total number of bars in the data
        trigger_count: Number of times LLM would be triggered
        trigger_rate: Ratio of triggers to total bars
        estimated_time_seconds: Estimated execution time
        estimated_cost: Estimated cost (based on cost_per_call)
        warning_level: Risk level based on trigger rate
        trigger_bars: List of bar indices where triggers occur
    """
    total_bars: int
    trigger_count: int
    trigger_rate: float
    estimated_time_seconds: int
    estimated_cost: float = 0.0
    warning_level: WarningLevel = WarningLevel.NORMAL
    trigger_bars: List[int] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_bars": self.total_bars,
            "trigger_count": self.trigger_count,
            "trigger_rate": round(self.trigger_rate, 4),
            "estimated_time_seconds": self.estimated_time_seconds,
            "estimated_cost": round(self.estimated_cost, 2),
            "warning_level": self.warning_level.value,
            "trigger_bars_sample": self.trigger_bars[:10],  # First 10 for preview
            "trigger_bars_count": len(self.trigger_bars),
        }


class LLMTriggerEstimator:
    """
    LLM Trigger Count Estimator - Dry Run Mode.

    Runs strategy precondition logic to count how many times
    LLM would be triggered, without actually calling the LLM.

    Design features:
    - 100% accurate count (matches actual execution)
    - Zero LLM cost
    - Records trigger positions for analysis
    - Provides time and cost estimates
    """

    # Default LLM call duration (seconds)
    DEFAULT_LLM_CALL_DURATION = 15

    # Default cost per LLM call (USD)
    DEFAULT_COST_PER_CALL = 0.01

    # Warning level thresholds (trigger rate)
    WARNING_THRESHOLDS = {
        WarningLevel.NORMAL: 0.10,    # 0-10%
        WarningLevel.MEDIUM: 0.30,    # 10-30%
        WarningLevel.HIGH: 0.50,      # 30-50%
        WarningLevel.CRITICAL: 1.0,   # 50%+
    }

    def __init__(
        self,
        llm_call_duration: int = None,
        cost_per_call: float = None,
    ):
        """
        Initialize estimator.

        Args:
            llm_call_duration: Estimated time per LLM call (seconds)
            cost_per_call: Estimated cost per LLM call (USD)
        """
        if bt is None:
            raise ImportError("Backtrader is required. Install with: pip install backtrader")

        self.llm_call_duration = llm_call_duration or self.DEFAULT_LLM_CALL_DURATION
        self.cost_per_call = cost_per_call or self.DEFAULT_COST_PER_CALL

        logger.info(
            f"LLMTriggerEstimator initialized: "
            f"llm_call_duration={self.llm_call_duration}s, "
            f"cost_per_call=${self.cost_per_call}"
        )

    def estimate(
        self,
        strategy_class: Type,
        data_feed: "bt.feeds.PandasData",
        strategy_params: Optional[Dict[str, Any]] = None,
        signal_checker: Optional[Callable] = None,
    ) -> EstimationResult:
        """
        Run Dry Run estimation using a strategy class.

        Args:
            strategy_class: Strategy class with check_signal method
            data_feed: Backtrader data feed
            strategy_params: Strategy initialization parameters
            signal_checker: Optional custom signal check function

        Returns:
            EstimationResult with trigger count and estimates
        """
        strategy_params = strategy_params or {}
        trigger_bars = []

        logger.info(f"Starting Dry Run: strategy={strategy_class.__name__}")

        # Create counting wrapper
        class CountingWrapper(strategy_class):
            """Wrapper that counts signal triggers without execution."""

            def next(wrapper_self):
                """Check signal on each bar."""
                try:
                    triggered = False

                    # Try custom signal checker first
                    if signal_checker:
                        triggered = signal_checker(wrapper_self)

                    # Try check_signal method
                    elif hasattr(wrapper_self, "check_signal"):
                        result = wrapper_self.check_signal()
                        if result and result.get("signal_triggered", False):
                            triggered = True

                    # Try should_trigger method
                    elif hasattr(wrapper_self, "should_trigger"):
                        triggered = wrapper_self.should_trigger()

                    # Fallback: check if strategy would place order
                    elif hasattr(wrapper_self, "get_signal"):
                        signal = wrapper_self.get_signal()
                        triggered = signal is not None and signal != 0

                    if triggered:
                        bar_idx = len(wrapper_self.data)
                        trigger_bars.append(bar_idx)

                except Exception as e:
                    logger.warning(
                        f"Dry Run check error at bar {len(wrapper_self.data)}: {e}"
                    )

        # Create minimal cerebro for dry run
        cerebro = bt.Cerebro()
        cerebro.adddata(data_feed)
        cerebro.addstrategy(CountingWrapper, **strategy_params)

        # Minimal broker config (no actual trading)
        cerebro.broker.setcash(100000)
        cerebro.broker.setcommission(commission=0)

        # Run dry run
        try:
            cerebro.run()
        except Exception as e:
            logger.error(f"Dry Run execution failed: {e}")
            raise

        # Calculate results
        total_bars = len(data_feed)
        trigger_count = len(trigger_bars)
        trigger_rate = trigger_count / total_bars if total_bars > 0 else 0

        result = EstimationResult(
            total_bars=total_bars,
            trigger_count=trigger_count,
            trigger_rate=trigger_rate,
            estimated_time_seconds=int(trigger_count * self.llm_call_duration),
            estimated_cost=trigger_count * self.cost_per_call,
            warning_level=self._calculate_warning_level(trigger_rate),
            trigger_bars=trigger_bars,
        )

        logger.info(
            f"Dry Run complete: triggers={trigger_count}/{total_bars} "
            f"({trigger_rate:.1%}), warning={result.warning_level.value}"
        )

        return result

    def estimate_from_signals(
        self,
        signals: List[bool],
    ) -> EstimationResult:
        """
        Estimate from a pre-computed signal list.

        Args:
            signals: List of boolean signals (True = trigger)

        Returns:
            EstimationResult with trigger count and estimates
        """
        trigger_bars = [i for i, s in enumerate(signals) if s]
        total_bars = len(signals)
        trigger_count = len(trigger_bars)
        trigger_rate = trigger_count / total_bars if total_bars > 0 else 0

        return EstimationResult(
            total_bars=total_bars,
            trigger_count=trigger_count,
            trigger_rate=trigger_rate,
            estimated_time_seconds=int(trigger_count * self.llm_call_duration),
            estimated_cost=trigger_count * self.cost_per_call,
            warning_level=self._calculate_warning_level(trigger_rate),
            trigger_bars=trigger_bars,
        )

    def _calculate_warning_level(self, trigger_rate: float) -> WarningLevel:
        """Calculate warning level based on trigger rate."""
        if trigger_rate <= self.WARNING_THRESHOLDS[WarningLevel.NORMAL]:
            return WarningLevel.NORMAL
        elif trigger_rate <= self.WARNING_THRESHOLDS[WarningLevel.MEDIUM]:
            return WarningLevel.MEDIUM
        elif trigger_rate <= self.WARNING_THRESHOLDS[WarningLevel.HIGH]:
            return WarningLevel.HIGH
        else:
            return WarningLevel.CRITICAL

    def format_estimate(self, result: EstimationResult) -> str:
        """
        Format estimation result as human-readable string.

        Args:
            result: EstimationResult to format

        Returns:
            Formatted string
        """
        hours = result.estimated_time_seconds // 3600
        minutes = (result.estimated_time_seconds % 3600) // 60
        seconds = result.estimated_time_seconds % 60

        time_str = ""
        if hours > 0:
            time_str += f"{hours}h "
        if minutes > 0 or hours > 0:
            time_str += f"{minutes}m "
        time_str += f"{seconds}s"

        return (
            f"LLM Trigger Estimation:\n"
            f"  Total Bars: {result.total_bars}\n"
            f"  Trigger Count: {result.trigger_count}\n"
            f"  Trigger Rate: {result.trigger_rate:.2%}\n"
            f"  Estimated Time: {time_str.strip()}\n"
            f"  Estimated Cost: ${result.estimated_cost:.2f}\n"
            f"  Warning Level: {result.warning_level.value.upper()}"
        )
