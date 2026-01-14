"""
Strategy Executor

Ported from: nona_server/src/backtest/backtest_workflow_tools.py (ParallelBacktestExecutor)

Executes backtest strategies using Backtrader Cerebro engine.
Manages Cerebro instances and strategy execution lifecycle.
"""

import logging
from typing import Dict, List, Optional, Callable, Any
import backtrader as bt

logger = logging.getLogger(__name__)

# Constants
MIN_DATA_LENGTH = 10  # Minimum data points required


class StrategyExecutor:
    """
    Strategy executor for backtest.

    Port from: server's ParallelBacktestExecutor

    Manages Cerebro instances and executes backtest strategies.

    Usage:
        >>> executor = StrategyExecutor(
        ...     data_feeds={"1h": df_data},
        ...     test_suites=[suite1, suite2]
        ... )
        >>> executor.prepare()
        >>> results = executor.run()
    """

    def __init__(
        self,
        data_feeds: Dict,
        test_suites: List[Dict],
        data_type: str = "forex",
        user_id: Optional[int] = None,
        task_id: Optional[str] = None,
        on_progress: Optional[Callable] = None,
    ):
        """
        Initialize strategy executor.

        Args:
            data_feeds: Dictionary of {timeframe: DataFrame}
            test_suites: List of test suite dictionaries
            data_type: Data type ("forex" or "stock")
            user_id: User ID (optional, for tracking)
            task_id: Task ID (optional, for tracking)
            on_progress: Progress callback function (optional)
        """
        self.data_feeds = data_feeds
        self.test_suites = test_suites
        self.data_type = data_type
        self.user_id = user_id
        self.task_id = task_id
        self.on_progress = on_progress

        self.cerebro_instances: List[bt.Cerebro] = []
        self.results: List[Any] = []

        logger.info(
            f"StrategyExecutor initialized: {len(test_suites)} test suite(s), "
            f"{len(data_feeds)} timeframe(s)"
        )

    def prepare(self) -> None:
        """
        Prepare Cerebro instances for execution.

        Port from: ParallelBacktestExecutor.prepare_instances()

        Creates Cerebro instances for each test suite and configures:
        - Data feeds
        - Initial capital
        - Analyzers
        - Observers
        """
        logger.info(f"Preparing {len(self.test_suites)} Cerebro instance(s)")

        for suite_index, suite in enumerate(self.test_suites):
            try:
                cerebro = self._create_cerebro_instance(suite, suite_index)
                if cerebro:
                    self.cerebro_instances.append(cerebro)
            except Exception as e:
                logger.error(
                    f"Error creating Cerebro instance for suite {suite_index}: {e}"
                )
                # Continue with other suites

        logger.info(
            f"Prepared {len(self.cerebro_instances)} Cerebro instance(s) successfully"
        )

    def _create_cerebro_instance(
        self, suite: Dict, suite_index: int
    ) -> Optional[bt.Cerebro]:
        """
        Create a Cerebro instance for a test suite.

        Args:
            suite: Test suite dictionary
            suite_index: Suite index (for logging)

        Returns:
            bt.Cerebro: Configured Cerebro instance or None if failed
        """
        cerebro = bt.Cerebro()

        # Add data feeds
        data_added = self._add_data_feeds(cerebro)
        if not data_added:
            logger.warning(f"Suite {suite_index}: No valid data feeds added, skipping")
            return None

        # Set initial capital
        initial_cash = suite.get("initial_cash", 100000.0)
        cerebro.broker.setcash(initial_cash)

        # Add analyzers
        cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trade_analyzer")
        cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe_ratio")
        cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
        cerebro.addanalyzer(bt.analyzers.Returns, _name="returns")

        # Add observers
        cerebro.addobserver(bt.observers.BuySell)
        cerebro.addobserver(bt.observers.Value)

        # Add strategies from suite
        strategies_added = self._add_strategies(cerebro, suite, suite_index)
        if not strategies_added:
            logger.warning(f"Suite {suite_index}: No strategies added, skipping")
            return None

        logger.debug(
            f"Suite {suite_index}: Cerebro created with initial_cash={initial_cash}, "
            f"strategies={strategies_added}"
        )

        return cerebro

    def _add_strategies(
        self, cerebro: bt.Cerebro, suite: Dict, suite_index: int
    ) -> int:
        """
        Add strategies to Cerebro instance from test suite.

        Port from: ParallelBacktestExecutor.prepare_instances() (lines 256-568)

        Args:
            cerebro: Cerebro instance
            suite: Test suite dictionary
            suite_index: Suite index (for logging)

        Returns:
            int: Number of strategies added
        """
        strategy_configs = suite.get("strategy_configs", {})
        execution_order = suite.get("execution_order", [])

        if not strategy_configs:
            logger.warning(f"Suite {suite_index}: No strategy configs found")
            return 0

        # Filter out empty phases
        valid_phases = [
            phase
            for phase in execution_order
            if strategy_configs.get(phase) is not None
        ]

        if not valid_phases:
            logger.warning(f"Suite {suite_index}: No valid phases found")
            return 0

        logger.debug(
            f"Suite {suite_index}: Adding {len(valid_phases)} strategies: {valid_phases}"
        )

        # Import StrategyLoader
        from .strategy_loader import StrategyLoader, create_strategy_from_config

        strategy_loader = StrategyLoader()
        strategies_added = 0

        for phase in valid_phases:
            strategy_config = strategy_configs[phase]

            try:
                # Create strategy class from config
                strategy_class = create_strategy_from_config(
                    strategy_config=strategy_config,
                    strategy_loader=strategy_loader
                )

                # Add strategy to cerebro
                # Note: Desktop version uses simplified interface
                # Server passes strategy_group, state_manager, etc.
                # Desktop just passes the strategy class directly
                cerebro.addstrategy(strategy_class)

                strategies_added += 1
                logger.debug(
                    f"Suite {suite_index}: Added strategy {strategy_class.__name__} "
                    f"for phase '{phase}'"
                )

            except Exception as e:
                logger.error(
                    f"Suite {suite_index}: Error adding strategy for phase '{phase}': {e}",
                    exc_info=True
                )
                # Continue with other strategies

        logger.info(
            f"Suite {suite_index}: Added {strategies_added}/{len(valid_phases)} strategies"
        )

        return strategies_added

    def _add_data_feeds(self, cerebro: bt.Cerebro) -> bool:
        """
        Add data feeds to Cerebro instance.

        Args:
            cerebro: Cerebro instance

        Returns:
            bool: True if at least one feed was added
        """
        # Validate and sort data feeds
        valid_feeds = []
        for timeframe, data in self.data_feeds.items():
            if (
                hasattr(data, "empty")
                and not data.empty
                and len(data) >= MIN_DATA_LENGTH
            ):
                valid_feeds.append((timeframe, data))

        if not valid_feeds:
            logger.warning("No valid data feeds available")
            return False

        # Sort by timeframe (shortest first)
        valid_feeds.sort(key=lambda item: self._get_timeframe_seconds(item[0]))

        # Add primary feed (shortest timeframe)
        primary_timeframe, primary_data = valid_feeds[0]

        try:
            # Import DataFeed class
            from ..data.provider import DataProvider

            # Create data feed
            # TODO: This needs proper DataFeed implementation
            # For now, use Backtrader's built-in PandasData
            data_feed = bt.feeds.PandasData(dataname=primary_data)
            cerebro.adddata(data_feed)

            logger.debug(f"Added primary data feed: {primary_timeframe}")

            # TODO: Add resampled feeds for additional timeframes
            # This requires implementing resampledata() logic

            return True

        except Exception as e:
            logger.error(f"Error adding data feeds: {e}")
            return False

    def _get_timeframe_seconds(self, timeframe: str) -> int:
        """
        Get seconds for timeframe string.

        Args:
            timeframe: Timeframe string (e.g., "1m", "1h", "1d")

        Returns:
            int: Seconds
        """
        timeframe_map = {
            "tick": 1,
            "1m": 60,
            "5m": 300,
            "15m": 900,
            "30m": 1800,
            "1h": 3600,
            "4h": 14400,
            "1d": 86400,
            "1w": 604800,
        }
        return timeframe_map.get(timeframe, 86400)  # Default to 1d

    def run(self) -> List[Any]:
        """
        Execute all Cerebro instances.

        Port from: ParallelBacktestExecutor.run()

        Returns:
            list: List of backtest results

        Example:
            >>> executor = StrategyExecutor(...)
            >>> executor.prepare()
            >>> results = executor.run()
            >>> print(len(results))
        """
        if not self.cerebro_instances:
            logger.warning("No Cerebro instances to run")
            return []

        logger.info(f"Executing {len(self.cerebro_instances)} backtest(s)")

        for i, cerebro in enumerate(self.cerebro_instances):
            logger.info(f"Running backtest {i+1}/{len(self.cerebro_instances)}")

            # Notify progress
            if self.on_progress:
                progress = i / len(self.cerebro_instances)
                self.on_progress(progress, f"Running backtest {i+1}")

            try:
                # Run backtest
                result = cerebro.run()
                self.results.append(result)

                # Log result summary
                final_value = cerebro.broker.getvalue()
                logger.info(
                    f"Backtest {i+1} completed: final_value={final_value:.2f}"
                )

            except Exception as e:
                logger.error(f"Error running backtest {i+1}: {e}")
                self.results.append(None)

        # Final progress
        if self.on_progress:
            self.on_progress(1.0, "All backtests completed")

        logger.info(f"All backtests completed: {len(self.results)} result(s)")
        return self.results

    def get_results_summary(self) -> List[Dict]:
        """
        Get summary of backtest results.

        Returns:
            list: List of result summary dictionaries

        Example:
            >>> executor.run()
            >>> summaries = executor.get_results_summary()
            >>> print(summaries[0]['final_value'])
        """
        summaries = []

        for i, (cerebro, result) in enumerate(zip(self.cerebro_instances, self.results)):
            if result is None:
                summaries.append({
                    "index": i,
                    "status": "failed",
                    "error": "Execution failed",
                })
                continue

            try:
                # Get strategy instance (first one)
                strat = result[0] if result else None

                # Get final value
                final_value = cerebro.broker.getvalue()

                # Get initial value from suite
                suite = self.test_suites[i] if i < len(self.test_suites) else {}
                initial_value = suite.get("initial_cash", 100000.0)

                # Calculate returns
                returns = ((final_value - initial_value) / initial_value) * 100

                # Get analyzer results
                trade_analyzer = None
                if strat and hasattr(strat, "analyzers"):
                    trade_analyzer = strat.analyzers.trade_analyzer.get_analysis()

                summary = {
                    "index": i,
                    "status": "completed",
                    "initial_value": initial_value,
                    "final_value": final_value,
                    "returns": returns,
                    "trade_analysis": trade_analyzer,
                }

                summaries.append(summary)

            except Exception as e:
                logger.error(f"Error creating summary for result {i}: {e}")
                summaries.append({
                    "index": i,
                    "status": "error",
                    "error": str(e),
                })

        return summaries

    def cleanup(self) -> None:
        """Cleanup resources."""
        self.cerebro_instances.clear()
        self.results.clear()
        logger.debug("Executor cleaned up")
