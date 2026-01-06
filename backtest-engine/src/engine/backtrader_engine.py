"""
Backtrader Engine Integration

Wrapper around the Backtrader library for backtest execution.
Based on nona_server's backtest engine patterns.
"""

import logging
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime
import pandas as pd
import numpy as np

try:
    import backtrader as bt
except ImportError:
    bt = None
    logging.warning("Backtrader not installed. Install with: pip install backtrader")

from ..config import BacktestConfig
from ..account import BacktestAccountManager, TradeRecord
from .base import BacktestEngine, EngineType

logger = logging.getLogger(__name__)


class SimpleStrategy(bt.Strategy if bt else object):
    """
    Simple strategy wrapper for user-provided code.

    This is a basic implementation that can be extended
    with user-defined logic.
    """

    params = (
        ("order_size_value", 1000.0),
        ("order_size_unit", "cash"),
    )

    def __init__(self):
        if bt is None:
            return

        # Track trades
        self.trade_count = 0
        self.order = None

        # Simple moving averages for demo
        self.sma_fast = bt.indicators.SMA(self.data.close, period=10)
        self.sma_slow = bt.indicators.SMA(self.data.close, period=30)

    def next(self):
        if bt is None:
            return

        # Simple crossover strategy for demo
        if self.order:
            return

        if not self.position:
            if self.sma_fast[0] > self.sma_slow[0]:
                size = self._calculate_size()
                self.order = self.buy(size=size)
        else:
            if self.sma_fast[0] < self.sma_slow[0]:
                self.order = self.close()

    def _calculate_size(self) -> float:
        """Calculate order size based on parameters."""
        if self.p.order_size_unit == "cash":
            price = self.data.close[0]
            return self.p.order_size_value / price if price > 0 else 0
        elif self.p.order_size_unit == "fixed":
            return self.p.order_size_value
        elif self.p.order_size_unit == "percent":
            cash = self.broker.getcash()
            price = self.data.close[0]
            return (cash * self.p.order_size_value / 100) / price if price > 0 else 0
        return 0

    def notify_order(self, order):
        if order.status in [order.Submitted, order.Accepted]:
            return

        if order.status in [order.Completed]:
            if order.isbuy():
                logger.debug(f"BUY executed: {order.executed.price:.2f}")
            else:
                logger.debug(f"SELL executed: {order.executed.price:.2f}")
            self.trade_count += 1

        self.order = None

    def notify_trade(self, trade):
        if not trade.isclosed:
            return
        logger.debug(f"Trade PnL: Gross={trade.pnl:.2f}, Net={trade.pnlcomm:.2f}")


