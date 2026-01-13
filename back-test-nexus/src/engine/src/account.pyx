"""
BacktestAccountManager - Unified Account Management

Based on nona_server's src/backtest/account_manager.py pattern.

Responsibilities:
1. Track portfolio value over time
2. Manage positions across strategies
3. Calculate performance metrics
4. Provide account summary for results
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import numpy as np
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class PositionDetail:
    """Position detail for a single asset."""
    symbol: str
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    leverage: int = 1
    notional_value: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "quantity": self.quantity,
            "entry_price": self.entry_price,
            "current_price": self.current_price,
            "unrealized_pnl": self.unrealized_pnl,
            "leverage": self.leverage,
            "notional_value": self.notional_value,
        }


@dataclass
class TradeRecord:
    """Record of a completed trade."""
    trade_id: str
    symbol: str
    side: str  # "buy" or "sell"
    quantity: float
    entry_price: float
    exit_price: float
    pnl: float
    commission: float
    entry_time: datetime
    exit_time: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "pnl": self.pnl,
            "commission": self.commission,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
        }


@dataclass
class EquityPoint:
    """Point on the equity curve."""
    timestamp: datetime
    equity: float
    drawdown: float
    position_value: float
    cash: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": int(self.timestamp.timestamp() * 1000) if self.timestamp else 0,
            "equity": self.equity,
            "drawdown": self.drawdown,
            "position_value": self.position_value,
            "cash": self.cash,
        }


class BacktestAccountManager:
    """
    Unified account management during backtest.

    Tracks portfolio value, positions, and calculates performance metrics.

    Attributes:
        task_id: Backtest task ID
        user_id: User ID
        initial_cash: Starting capital
        broker: Backtrader broker instance
    """

    def __init__(
        self,
        task_id: str,
        user_id: str,
        initial_cash: float,
        broker=None,
    ):
        self.task_id = task_id
        self.user_id = user_id
        self.initial_cash = initial_cash
        self.broker = broker

        # Performance tracking
        self.equity_curve: List[EquityPoint] = []
        self.trades: List[TradeRecord] = []
        self.metrics_cache: Dict[str, Any] = {}
        self.last_update_bar = -1

        # Peak tracking for drawdown
        self.peak_equity = initial_cash

        logger.info(
            f"AccountManager initialized: task_id={task_id}, "
            f"user_id={user_id}, initial_cash={initial_cash}"
        )

    def update(self, current_bar: int, timestamp: datetime = None) -> None:
        """
        Update account state for current bar.

        Args:
            current_bar: Current bar index
            timestamp: Current bar timestamp
        """
        if current_bar == self.last_update_bar:
            return

        if self.broker is None:
            return

        # Get current values
        equity = self.broker.getvalue()
        cash = self.broker.getcash()
        position_value = equity - cash

        # Update peak for drawdown calculation
        if equity > self.peak_equity:
            self.peak_equity = equity

        # Calculate drawdown
        drawdown = (self.peak_equity - equity) / self.peak_equity if self.peak_equity > 0 else 0

        # Record equity point
        point = EquityPoint(
            timestamp=timestamp or datetime.now(),
            equity=equity,
            drawdown=drawdown,
            position_value=position_value,
            cash=cash,
        )
        self.equity_curve.append(point)

        # Clear metrics cache
        self.metrics_cache.clear()
        self.last_update_bar = current_bar

    def record_trade(self, trade: TradeRecord) -> None:
        """Record a completed trade."""
        self.trades.append(trade)
        self.metrics_cache.clear()

    def get_account_summary(self) -> Dict[str, Any]:
        """
        Get account summary for result reporting.

        Returns:
            Dictionary with account metrics and positions
        """
        return {
            "total_return": self.calculate_total_return(),
            "available_cash": self.broker.getcash() if self.broker else self.initial_cash,
            "account_value": self.broker.getvalue() if self.broker else self.initial_cash,
            "positions": self.get_position_details(),
            "sharpe_ratio": self.calculate_sharpe_ratio(),
            "max_drawdown": self.calculate_max_drawdown(),
            "total_trades": len(self.trades),
            "win_rate": self.calculate_win_rate(),
        }

    def get_position_details(self) -> List[Dict[str, Any]]:
        """Get current position details."""
        positions = []
        if self.broker is None:
            return positions

        # Get positions from broker
        for data in self.broker.datas if hasattr(self.broker, 'datas') else []:
            position = self.broker.getposition(data)
            if position.size != 0:
                current_price = data.close[0] if len(data) > 0 else 0
                entry_price = position.price
                unrealized_pnl = (current_price - entry_price) * position.size

                pos_detail = PositionDetail(
                    symbol=data._name if hasattr(data, '_name') else str(data),
                    quantity=position.size,
                    entry_price=entry_price,
                    current_price=current_price,
                    unrealized_pnl=unrealized_pnl,
                    leverage=1,
                    notional_value=abs(position.size) * current_price,
                )
                positions.append(pos_detail.to_dict())

        return positions

    def calculate_total_return(self) -> float:
        """
        Calculate total return percentage.

        Returns:
            Total return as percentage (e.g., 15.5 for 15.5%)
        """
        if "total_return" in self.metrics_cache:
            return self.metrics_cache["total_return"]

        current_value = self.broker.getvalue() if self.broker else self.initial_cash
        total_return = ((current_value - self.initial_cash) / self.initial_cash) * 100

        self.metrics_cache["total_return"] = round(total_return, 4)
        return self.metrics_cache["total_return"]

    def calculate_sharpe_ratio(self, risk_free_rate: float = 0.02) -> float:
        """
        Calculate Sharpe ratio.

        Args:
            risk_free_rate: Annual risk-free rate (default 2%)

        Returns:
            Sharpe ratio
        """
        if "sharpe_ratio" in self.metrics_cache:
            return self.metrics_cache["sharpe_ratio"]

        if len(self.equity_curve) < 2:
            return 0.0

        # Calculate returns
        equities = [p.equity for p in self.equity_curve]
        returns = []
        for i in range(1, len(equities)):
            if equities[i - 1] > 0:
                ret = (equities[i] - equities[i - 1]) / equities[i - 1]
                returns.append(ret)

        if not returns:
            return 0.0

        returns_array = np.array(returns)
        mean_return = np.mean(returns_array)
        std_return = np.std(returns_array, ddof=1)

        if std_return == 0:
            return 0.0

        # Annualize (assuming daily bars, 252 trading days)
        annualized_return = mean_return * 252
        annualized_std = std_return * np.sqrt(252)

        sharpe = (annualized_return - risk_free_rate) / annualized_std

        self.metrics_cache["sharpe_ratio"] = round(sharpe, 4)
        return self.metrics_cache["sharpe_ratio"]

    def calculate_max_drawdown(self) -> float:
        """
        Calculate maximum drawdown.

        Returns:
            Max drawdown as percentage (e.g., 10.5 for 10.5%)
        """
        if "max_drawdown" in self.metrics_cache:
            return self.metrics_cache["max_drawdown"]

        if not self.equity_curve:
            return 0.0

        max_dd = max(p.drawdown for p in self.equity_curve)

        self.metrics_cache["max_drawdown"] = round(max_dd * 100, 4)
        return self.metrics_cache["max_drawdown"]

    def calculate_win_rate(self) -> float:
        """
        Calculate win rate.

        Returns:
            Win rate as decimal (e.g., 0.65 for 65%)
        """
        if "win_rate" in self.metrics_cache:
            return self.metrics_cache["win_rate"]

        if not self.trades:
            return 0.0

        winning_trades = sum(1 for t in self.trades if t.pnl > 0)
        win_rate = winning_trades / len(self.trades)

        self.metrics_cache["win_rate"] = round(win_rate, 4)
        return self.metrics_cache["win_rate"]

    def calculate_profit_factor(self) -> float:
        """
        Calculate profit factor (gross profit / gross loss).

        Returns:
            Profit factor
        """
        if not self.trades:
            return 0.0

        gross_profit = sum(t.pnl for t in self.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if t.pnl < 0))

        if gross_loss == 0:
            return float('inf') if gross_profit > 0 else 0.0

        return round(gross_profit / gross_loss, 4)

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get all performance metrics.

        Returns:
            Dictionary with all calculated metrics
        """
        total_trades = len(self.trades)
        winning_trades = sum(1 for t in self.trades if t.pnl > 0)
        losing_trades = sum(1 for t in self.trades if t.pnl < 0)

        return {
            "total_return": self.calculate_total_return() / 100,  # As decimal
            "annualized_return": 0.0,  # TODO: Calculate based on time period
            "sharpe_ratio": self.calculate_sharpe_ratio(),
            "sortino_ratio": 0.0,  # TODO: Implement
            "calmar_ratio": 0.0,  # TODO: Implement
            "max_drawdown": self.calculate_max_drawdown() / 100,  # As decimal
            "volatility": 0.0,  # TODO: Implement
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate": self.calculate_win_rate(),
            "profit_factor": self.calculate_profit_factor(),
            "avg_win": self._calculate_avg_win(),
            "avg_loss": self._calculate_avg_loss(),
            "largest_win": self._calculate_largest_win(),
            "largest_loss": self._calculate_largest_loss(),
        }

    def _calculate_avg_win(self) -> float:
        """Calculate average winning trade."""
        wins = [t.pnl for t in self.trades if t.pnl > 0]
        return round(np.mean(wins), 2) if wins else 0.0

    def _calculate_avg_loss(self) -> float:
        """Calculate average losing trade."""
        losses = [t.pnl for t in self.trades if t.pnl < 0]
        return round(np.mean(losses), 2) if losses else 0.0

    def _calculate_largest_win(self) -> float:
        """Calculate largest winning trade."""
        wins = [t.pnl for t in self.trades if t.pnl > 0]
        return max(wins) if wins else 0.0

    def _calculate_largest_loss(self) -> float:
        """Calculate largest losing trade."""
        losses = [t.pnl for t in self.trades if t.pnl < 0]
        return min(losses) if losses else 0.0

    def get_equity_curve(self) -> List[Dict[str, Any]]:
        """Get equity curve as list of dictionaries."""
        return [p.to_dict() for p in self.equity_curve]

    def get_trades(self) -> List[Dict[str, Any]]:
        """Get trades as list of dictionaries."""
        return [t.to_dict() for t in self.trades]

    def reset(self) -> None:
        """Reset account state for new backtest."""
        self.equity_curve.clear()
        self.trades.clear()
        self.metrics_cache.clear()
        self.peak_equity = self.initial_cash
        self.last_update_bar = -1
