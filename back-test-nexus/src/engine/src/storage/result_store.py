"""
Result Store

Ported from: nona_server/src/backtest/backtest_workflow.py (store_strategy_results)
             and src/redis_lifecycle/data_access_manager.py (TradingDataManager)

Stores backtest results and trade history using SQLite.
Replaces server's Redis-based TradingDataManager.
"""

import logging
import sqlite3
import json
from datetime import datetime
from typing import Dict, Optional, List, Tuple
from pathlib import Path
from ..utils import get_default_db_path

logger = logging.getLogger(__name__)


class ResultStore:
    """
    Result storage manager for Desktop.

    Port from: server's TradingDataManager (Redis-based)

    Stores backtest results and trade history using SQLite instead of Redis.

    Usage:
        >>> store = ResultStore()
        >>> trade_id = store.save_strategy_run(
        ...     task_id="task_123",
        ...     strategy_id=1,
        ...     strategy_name="TrendStrategy",
        ...     initial_value=100000.0,
        ...     final_value=105000.0,
        ...     returns=5.0,
        ...     total_trades=10,
        ...     win_rate=60.0
        ... )
        >>> store.save_trade_record(
        ...     trade_id=trade_id,
        ...     entry_time="2024-01-01 10:00:00",
        ...     exit_time="2024-01-01 12:00:00",
        ...     direction="long",
        ...     pnl=500.0
        ... )
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize result store.

        Args:
            db_path: Path to SQLite database (optional, uses default if None)
        """
        self.db_path = db_path or get_default_db_path()
        self._ensure_tables_exist()
        logger.debug(f"ResultStore initialized with db={self.db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_tables_exist(self) -> None:
        """
        Ensure result storage tables exist.

        Creates two tables:
        1. strategy_runs - Main strategy execution results
        2. trade_records - Individual trade details
        """
        create_runs_table = """
        CREATE TABLE IF NOT EXISTS strategy_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_id TEXT NOT NULL UNIQUE,
            task_id TEXT NOT NULL,
            strategy_id INTEGER NOT NULL,
            strategy_name TEXT NOT NULL,
            strategy_type TEXT DEFAULT 'backtest',
            entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            initial_value REAL NOT NULL,
            final_value REAL NOT NULL,
            returns REAL NOT NULL,
            profit_loss REAL NOT NULL,
            profit_loss_pct REAL NOT NULL,
            total_trades INTEGER DEFAULT 0,
            winning_trades INTEGER DEFAULT 0,
            losing_trades INTEGER DEFAULT 0,
            win_rate REAL DEFAULT 0.0,
            status TEXT DEFAULT 'COMPLETED',
            parameters TEXT,
            metrics TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """

        create_records_table = """
        CREATE TABLE IF NOT EXISTS trade_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            strategy_type TEXT,
            entry_time DATETIME,
            exit_time DATETIME,
            direction TEXT,
            pnl REAL,
            trade_size REAL,
            entry_price REAL,
            exit_price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trade_id) REFERENCES strategy_runs(trade_id)
        );
        """

        create_runs_index = """
        CREATE INDEX IF NOT EXISTS idx_trade_id
        ON strategy_runs(trade_id);
        """

        create_records_index = """
        CREATE INDEX IF NOT EXISTS idx_trade_records_trade_id
        ON trade_records(trade_id);
        """

        create_task_index = """
        CREATE INDEX IF NOT EXISTS idx_task_id
        ON strategy_runs(task_id);
        """

        try:
            with self._get_connection() as conn:
                conn.execute(create_runs_table)
                conn.execute(create_records_table)
                conn.execute(create_runs_index)
                conn.execute(create_records_index)
                conn.execute(create_task_index)
                conn.commit()
            logger.debug("Result storage tables ensured in database")
        except Exception as e:
            logger.error(f"Error ensuring tables exist: {e}")
            raise

    def save_strategy_run(
        self,
        task_id: str,
        strategy_id: int,
        strategy_name: str,
        initial_value: float,
        final_value: float,
        returns: float,
        total_trades: int = 0,
        winning_trades: int = 0,
        losing_trades: int = 0,
        win_rate: float = 0.0,
        strategy_type: str = "backtest",
        parameters: Optional[Dict] = None,
        metrics: Optional[Dict] = None,
    ) -> str:
        """
        Save main strategy run result.

        Port from: TradingDataManager.log_trade()

        Args:
            task_id: Task identifier
            strategy_id: Strategy ID
            strategy_name: Strategy name
            initial_value: Initial capital
            final_value: Final portfolio value
            returns: Return percentage
            total_trades: Total number of trades
            winning_trades: Number of winning trades
            losing_trades: Number of losing trades
            win_rate: Win rate percentage
            strategy_type: Strategy type (default: "backtest")
            parameters: Strategy parameters (optional)
            metrics: Backtest metrics (optional)

        Returns:
            str: Generated trade_id

        Example:
            >>> store = ResultStore()
            >>> trade_id = store.save_strategy_run(
            ...     task_id="task_123",
            ...     strategy_id=1,
            ...     strategy_name="TrendStrategy",
            ...     initial_value=100000.0,
            ...     final_value=105000.0,
            ...     returns=5.0,
            ...     total_trades=10,
            ...     win_rate=60.0
            ... )
        """
        try:
            # Generate trade_id
            trade_id = f"{task_id}_{strategy_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

            profit_loss = final_value - initial_value
            profit_loss_pct = returns

            sql = """
                INSERT INTO strategy_runs
                (trade_id, task_id, strategy_id, strategy_name, strategy_type,
                 initial_value, final_value, returns, profit_loss, profit_loss_pct,
                 total_trades, winning_trades, losing_trades, win_rate,
                 status, parameters, metrics)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            params = (
                trade_id,
                task_id,
                strategy_id,
                strategy_name,
                strategy_type,
                initial_value,
                final_value,
                returns,
                profit_loss,
                profit_loss_pct,
                total_trades,
                winning_trades,
                losing_trades,
                win_rate,
                "COMPLETED",
                json.dumps(parameters) if parameters else None,
                json.dumps(metrics) if metrics else None,
            )

            with self._get_connection() as conn:
                conn.execute(sql, params)
                conn.commit()

            logger.info(
                f"Strategy run saved: trade_id={trade_id}, strategy={strategy_name}, "
                f"returns={returns:.2f}%"
            )

            return trade_id

        except Exception as e:
            logger.error(f"Error saving strategy run: {e}")
            raise

    def save_trade_record(
        self,
        trade_id: str,
        task_id: str,
        entry_time: str,
        exit_time: str,
        direction: str,
        pnl: float,
        trade_size: float = 0.0,
        entry_price: float = 0.0,
        exit_price: float = 0.0,
        strategy_type: Optional[str] = None,
    ) -> int:
        """
        Save individual trade record.

        Port from: TradingDataManager.data_manager.save_trade_log()

        Args:
            trade_id: Trade ID (from save_strategy_run)
            task_id: Task ID
            entry_time: Entry datetime string
            exit_time: Exit datetime string
            direction: Trade direction ("long" or "short")
            pnl: Profit/loss
            trade_size: Trade size (optional)
            entry_price: Entry price (optional)
            exit_price: Exit price (optional)
            strategy_type: Strategy type (optional)

        Returns:
            int: Record ID

        Example:
            >>> store = ResultStore()
            >>> record_id = store.save_trade_record(
            ...     trade_id="task_123_1_20240101120000",
            ...     task_id="task_123",
            ...     entry_time="2024-01-01 10:00:00",
            ...     exit_time="2024-01-01 12:00:00",
            ...     direction="long",
            ...     pnl=500.0,
            ...     trade_size=1.0
            ... )
        """
        try:
            sql = """
                INSERT INTO trade_records
                (trade_id, task_id, strategy_type, entry_time, exit_time,
                 direction, pnl, trade_size, entry_price, exit_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            params = (
                trade_id,
                task_id,
                strategy_type,
                entry_time,
                exit_time,
                direction,
                pnl,
                trade_size,
                entry_price,
                exit_price,
            )

            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                conn.commit()
                record_id = cursor.lastrowid

            logger.debug(f"Trade record saved: record_id={record_id}, pnl={pnl:.2f}")

            return record_id

        except Exception as e:
            logger.error(f"Error saving trade record: {e}")
            raise

    def get_strategy_run(self, trade_id: str) -> Optional[Dict]:
        """
        Get strategy run by trade_id.

        Args:
            trade_id: Trade ID

        Returns:
            dict: Strategy run data or None if not found
        """
        try:
            sql = "SELECT * FROM strategy_runs WHERE trade_id = ?"

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (trade_id,))
                row = cursor.fetchone()

            if not row:
                logger.debug(f"Strategy run {trade_id} not found")
                return None

            result = dict(row)

            # Parse JSON fields
            if result.get("parameters"):
                try:
                    result["parameters"] = json.loads(result["parameters"])
                except json.JSONDecodeError:
                    pass

            if result.get("metrics"):
                try:
                    result["metrics"] = json.loads(result["metrics"])
                except json.JSONDecodeError:
                    pass

            return result

        except Exception as e:
            logger.error(f"Error getting strategy run {trade_id}: {e}")
            raise

    def get_trade_records(self, trade_id: str) -> List[Dict]:
        """
        Get all trade records for a strategy run.

        Args:
            trade_id: Trade ID

        Returns:
            list: List of trade record dictionaries
        """
        try:
            sql = """
                SELECT * FROM trade_records
                WHERE trade_id = ?
                ORDER BY entry_time
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (trade_id,))
                rows = cursor.fetchall()

            records = [dict(row) for row in rows]
            logger.debug(f"Retrieved {len(records)} trade records for {trade_id}")

            return records

        except Exception as e:
            logger.error(f"Error getting trade records for {trade_id}: {e}")
            raise

    def get_task_results(self, task_id: str) -> List[Dict]:
        """
        Get all strategy runs for a task.

        Args:
            task_id: Task ID

        Returns:
            list: List of strategy run dictionaries

        Example:
            >>> store = ResultStore()
            >>> results = store.get_task_results("task_123")
            >>> for result in results:
            ...     print(f"{result['strategy_name']}: {result['returns']:.2f}%")
        """
        try:
            sql = """
                SELECT * FROM strategy_runs
                WHERE task_id = ?
                ORDER BY created_at DESC
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (task_id,))
                rows = cursor.fetchall()

            results = []
            for row in rows:
                result = dict(row)

                # Parse JSON fields
                if result.get("parameters"):
                    try:
                        result["parameters"] = json.loads(result["parameters"])
                    except json.JSONDecodeError:
                        pass

                if result.get("metrics"):
                    try:
                        result["metrics"] = json.loads(result["metrics"])
                    except json.JSONDecodeError:
                        pass

                results.append(result)

            logger.debug(f"Retrieved {len(results)} strategy runs for task {task_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting task results for {task_id}: {e}")
            raise