class BacktraderEngine(BacktestEngine):
    """
    Backtrader integration wrapper.

    Provides a clean interface for running backtests
    using the Backtrader library.
    """

    def __init__(self):
        if bt is None:
            raise ImportError("Backtrader is required. Install with: pip install backtrader")
        logger.info("BacktraderEngine initialized")

    def get_engine_type(self) -> EngineType:
        """Get engine type."""
        return EngineType.BACKTRADER

    def get_supported_features(self) -> List[str]:
        """Get supported features."""
        return [
            "multi_symbol",
            "leverage",
            "short_selling",
            "fractional_shares",
            "streaming_progress",
            "custom_slippage",
            "custom_commission",
        ]

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
            strategy_code: Strategy source code (Python)
            symbols: List of symbols to trade
            time_range: Time range for backtest
            account_manager: Account manager instance
            on_progress: Progress callback function

        Returns:
            Dictionary with backtest results
        """
        logger.info(f"Starting backtest: symbols={symbols}")

        # Create Cerebro
        cerebro = bt.Cerebro()

        # Apply configuration
        config.apply_to_cerebro(cerebro)

        # Generate mock data for now
        # TODO: Integrate with Data Provider plugin
        data = self._create_mock_data(
            symbol=symbols[0] if symbols else "BTCUSDT",
            time_range=time_range,
        )

        # Add data feed
        cerebro.adddata(data)

        # Add strategy
        # TODO: Dynamic strategy loading from strategy_code
        cerebro.addstrategy(
            SimpleStrategy,
            order_size_value=config.order_size_value,
            order_size_unit=config.order_size_unit,
        )

        # Add analyzers
        cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trades")
        cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe")
        cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")

        # Set broker reference for account manager
        account_manager.broker = cerebro.broker

        # Run backtest
        logger.info("Running Cerebro")
        results = cerebro.run()

        # Extract results
        strategy = results[0]

        # Get analyzer results
        trade_analysis = strategy.analyzers.trades.get_analysis()
        sharpe_analysis = strategy.analyzers.sharpe.get_analysis()
        drawdown_analysis = strategy.analyzers.drawdown.get_analysis()

        # Update account manager with final state
        account_manager.broker = cerebro.broker

        # Extract trades from analyzer
        self._extract_trades(trade_analysis, account_manager)

        logger.info(
            f"Backtest completed: "
            f"final_value={cerebro.broker.getvalue():.2f}, "
            f"trades={len(account_manager.trades)}"
        )

        return {
            "final_value": cerebro.broker.getvalue(),
            "trade_count": len(account_manager.trades),
            "sharpe": sharpe_analysis.get("sharperatio", 0),
            "max_drawdown": drawdown_analysis.get("max", {}).get("drawdown", 0),
            "progress_updates": [],
        }

    def _create_mock_data(
        self,
        symbol: str,
        time_range: Any,
        bars: int = 1000,
    ) -> bt.feeds.PandasData:
        """
        Create mock OHLCV data for testing.

        TODO: Replace with actual data from Data Provider plugin.
        """
        logger.info(f"Creating mock data: symbol={symbol}, bars={bars}")

        # Generate dates
        dates = pd.date_range(
            start="2023-01-01",
            periods=bars,
            freq="1D",
        )

        # Generate random walk prices
        np.random.seed(42)
        returns = np.random.normal(0.0002, 0.02, bars)
        close = 100 * np.exp(np.cumsum(returns))

        # Generate OHLCV
        high = close * (1 + np.abs(np.random.normal(0, 0.01, bars)))
        low = close * (1 - np.abs(np.random.normal(0, 0.01, bars)))
        open_ = low + (high - low) * np.random.random(bars)
        volume = np.random.uniform(1000000, 10000000, bars)

        # Create DataFrame
        df = pd.DataFrame({
            "datetime": dates,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        })
        df.set_index("datetime", inplace=True)

        # Create Backtrader data feed
        data = bt.feeds.PandasData(
            dataname=df,
            datetime=None,
            open="open",
            high="high",
            low="low",
            close="close",
            volume="volume",
            openinterest=-1,
        )
        data._name = symbol

        return data

    def _extract_trades(
        self,
        trade_analysis: Dict,
        account_manager: BacktestAccountManager,
    ) -> None:
        """Extract trade records from Backtrader analysis."""
        # Backtrader's TradeAnalyzer provides summary stats, not individual trades
        # For individual trades, we'd need to track them in the strategy

        total = trade_analysis.get("total", {})
        total_trades = total.get("closed", 0)

        won = trade_analysis.get("won", {})
        lost = trade_analysis.get("lost", {})

        # Create synthetic trade records for metrics
        won_count = won.get("total", 0)
        lost_count = lost.get("total", 0)

        avg_won = won.get("pnl", {}).get("average", 0)
        avg_lost = lost.get("pnl", {}).get("average", 0)

        # Add synthetic trades for metrics calculation
        for i in range(won_count):
            account_manager.trades.append(
                TradeRecord(
                    trade_id=f"trade_{i}",
                    symbol="BTCUSDT",
                    side="buy",
                    quantity=1.0,
                    entry_price=100.0,
                    exit_price=100.0 + avg_won,
                    pnl=avg_won,
                    commission=0.0,
                    entry_time=datetime.now(),
                    exit_time=datetime.now(),
                )
            )

        for i in range(lost_count):
            account_manager.trades.append(
                TradeRecord(
                    trade_id=f"trade_{won_count + i}",
                    symbol="BTCUSDT",
                    side="buy",
                    quantity=1.0,
                    entry_price=100.0,
                    exit_price=100.0 + avg_lost,
                    pnl=avg_lost,
                    commission=0.0,
                    entry_time=datetime.now(),
                    exit_time=datetime.now(),
                )
            )
