"""
BacktestPlugin gRPC Service Implementation

Implements the BacktestPlugin service defined in backtest.proto.
"""

import time
import logging
import json
from typing import Iterator, Optional
from concurrent import futures

from .proto import backtest_pb2
from .proto import backtest_pb2_grpc
from .proto import common_pb2
from .config import BacktestConfig
from .account import BacktestAccountManager
from .engine.backtrader_engine import BacktraderEngine

logger = logging.getLogger(__name__)


class BacktestPluginServicer(backtest_pb2_grpc.BacktestPluginServicer):
    """
    Implementation of the BacktestPlugin gRPC service.

    Handles backtest execution requests from the Core engine.
    """

    def __init__(self):
        self.active_tasks: dict = {}
        self.results: dict = {}
        self.engine = BacktraderEngine()
        self._lifecycle = None  # Set by PluginServer

        # Configuration from Host (set via Initialize RPC - TICKET_118)
        self.db_path: str = None
        self.log_path: str = None
        self.data_dir: str = None
        self.config_map: dict = {}
        self.initialized: bool = False

        logger.info("BacktestPluginServicer initialized")

    def set_lifecycle_manager(self, lifecycle) -> None:
        """Set the lifecycle manager for task tracking."""
        self._lifecycle = lifecycle

    def Initialize(
        self,
        request: backtest_pb2.InitializeRequest,
        context,
    ) -> backtest_pb2.InitializeResponse:
        """
        Initialize plugin with Host configuration (TICKET_118).

        Must be called once before any other RPCs.

        Args:
            request: InitializeRequest message with db_path, log_path, data_dir
            context: gRPC context

        Returns:
            InitializeResponse message
        """
        try:
            logger.info(f"Initialize RPC received: db_path={request.db_path}")

            # Store configuration from Host
            self.db_path = request.db_path
            self.log_path = request.log_path
            self.data_dir = request.data_dir
            self.config_map = dict(request.config) if request.config else {}
            self.initialized = True

            logger.info(f"Plugin initialized with config:")
            logger.info(f"  db_path: {self.db_path}")
            logger.info(f"  log_path: {self.log_path}")
            logger.info(f"  data_dir: {self.data_dir}")
            logger.info(f"  config: {self.config_map}")

            return backtest_pb2.InitializeResponse(
                success=True,
                message="Plugin initialized successfully",
                plugin_version="1.0.0",
                accepted_config=self.config_map,
            )

        except Exception as e:
            logger.error(f"Initialize failed: {e}")
            return backtest_pb2.InitializeResponse(
                success=False,
                message=f"Initialize failed: {str(e)}",
                plugin_version="1.0.0",
            )

    def _notify_task_started(self) -> None:
        """Notify lifecycle manager that a task started."""
        if self._lifecycle:
            self._lifecycle.task_started()

    def _notify_task_completed(self) -> None:
        """Notify lifecycle manager that a task completed."""
        if self._lifecycle:
            self._lifecycle.task_completed()

    def _notify_task_failed(self, error: str) -> None:
        """Notify lifecycle manager that a task failed."""
        if self._lifecycle:
            self._lifecycle.task_failed(error)

    def _is_paused(self) -> bool:
        """Check if plugin is paused."""
        if self._lifecycle:
            return self._lifecycle.is_paused()
        return False

    def _get_db_path(self) -> Optional[str]:
        """
        Get database path for components.

        Uses initialized db_path from Initialize RPC if available.
        Returns None if not initialized (components will use fallback).

        Returns:
            Database path or None
        """
        if self.initialized and self.db_path:
            return self.db_path

        # Not initialized - components will use fallback with warning
        logger.warning(
            "Database components will use fallback path - "
            "Initialize RPC not called or failed"
        )
        return None

    def _create_task_store(self) -> "TaskStore":
        """Create TaskStore with initialized db_path."""
        from .storage import TaskStore

        db_path = self._get_db_path()
        if db_path:
            logger.debug(f"Creating TaskStore with db_path={db_path}")
            return TaskStore(db_path=db_path)
        else:
            logger.debug("Creating TaskStore with fallback path")
            return TaskStore()

    def _create_result_store(self) -> "ResultStore":
        """Create ResultStore with initialized db_path."""
        from .storage import ResultStore

        db_path = self._get_db_path()
        if db_path:
            logger.debug(f"Creating ResultStore with db_path={db_path}")
            return ResultStore(db_path=db_path)
        else:
            logger.debug("Creating ResultStore with fallback path")
            return ResultStore()

    def _create_strategy_loader(self) -> "StrategyDatabaseLoader":
        """Create StrategyDatabaseLoader with initialized db_path."""
        from .strategy.database_loader import StrategyDatabaseLoader

        db_path = self._get_db_path()
        if db_path:
            logger.debug(f"Creating StrategyDatabaseLoader with db_path={db_path}")
            return StrategyDatabaseLoader(db_path=db_path)
        else:
            logger.debug("Creating StrategyDatabaseLoader with fallback path")
            return StrategyDatabaseLoader()

    def RunBacktest(
        self,
        request: backtest_pb2.BacktestRequest,
        context,
    ) -> Iterator[backtest_pb2.BacktestProgress]:
        """
        Execute a backtest with streaming progress updates.

        Args:
            request: BacktestRequest message
            context: gRPC context

        Yields:
            BacktestProgress messages
        """
        task_id = request.task_id
        logger.info(f"RunBacktest started: task_id={task_id}")

        # Check if paused
        if self._is_paused():
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_FAILED,
                progress=0.0,
                message="Plugin is paused, cannot start backtest",
            )
            return

        # Track active task
        self.active_tasks[task_id] = {
            "status": "running",
            "started_at": time.time(),
        }

        # Notify lifecycle manager
        self._notify_task_started()

        try:
            # Send initial progress
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_INITIALIZING,
                progress=0.0,
                message="Initializing backtest",
            )

            # Parse configuration
            config = BacktestConfig.from_proto(request.config)
            config.task_id = task_id

            # Create account manager
            account_manager = BacktestAccountManager(
                task_id=task_id,
                user_id=str(request.task_id),  # Use task_id as user_id for now
                initial_cash=config.initial_capital,
            )

            # Send loading data progress
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_LOADING_DATA,
                progress=0.1,
                message="Loading market data",
            )

            # Prepare data (for now, use mock data)
            symbols = list(request.symbols) if request.symbols else ["BTCUSDT"]
            time_range = request.time_range

            # Send running progress
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_RUNNING,
                progress=0.2,
                message="Running backtest",
            )

            # Execute backtest with progress callbacks
            def on_progress(current_bar: int, total_bars: int, equity: float):
                """Progress callback from engine."""
                progress = 0.2 + (current_bar / total_bars) * 0.7 if total_bars > 0 else 0.5
                return self._create_progress(
                    task_id=task_id,
                    status=backtest_pb2.PROGRESS_STATUS_RUNNING,
                    progress=progress,
                    message=f"Processing bar {current_bar}/{total_bars}",
                    current_equity=equity,
                    trades_count=len(account_manager.trades),
                )

            # Run the backtest
            result = self.engine.run(
                config=config,
                strategy_code=request.strategy_code,
                symbols=symbols,
                time_range=time_range,
                account_manager=account_manager,
                on_progress=on_progress,
            )

            # Yield progress updates from engine
            for progress in result.get("progress_updates", []):
                yield progress

            # Send calculating metrics progress
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_CALCULATING_METRICS,
                progress=0.95,
                message="Calculating metrics",
            )

            # Build final result
            metrics = account_manager.get_metrics()
            backtest_result = self._build_result(
                task_id=task_id,
                strategy_id=request.strategy_id,
                metrics=metrics,
                account_manager=account_manager,
            )

            # Store result
            self.results[task_id] = backtest_result

            # Send completed progress
            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_COMPLETED,
                progress=1.0,
                message="Backtest completed",
                current_equity=account_manager.broker.getvalue() if account_manager.broker else config.initial_capital,
                trades_count=len(account_manager.trades),
            )

            logger.info(f"RunBacktest completed: task_id={task_id}")

            # Notify lifecycle manager of success
            self._notify_task_completed()

        except Exception as e:
            logger.error(f"RunBacktest failed: task_id={task_id}, error={e}")

            # Notify lifecycle manager of failure
            self._notify_task_failed(str(e))

            yield self._create_progress(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_FAILED,
                progress=0.0,
                message=f"Backtest failed: {str(e)}",
            )

        finally:
            self.active_tasks.pop(task_id, None)

    def GetResult(
        self,
        request: backtest_pb2.ResultRequest,
        context,
    ) -> backtest_pb2.BacktestResult:
        """
        Get the result of a completed backtest.

        Args:
            request: ResultRequest message
            context: gRPC context

        Returns:
            BacktestResult message
        """
        task_id = request.task_id
        logger.info(f"GetResult: task_id={task_id}")

        if task_id not in self.results:
            return backtest_pb2.BacktestResult(
                task_id=task_id,
                status=backtest_pb2.PROGRESS_STATUS_FAILED,
                error_message=f"Result not found for task_id: {task_id}",
            )

        return self.results[task_id]

    def CancelBacktest(
        self,
        request: backtest_pb2.CancelRequest,
        context,
    ) -> backtest_pb2.CancelResult:
        """
        Cancel a running backtest.

        Args:
            request: CancelRequest message
            context: gRPC context

        Returns:
            CancelResult message
        """
        task_id = request.task_id
        logger.info(f"CancelBacktest: task_id={task_id}, reason={request.reason}")

        if task_id in self.active_tasks:
            self.active_tasks[task_id]["status"] = "cancelled"
            return backtest_pb2.CancelResult(
                success=True,
                task_id=task_id,
                final_status=backtest_pb2.PROGRESS_STATUS_CANCELLED,
            )

        return backtest_pb2.CancelResult(
            success=False,
            task_id=task_id,
            error=common_pb2.Error(
                code=common_pb2.STATUS_CODE_NOT_FOUND,
                message=f"Task not found: {task_id}",
            ),
        )

    def Ping(
        self,
        request: common_pb2.PingRequest,
        context,
    ) -> common_pb2.PingResponse:
        """
        Health check.

        Args:
            request: PingRequest message
            context: gRPC context

        Returns:
            PingResponse message
        """
        return common_pb2.PingResponse(
            ok=True,
            version="1.0.0",
            uptime_seconds=int(time.time()),
            timestamp=int(time.time() * 1000),
        )

    def GetCapabilities(
        self,
        request: common_pb2.Empty,
        context,
    ) -> backtest_pb2.BacktestCapabilities:
        """
        Get plugin capabilities.

        Args:
            request: Empty message
            context: gRPC context

        Returns:
            BacktestCapabilities message
        """
        return backtest_pb2.BacktestCapabilities(
            supported_languages=["python"],
            supported_frequencies=["1m", "5m", "15m", "1h", "4h", "1d"],
            supports_multi_symbol=True,
            supports_leverage=True,
            supports_short_selling=True,
            supports_fractional_shares=True,
            supports_custom_slippage=True,
            supports_streaming_progress=True,
            max_symbols=10,
            max_lookback_days=3650,
            max_concurrent_backtests=4,
            available_data_sources=["built-in", "data-plugin"],
            available_indicators=["SMA", "EMA", "RSI", "MACD", "BB"],
        )

    def _create_progress(
        self,
        task_id: str,
        status: int,
        progress: float,
        message: str,
        current_equity: float = 0.0,
        trades_count: int = 0,
    ) -> backtest_pb2.BacktestProgress:
        """Create a BacktestProgress message."""
        return backtest_pb2.BacktestProgress(
            task_id=task_id,
            status=status,
            progress=progress,
            message=message,
            current_equity=current_equity,
            trades_count=trades_count,
            elapsed_ms=int(time.time() * 1000),
        )

    def _build_result(
        self,
        task_id: str,
        strategy_id: str,
        metrics: dict,
        account_manager: BacktestAccountManager,
    ) -> backtest_pb2.BacktestResult:
        """Build a BacktestResult message."""
        # Serialize trades and equity curve
        trades_data = json.dumps(account_manager.get_trades()).encode()
        equity_curve_data = json.dumps(account_manager.get_equity_curve()).encode()

        # Build metrics proto
        metrics_proto = common_pb2.Metrics(
            total_return=metrics.get("total_return", 0.0),
            sharpe_ratio=metrics.get("sharpe_ratio", 0.0),
            max_drawdown=metrics.get("max_drawdown", 0.0),
            total_trades=metrics.get("total_trades", 0),
            winning_trades=metrics.get("winning_trades", 0),
            losing_trades=metrics.get("losing_trades", 0),
            win_rate=metrics.get("win_rate", 0.0),
            profit_factor=metrics.get("profit_factor", 0.0),
            avg_win=metrics.get("avg_win", 0.0),
            avg_loss=metrics.get("avg_loss", 0.0),
            largest_win=metrics.get("largest_win", 0.0),
            largest_loss=metrics.get("largest_loss", 0.0),
        )

        return backtest_pb2.BacktestResult(
            task_id=task_id,
            strategy_id=strategy_id,
            status=backtest_pb2.PROGRESS_STATUS_COMPLETED,
            metrics=metrics_proto,
            trades_data=trades_data,
            trades_count=len(account_manager.trades),
            trades_format="json",
            equity_curve_data=equity_curve_data,
            equity_curve_points=len(account_manager.equity_curve),
            equity_curve_format="json",
            completed_at=int(time.time() * 1000),
        )