def store_strategy_results(
    task_id: str,
    loaded_strategies: List[Dict],
    executor_results: List,
    metrics: Dict,
    result_store: Optional[ResultStore] = None
) -> List[str]:
    """
    Store strategy results to database.

    Port from: store_strategy_results() in backtest_workflow.py

    Simplified version for Desktop (no Redis, no Worker result models).

    Args:
        task_id: Task ID
        loaded_strategies: List of loaded strategy dictionaries
        executor_results: Results from StrategyExecutor.run()
        metrics: Backtest metrics dictionary
        result_store: Existing ResultStore instance (optional)

    Returns:
        list: List of generated trade_ids

    Example:
        >>> from strategy.executor import StrategyExecutor
        >>> executor = StrategyExecutor(...)
        >>> executor.prepare()
        >>> results = executor.run()
        >>> summaries = executor.get_results_summary()
        >>>
        >>> trade_ids = store_strategy_results(
        ...     task_id="task_123",
        ...     loaded_strategies=strategies,
        ...     executor_results=results,
        ...     metrics={"elapsed_time": 10.5, "processed_bars": 1000}
        ... )
    """
    if result_store is None:
        result_store = ResultStore()

    trade_ids = []

    for i, strategy_info in enumerate(loaded_strategies):
        if i >= len(executor_results):
            logger.warning(f"No result for strategy {i}")
            continue

        try:
            strategy_id = strategy_info.get("id", 0)
            strategy_name = strategy_info.get("strategy_name", "Unknown")

            # Get summary from executor
            # Note: In real usage, pass executor.get_results_summary()[i]
            # For now, extract basic info
            result = executor_results[i]
            if result is None:
                logger.warning(f"Strategy {strategy_name} (ID={strategy_id}) failed")
                continue

            # Extract basic metrics
            # Desktop's simplified approach
            initial_value = strategy_info.get("initial_cash", 100000.0)
            final_value = strategy_info.get("final_value", initial_value)
            returns = ((final_value - initial_value) / initial_value) * 100

            total_trades = strategy_info.get("total_trades", 0)
            winning_trades = strategy_info.get("winning_trades", 0)
            losing_trades = strategy_info.get("losing_trades", 0)
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0

            # Save main strategy run
            trade_id = result_store.save_strategy_run(
                task_id=task_id,
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                initial_value=initial_value,
                final_value=final_value,
                returns=returns,
                total_trades=total_trades,
                winning_trades=winning_trades,
                losing_trades=losing_trades,
                win_rate=win_rate,
                parameters=strategy_info.get("params", {}),
                metrics=metrics
            )

            trade_ids.append(trade_id)

            # Save individual trade records if available
            trade_history = strategy_info.get("trade_history", [])
            if trade_history:
                for trade in trade_history:
                    result_store.save_trade_record(
                        trade_id=trade_id,
                        task_id=task_id,
                        entry_time=trade.get("entry_time", ""),
                        exit_time=trade.get("exit_time", ""),
                        direction=trade.get("direction", ""),
                        pnl=trade.get("pnl", 0.0),
                        trade_size=trade.get("size", 0.0),
                        entry_price=trade.get("entry_price", 0.0),
                        exit_price=trade.get("exit_price", 0.0)
                    )

                logger.info(
                    f"Saved {len(trade_history)} trade records for {strategy_name}"
                )

        except Exception as e:
            logger.error(
                f"Error storing results for strategy {i}: {e}",
                exc_info=True
            )

    logger.info(f"Stored {len(trade_ids)} strategy results for task {task_id}")
    return trade_ids
