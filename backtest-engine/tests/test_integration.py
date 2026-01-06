"""
Integration tests for Backtest Engine Plugin.

Tests all components working together without requiring Core engine.
"""

import unittest
import tempfile
import os
import sys
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import BacktestConfig
from src.account import BacktestAccountManager, TradeRecord
from src.workflow import BacktestWorkflow, WorkflowContext, WorkflowState, WorkflowBuilder
from src.checkpoint import CheckpointManager, CheckpointConfig, CheckpointData
from src.estimator import LLMTriggerEstimator, EstimationResult, WarningLevel
from src.strategy import (
    StrategyPhases,
    StrategyStateManager,
    StrategyGroup,
    TestCase,
    STANDARD_PHASES,
)
from src.data import (
    DataProviderManager,
    MockDataProvider,
    TimeRange,
    create_default_provider_manager,
)
from src.lifecycle import PluginLifecycleManager, PluginConfig, PluginState


class TestBacktestConfig(unittest.TestCase):
    """Test BacktestConfig component."""

    def test_default_config(self):
        config = BacktestConfig()
        self.assertEqual(config.initial_capital, 100000.0)
        self.assertEqual(config.commission_rate, 0.001)
        self.assertEqual(config.slippage_rate, 0.0005)

    def test_config_validation(self):
        config = BacktestConfig(initial_capital=50000.0)
        # Validation runs in __post_init__, no error means valid
        self.assertEqual(config.initial_capital, 50000.0)

    def test_config_with_leverage(self):
        config = BacktestConfig(leverage=5)
        self.assertEqual(config.leverage, 5)
        self.assertTrue(config.allow_short)

    def test_config_to_dict(self):
        config = BacktestConfig()
        d = config.to_dict()
        self.assertIn("initial_capital", d)
        self.assertIn("commission_rate", d)


class TestBacktestAccountManager(unittest.TestCase):
    """Test BacktestAccountManager component."""

    def test_initial_state(self):
        account = BacktestAccountManager(
            task_id="test-001",
            user_id="user-001",
            initial_cash=100000.0,
        )
        self.assertEqual(account.initial_cash, 100000.0)
        self.assertEqual(len(account.trades), 0)
        self.assertEqual(len(account.equity_curve), 0)

    def test_record_trade(self):
        account = BacktestAccountManager(
            task_id="test-002",
            user_id="user-001",
            initial_cash=100000.0,
        )
        trade = TradeRecord(
            trade_id="t1",
            symbol="BTCUSDT",
            side="buy",
            quantity=1.0,
            entry_price=50000.0,
            exit_price=51000.0,
            pnl=1000.0,
            commission=50.0,
            entry_time=datetime.now(),
            exit_time=datetime.now(),
        )
        account.record_trade(trade)
        self.assertEqual(len(account.trades), 1)
        self.assertEqual(account.trades[0].symbol, "BTCUSDT")

    def test_get_metrics(self):
        account = BacktestAccountManager(
            task_id="test-003",
            user_id="user-001",
            initial_cash=100000.0,
        )
        metrics = account.get_metrics()
        self.assertIn("total_return", metrics)
        self.assertIn("total_trades", metrics)
        self.assertEqual(metrics["total_trades"], 0)


class TestDataProvider(unittest.TestCase):
    """Test DataProvider components."""

    def test_mock_provider(self):
        provider = MockDataProvider(seed=42)
        time_range = TimeRange.last_days(30)
        data = provider.get_data("BTCUSDT", time_range)

        self.assertIsNotNone(data)
        self.assertEqual(data.symbol, "BTCUSDT")
        self.assertGreater(data.bar_count, 0)

    def test_provider_manager(self):
        manager = create_default_provider_manager()
        time_range = TimeRange.last_days(10)
        data = manager.get_data("ETHUSDT", time_range)

        self.assertIsNotNone(data)
        self.assertEqual(data.symbol, "ETHUSDT")

    def test_multiple_symbols(self):
        manager = create_default_provider_manager()
        time_range = TimeRange.last_days(5)
        data = manager.get_multiple(["BTCUSDT", "ETHUSDT"], time_range)

        self.assertEqual(len(data), 2)
        self.assertIn("BTCUSDT", data)
        self.assertIn("ETHUSDT", data)


