"""
Workflow Signal Source

TICKET_264: Execute exported Workflow as a Signal Source in Quant Lab.

Handles multi-timeframe data requirements and component orchestration
for workflows exported from Strategy Builder.
"""

import numpy as np
from typing import Any, Dict, Optional, Set
from dataclasses import dataclass

from .base import SignalSourceBase


@dataclass
class ComponentConfig:
    """Single component configuration with timeframe."""
    algorithm_id: str
    algorithm_name: str
    algorithm_code: str
    base_class: str
    timeframe: str
    parameters: Dict[str, Any]


@dataclass
class BacktestMetrics:
    """Backtest performance metrics for reference."""
    sharpe: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    profit_factor: Optional[float] = None


@dataclass
class ExportedWorkflowConfig:
    """
    Configuration for an exported workflow from Strategy Builder.

    Contains all components (Analysis + Entry + Exit) with their timeframes.
    """
    id: str
    name: str
    description: str

    # Components
    analysis: ComponentConfig
    entry: ComponentConfig
    exit: Optional[ComponentConfig] = None

    # Metrics
    backtest_metrics: Optional[BacktestMetrics] = None

    # Original config
    symbol: str = ""
    date_range_start: str = ""
    date_range_end: str = ""


class WorkflowSignalSource(SignalSourceBase):
    """
    Execute exported Workflow as a Signal Source.

    This class wraps a workflow exported from Strategy Builder and
    executes it to produce signals compatible with the Alpha Factory.

    The workflow consists of:
    1. Analysis component (e.g., RegimeStateBase) - determines market state
    2. Entry component (e.g., RegimeTrendEntryBase) - generates entry signals
    3. Exit component (optional) - generates exit signals

    Note: Currently operates on single timeframe. Multi-timeframe support
    requires data feed integration at the Alpha Factory level.
    """

    def __init__(self, config: ExportedWorkflowConfig, **kwargs):
        """
        Initialize workflow signal source.

        Args:
            config: Exported workflow configuration
            **kwargs: Additional arguments passed to SignalSourceBase
        """
        super().__init__(name=config.name, **kwargs)
        self.config = config
        self.source_id = config.id

        # Required timeframes for multi-timeframe execution
        self._required_timeframes: Set[str] = set()
        self._required_timeframes.add(config.analysis.timeframe)
        self._required_timeframes.add(config.entry.timeframe)
        if config.exit:
            self._required_timeframes.add(config.exit.timeframe)

        # Compiled strategy instances (lazy initialization)
        self._analysis_strategy = None
        self._entry_strategy = None
        self._exit_strategy = None
        self._state_manager = None
        self._initialized = False

        # Track warmup based on components
        self._warmup = 50  # Default warmup period

    @property
    def warmup_period(self) -> int:
        """Number of bars needed before valid signals."""
        return self._warmup

    def required_timeframes(self) -> Set[str]:
        """
        Get all timeframes required by this workflow.

        Returns:
            Set of timeframe strings, e.g., {'1d', '1h'}
        """
        return self._required_timeframes

    def _initialize_components(self) -> None:
        """Initialize component strategies (lazy)."""
        if self._initialized:
            return

        try:
            # Create shared state manager
            from framework import StateManager
            self._state_manager = StateManager()

            # Compile each component
            self._analysis_strategy = self._compile_component(self.config.analysis)
            self._entry_strategy = self._compile_component(self.config.entry)
            if self.config.exit:
                self._exit_strategy = self._compile_component(self.config.exit)

            self._initialized = True
        except ImportError:
            # Framework not available - run in degraded mode
            self._initialized = True

    def _compile_component(self, component: ComponentConfig) -> Optional[Any]:
        """
        Compile algorithm code and create strategy instance.

        Args:
            component: Component configuration with code

        Returns:
            Compiled strategy instance or None if compilation fails
        """
        if not component or not component.algorithm_code:
            return None

        try:
            # Create execution namespace
            namespace = {'__builtins__': __builtins__}

            # Import framework classes
            try:
                from framework import (
                    MarketState,
                    RegimeStateBase,
                    RegimeTrendEntryBase,
                    RegimeRangeEntryBase,
                    RegimeStandaloneEntryBase,
                    KronosStateBase,
                    KronosEntryBase,
                    ExitSignalBase,
                    StateManager,
                )
                namespace.update({
                    'MarketState': MarketState,
                    'RegimeStateBase': RegimeStateBase,
                    'RegimeTrendEntryBase': RegimeTrendEntryBase,
                    'RegimeRangeEntryBase': RegimeRangeEntryBase,
                    'RegimeStandaloneEntryBase': RegimeStandaloneEntryBase,
                    'KronosStateBase': KronosStateBase,
                    'KronosEntryBase': KronosEntryBase,
                    'ExitSignalBase': ExitSignalBase,
                    'StateManager': StateManager,
                })
            except ImportError:
                pass

            # Import numpy for indicator calculations
            import numpy as np
            namespace['np'] = np

            # Execute algorithm code
            exec(component.algorithm_code, namespace)

            # Find strategy class
            strategy_class = None
            base_class_name = component.base_class
            for name, obj in namespace.items():
                if isinstance(obj, type) and name != base_class_name:
                    base_obj = namespace.get(base_class_name)
                    if base_obj and issubclass(obj, base_obj):
                        strategy_class = obj
                        break

            if strategy_class:
                instance = strategy_class()
                instance._state_manager = self._state_manager
                instance._params = component.parameters
                return instance

        except Exception as e:
            print(f"[WorkflowSignalSource] Failed to compile {component.algorithm_name}: {e}")

        return None

    def compute(
        self,
        open_prices: np.ndarray,
        high_prices: np.ndarray,
        low_prices: np.ndarray,
        close_prices: np.ndarray,
        volume: np.ndarray
    ) -> np.ndarray:
        """
        Compute signal values from workflow execution.

        This method runs the workflow components in sequence:
        1. Analysis (detect market regime)
        2. Entry (check entry conditions based on regime)
        3. Exit (optional, check exit conditions)

        Args:
            open_prices: Open prices array
            high_prices: High prices array
            low_prices: Low prices array
            close_prices: Close prices array
            volume: Volume array

        Returns:
            signal: Signal array, values in [-1, 1]
        """
        n = len(close_prices)
        signal = np.zeros(n)

        # Initialize components if needed
        self._initialize_components()

        # If components not available, return zeros
        if not self._analysis_strategy or not self._entry_strategy:
            return signal

        # Create data dict for components
        data = {
            'open': open_prices,
            'high': high_prices,
            'low': low_prices,
            'close': close_prices,
            'volume': volume,
        }

        # Process each bar
        for i in range(self._warmup, n):
            try:
                # Provide bar slice to components
                bar_data = {
                    'open': open_prices[:i+1],
                    'high': high_prices[:i+1],
                    'low': low_prices[:i+1],
                    'close': close_prices[:i+1],
                    'volume': volume[:i+1],
                }

                # 1. Run Analysis component
                analysis_result = self._run_analysis(bar_data, i)

                # 2. Check regime - if not trending, skip
                is_trending = analysis_result.get('is_trending', False)
                if not is_trending:
                    signal[i] = 0.0
                    continue

                # 3. Run Entry component
                entry_result = self._run_entry(bar_data, i)

                # 4. Check Exit (if exists)
                if self._exit_strategy:
                    exit_result = self._run_exit(bar_data, i)
                    if exit_result.get('should_exit', False):
                        signal[i] = 0.0
                        continue

                # 5. Convert to signal
                confidence = entry_result.get('confidence', 0.5)
                trend_strength = analysis_result.get('trend_strength', 0.5)

                if entry_result.get('entry_long', False):
                    signal[i] = trend_strength * confidence
                elif entry_result.get('entry_short', False):
                    signal[i] = -trend_strength * confidence
                else:
                    signal[i] = 0.0

            except Exception as e:
                # On error, produce neutral signal
                signal[i] = 0.0

        return np.clip(signal, -1, 1)

    def _run_analysis(self, data: Dict[str, np.ndarray], bar_index: int) -> Dict[str, Any]:
        """Run analysis component and return result."""
        if not self._analysis_strategy:
            return {}

        try:
            self._analysis_strategy._data = data
            self._analysis_strategy._bar_index = bar_index

            if hasattr(self._analysis_strategy, 'detect_market_state'):
                result = self._analysis_strategy.detect_market_state()
                # Result is typically (MarketState, trend_score, range_score)
                if isinstance(result, tuple) and len(result) >= 2:
                    from framework import MarketState
                    state, trend_score = result[0], result[1]
                    is_trending = state == MarketState.TREND if hasattr(state, 'name') else False
                    return {
                        'is_trending': is_trending,
                        'trend_strength': trend_score,
                    }
        except Exception:
            pass

        return {'is_trending': False, 'trend_strength': 0.0}

    def _run_entry(self, data: Dict[str, np.ndarray], bar_index: int) -> Dict[str, Any]:
        """Run entry component and return result."""
        if not self._entry_strategy:
            return {}

        try:
            self._entry_strategy._data = data
            self._entry_strategy._bar_index = bar_index

            if hasattr(self._entry_strategy, 'check_open_conditions'):
                result = self._entry_strategy.check_open_conditions()
                # Result is typically (entry_long, entry_short)
                if isinstance(result, tuple) and len(result) >= 2:
                    return {
                        'entry_long': result[0],
                        'entry_short': result[1],
                        'confidence': 0.8,  # Default confidence
                    }
        except Exception:
            pass

        return {'entry_long': False, 'entry_short': False, 'confidence': 0.0}

    def _run_exit(self, data: Dict[str, np.ndarray], bar_index: int) -> Dict[str, Any]:
        """Run exit component and return result."""
        if not self._exit_strategy:
            return {}

        try:
            self._exit_strategy._data = data
            self._exit_strategy._bar_index = bar_index

            if hasattr(self._exit_strategy, 'check_exit_signal'):
                result = self._exit_strategy.check_exit_signal()
                return {'should_exit': bool(result)}
        except Exception:
            pass

        return {'should_exit': False}