class TestCheckpointManager(unittest.TestCase):
    """Test CheckpointManager component."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config = CheckpointConfig(
            enabled=True,
            interval=10,
        )

    def test_checkpoint_manager_init(self):
        manager = CheckpointManager(self.config)
        self.assertTrue(manager.config.enabled)
        self.assertEqual(manager.config.interval, 10)

    def test_should_save(self):
        manager = CheckpointManager(self.config)
        # Bar 0 should not save
        self.assertFalse(manager.should_save(0))
        # Bar 10 should save
        self.assertTrue(manager.should_save(10))
        # Bar 11 should not save
        self.assertFalse(manager.should_save(11))
        # Bar 20 should save
        self.assertTrue(manager.should_save(20))


class TestLLMTriggerEstimator(unittest.TestCase):
    """Test LLMTriggerEstimator component."""

    def test_estimator_init(self):
        estimator = LLMTriggerEstimator()
        self.assertEqual(estimator.llm_call_duration, 15)
        self.assertEqual(estimator.cost_per_call, 0.01)

    def test_estimate_from_signals(self):
        estimator = LLMTriggerEstimator()
        # 100 signals, 10 triggers
        signals = [False] * 90 + [True] * 10
        result = estimator.estimate_from_signals(signals)

        self.assertEqual(result.total_bars, 100)
        self.assertEqual(result.trigger_count, 10)
        self.assertEqual(result.trigger_rate, 0.10)
        self.assertEqual(result.warning_level, WarningLevel.NORMAL)

    def test_warning_levels(self):
        estimator = LLMTriggerEstimator()

        # Low rate - normal
        low_signals = [True if i % 20 == 0 else False for i in range(100)]
        low_result = estimator.estimate_from_signals(low_signals)
        self.assertEqual(low_result.warning_level, WarningLevel.NORMAL)

        # High rate - should warn
        high_signals = [True] * 60 + [False] * 40  # 60% trigger rate
        high_result = estimator.estimate_from_signals(high_signals)
        self.assertEqual(high_result.warning_level, WarningLevel.CRITICAL)


class TestStrategyPhases(unittest.TestCase):
    """Test Strategy Phase components."""

    def test_phase_constants(self):
        self.assertEqual(StrategyPhases.ANALYSIS, "analysis")
        self.assertEqual(StrategyPhases.EXECUTION, "execution")
        self.assertEqual(len(STANDARD_PHASES), 4)

    def test_state_manager(self):
        manager = StrategyStateManager()

        # Set analysis result
        manager.set_analysis_result({"signal": "long", "confidence": 0.85})
        analysis = manager.get_analysis_result()
        self.assertEqual(analysis["signal"], "long")

        # Set precondition with signal_triggered
        manager.set_precondition_result({
            "signal_triggered": True,
            "checks": ["volume", "trend"],
        })
        self.assertTrue(manager.is_signal_triggered())

    def test_strategy_group(self):
        state_manager = StrategyStateManager()
        group = StrategyGroup(state_manager=state_manager)
        test_case = TestCase(
            case_id="case-001",
            analysis="ma_crossover",
            execution="market_order",
        )

        order = group.get_execution_order(test_case)
        self.assertIn("analysis", order)
        self.assertIn("execution", order)


class TestPluginLifecycle(unittest.TestCase):
    """Test PluginLifecycleManager component."""

    def test_lifecycle_initialization(self):
        config = PluginConfig(
            plugin_id="test.plugin",
            name="Test Plugin",
            version="1.0.0",
            grpc_port=50099,
        )
        manager = PluginLifecycleManager(config)

        self.assertEqual(manager.state, PluginState.STARTING)
        self.assertFalse(manager.registered)

    def test_lifecycle_state_transitions(self):
        config = PluginConfig(
            plugin_id="test.plugin.2",
            name="Test Plugin 2",
            version="1.0.0",
            grpc_port=50098,
        )
        manager = PluginLifecycleManager(config)

        # Start without core connection
        manager.start()
        self.assertEqual(manager.state, PluginState.READY)

        # Test is_paused
        manager.state = PluginState.PAUSED
        self.assertTrue(manager.is_paused())

        manager.state = PluginState.READY
        self.assertFalse(manager.is_paused())

        # Clean up
        manager.stop()

    def test_command_handler_registration(self):
        config = PluginConfig(
            plugin_id="test.plugin.3",
            name="Test Plugin 3",
            version="1.0.0",
            grpc_port=50097,
        )
        manager = PluginLifecycleManager(config)

        handler_called = [False]

        def custom_handler(params):
            handler_called[0] = True

        manager.register_command_handler("custom_cmd", custom_handler)
        self.assertIn("custom_cmd", manager._command_handlers)


class TestWorkflowIntegration(unittest.TestCase):
    """Test workflow integration with all components."""

    def test_workflow_builder(self):
        builder = WorkflowBuilder(task_id="integration-test-001")
        workflow_context = (
            builder
            .with_config(BacktestConfig(initial_capital=50000.0))
            .with_symbols(["BTCUSDT"])
            .build()
        )

        self.assertIsNotNone(workflow_context)
        self.assertEqual(workflow_context.task_id, "integration-test-001")
        self.assertEqual(workflow_context.config.initial_capital, 50000.0)

    def test_workflow_context(self):
        config = BacktestConfig()
        account = BacktestAccountManager("ctx-test", "user", 100000.0)
        context = WorkflowContext(
            task_id="ctx-test",
            config=config,
            symbols=["BTCUSDT"],
            strategy_code="",
            time_range=None,
            account_manager=account,
        )

        self.assertEqual(context.task_id, "ctx-test")
        self.assertEqual(len(context.symbols), 1)
        self.assertEqual(context.state, WorkflowState.PENDING)


class TestEndToEndFlow(unittest.TestCase):
    """Test complete end-to-end flow without Core engine."""

    def test_complete_backtest_flow(self):
        """Simulate complete backtest flow."""
        # 1. Create configuration
        config = BacktestConfig(
            initial_capital=100000.0,
            commission_rate=0.001,
            slippage_rate=0.0005,
        )

        # 2. Create account manager
        account = BacktestAccountManager(
            task_id="e2e-test-001",
            user_id="user-001",
            initial_cash=config.initial_capital,
        )

        # 3. Get market data
        provider = create_default_provider_manager()
        time_range = TimeRange.last_days(30)
        data = provider.get_data("BTCUSDT", time_range)
        self.assertIsNotNone(data)

        # 4. Initialize strategy state
        state_manager = StrategyStateManager()
        state_manager.set_current_phase("analysis")

        # 5. Simulate analysis phase
        state_manager.set_analysis_result({
            "signal": "long",
            "entry_price": float(data.data["close"].iloc[-1]),
            "confidence": 0.75,
        })

        # 6. Simulate precondition phase
        state_manager.set_precondition_result({
            "signal_triggered": True,
            "volume_check": True,
            "trend_check": True,
        })

        # 7. Check if signal triggered
        self.assertTrue(state_manager.is_signal_triggered())

        # 8. Simulate execution phase - record a trade
        entry_price = float(data.data["close"].iloc[-1])
        trade = TradeRecord(
            trade_id="t1",
            symbol="BTCUSDT",
            side="buy",
            quantity=0.1,
            entry_price=entry_price,
            exit_price=entry_price * 1.01,  # 1% profit
            pnl=entry_price * 0.1 * 0.01,  # Profit
            commission=entry_price * 0.1 * config.commission_rate,
            entry_time=datetime.now(),
            exit_time=datetime.now(),
        )
        account.record_trade(trade)

        # 9. Get final metrics
        metrics = account.get_metrics()

        # Verify results
        self.assertEqual(metrics["total_trades"], 1)
        self.assertEqual(len(account.trades), 1)

        print(f"\n=== End-to-End Test Results ===")
        print(f"Data bars: {data.bar_count}")
        print(f"Signal triggered: {state_manager.is_signal_triggered()}")
        print(f"Trades executed: {metrics['total_trades']}")
        print(f"Trade PnL: {account.trades[0].pnl:.2f}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
