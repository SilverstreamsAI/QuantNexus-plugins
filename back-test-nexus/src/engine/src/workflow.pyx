"""
Backtest Workflow Execution

Orchestrates the backtest execution process.
Based on nona_server's backtest_workflow.py pattern.

TICKET_118 Phase 6: Workflow Integration
- Integrated data preparation pipeline (Phase 1.2)
- Integrated strategy management (Phase 2)
- Integrated result storage (Phase 3)
- Integrated exception handling (Phase 5)

Responsibilities:
1. Parameter extraction from request
2. Data preparation
3. Strategy loading
4. Execution orchestration
5. Result building
6. Checkpoint management for resume capability
"""

import logging
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import traceback

from .config import BacktestConfig
from .account import BacktestAccountManager
from .engine.backtrader_engine import BacktraderEngine
from .checkpoint import CheckpointManager, CheckpointData, get_checkpoint_manager

# Phase 5: Exception handling
from .exceptions import (
    BacktestException,
    DataPreparationException,
    DataLoadingException,
    DataInsufficientException,
    StrategyNotFoundException,
    StrategyExecutionException,
    ResultProcessingException,
)

# Phase 1.2: Data preparation
from .data.request_parser import RequestParser
from .data.data_loader import DataLoader

# Phase 2: Strategy management
from .strategy.database_loader import StrategyDatabaseLoader
from .strategy.strategy_loader import StrategyLoader

# Phase 3: Result storage
from .storage.task_store import TaskStore, TaskStatus
from .storage.result_store import ResultStore

logger = logging.getLogger(__name__)


class WorkflowState(Enum):
    """Workflow execution states."""
    PENDING = "pending"
    INITIALIZING = "initializing"
    RESUMING = "resuming"
    LOADING_DATA = "loading_data"
    RUNNING = "running"
    CALCULATING = "calculating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowContext:
    """Context object passed through workflow stages."""
    task_id: str
    user_id: int
    config: BacktestConfig
    symbols: List[str]
    strategy_code: str
    time_range: Any
    account_manager: BacktestAccountManager

    # Phase 6: Request data (for data preparation)
    json_data: Optional[Dict[str, Any]] = None
    db_path: Optional[str] = None

    # Runtime state
    state: WorkflowState = WorkflowState.PENDING
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None

    # Phase 6: Loaded data and strategies
    market_data: Optional[Any] = None
    loaded_strategies: Optional[List[Any]] = None

    # Results
    result: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Checkpoint/Resume state
    resume_from_checkpoint: bool = False
    checkpoint_data: Optional[CheckpointData] = None
    resume_bar: int = 0
    strategy_version: Optional[str] = None


class BacktestWorkflow:
    """
    Backtest execution workflow orchestrator.

    Manages the complete lifecycle of a backtest execution,
    from initialization through completion.

    Features:
    - Checkpoint saving for resume capability
    - Warmup period for indicator restoration
    - Progress callbacks for streaming updates

    Attributes:
        engine: Backtrader engine instance
        checkpoint_manager: CheckpointManager for resume support
        on_progress: Progress callback function
        enable_checkpoints: Whether to save checkpoints during execution
    """

    def __init__(
        self,
        engine: Optional[BacktraderEngine] = None,
        checkpoint_manager: Optional[CheckpointManager] = None,
        on_progress: Optional[Callable[[WorkflowContext], None]] = None,
        enable_checkpoints: bool = True,
    ):
        self.engine = engine or BacktraderEngine()
        self.checkpoint_manager = checkpoint_manager or get_checkpoint_manager()
        self.on_progress = on_progress
        self.enable_checkpoints = enable_checkpoints
        logger.info(
            f"BacktestWorkflow initialized: checkpoints={enable_checkpoints}"
        )

    def execute(self, context: WorkflowContext) -> Dict[str, Any]:
        """
        Execute the complete backtest workflow.

        TICKET_118 Phase 6: Enhanced error handling with specific exception types

        Args:
            context: Workflow context with all parameters

        Returns:
            Dictionary with backtest results

        Raises:
            BacktestException: For all backtest-related errors
        """
        logger.info(f"Starting workflow: task_id={context.task_id}, user_id={context.user_id}")
        context.started_at = datetime.now()

        # Phase 3: Initialize task store
        task_store = None
        if context.db_path:
            task_store = TaskStore(db_path=context.db_path)

        try:
            # Update task status to running
            if task_store:
                task_store.update_task_status(context.task_id, TaskStatus.RUNNING)

            # Stage 1: Initialize (check for resume)
            self._stage_initialize(context)

            # Stage 1.5: Resume from checkpoint if available
            if context.resume_from_checkpoint:
                self._stage_resume(context)

            # Stage 2: Load Data (Phase 1.2 integration)
            self._stage_load_data(context)

            # Stage 2.5: Load Strategies (Phase 2 integration)
            self._stage_load_strategies(context)

            # Stage 3: Run Backtest
            self._stage_run_backtest(context)

            # Stage 4: Calculate Metrics
            self._stage_calculate_metrics(context)

            # Stage 5: Complete (Phase 3 integration)
            self._stage_complete(context)

            # Update task status to completed
            if task_store:
                task_store.update_task_status(
                    context.task_id,
                    TaskStatus.COMPLETED,
                    result=context.result
                )

            return context.result or {}

        except BacktestException as e:
            # Phase 5: Structured exception handling
            logger.error(f"Backtest failed with {type(e).__name__}: {e}")
            logger.debug(f"Exception details: {e.to_dict()}")

            context.state = WorkflowState.FAILED
            context.error = str(e)
            context.error_details = e.to_dict()
            self._notify_progress(context)

            # Update task status to failed
            if task_store:
                task_store.update_task_status(
                    context.task_id,
                    TaskStatus.FAILED,
                    error_message=str(e)
                )

            raise  # Re-raise for caller

        except Exception as e:
            # Wrap unexpected exceptions
            logger.error(f"Workflow failed with unexpected error: {e}")
            logger.debug(f"Traceback: {traceback.format_exc()}")

            wrapped_exception = BacktestException.from_exception(
                e,
                phase="workflow_execution",
                task_id=context.task_id,
                user_id=context.user_id
            )

            context.state = WorkflowState.FAILED
            context.error = str(wrapped_exception)
            context.error_details = wrapped_exception.to_dict()
            self._notify_progress(context)

            # Update task status to failed
            if task_store:
                task_store.update_task_status(
                    context.task_id,
                    TaskStatus.FAILED,
                    error_message=str(wrapped_exception)
                )

            raise wrapped_exception from e

    def _stage_initialize(self, context: WorkflowContext) -> None:
        """Initialize workflow and check for resume."""
        logger.info(f"Stage: Initialize - task_id={context.task_id}")

        context.state = WorkflowState.INITIALIZING
        context.progress = 0.0
        context.message = "Initializing backtest"
        self._notify_progress(context)

        # Validate configuration (already validated in __post_init__)
        context.config._validate()

        # Check for existing checkpoint to resume from
        if self.enable_checkpoints and self.checkpoint_manager.has_checkpoint(context.task_id):
            checkpoint = self.checkpoint_manager.load(context.task_id)
            if checkpoint:
                context.resume_from_checkpoint = True
                context.checkpoint_data = checkpoint
                context.resume_bar = self.checkpoint_manager.get_resume_bar(context.task_id)
                logger.info(
                    f"Found checkpoint: bar_index={checkpoint.bar_index}, "
                    f"resume_bar={context.resume_bar}"
                )
        else:
            # Fresh start - reset account manager
            context.account_manager.reset()

        logger.debug(f"Config validated: {context.config}")

    def _stage_resume(self, context: WorkflowContext) -> None:
        """Resume from checkpoint."""
        logger.info(f"Stage: Resume - task_id={context.task_id}")

        context.state = WorkflowState.RESUMING
        context.progress = 0.05
        context.message = f"Resuming from bar {context.resume_bar}"
        self._notify_progress(context)

        checkpoint = context.checkpoint_data
        if not checkpoint:
            logger.warning("No checkpoint data available for resume")
            return

        # Restore broker state
        if checkpoint.broker:
            logger.debug(f"Restoring broker state: {checkpoint.broker}")
            # Note: Actual broker restoration happens in engine

        # Restore metrics if available
        if checkpoint.metrics:
            logger.debug(f"Restoring metrics: {checkpoint.metrics}")

        logger.info(
            f"Resume state restored: bar_index={checkpoint.bar_index}, "
            f"warmup_period={checkpoint.warmup_period}"
        )

    def _stage_load_data(self, context: WorkflowContext) -> None:
        """
        Load market data.

        TICKET_118 Phase 6: Integrated data preparation pipeline (Phase 1.2)
        """
        logger.info(f"Stage: Load Data - task_id={context.task_id}")

        context.state = WorkflowState.LOADING_DATA
        context.progress = 0.1
        context.message = "Loading market data"
        self._notify_progress(context)

        try:
            # Phase 1.2: Parse request data
            if not context.json_data:
                raise DataPreparationException(
                    message="json_data is required for data loading",
                    task_id=context.task_id,
                    user_id=context.user_id
                )

            logger.debug(f"Parsing request data: {context.json_data}")
            request = RequestParser.parse(context.json_data)

            # Validate symbol
            if not request.symbol:
                raise DataPreparationException(
                    message="symbol is required",
                    task_id=context.task_id,
                    user_id=context.user_id,
                    details={"json_data": context.json_data}
                )

            # Phase 1.2: Load data using DataLoader
            logger.debug(
                f"Loading data: symbol={request.symbol}, "
                f"timeframe={request.timeframe}, "
                f"start={request.start_time}, end={request.end_time}"
            )

            loader = DataLoader(db_path=context.db_path)
            data = loader.load(
                symbol=request.symbol,
                start_time=request.start_time,
                end_time=request.end_time,
                timeframe=request.timeframe,
                data_type=request.data_type
            )

            # Validate data sufficiency
            MIN_DATA_LENGTH = 50  # Minimum bars required
            if data is None or len(data) < MIN_DATA_LENGTH:
                raise DataInsufficientException(
                    message=f"Insufficient data: need at least {MIN_DATA_LENGTH} bars, got {len(data) if data is not None else 0}",
                    symbol=request.symbol,
                    bars_required=MIN_DATA_LENGTH,
                    bars_found=len(data) if data is not None else 0,
                    task_id=context.task_id,
                    user_id=context.user_id
                )

            context.market_data = data
            logger.info(f"Data loaded successfully: {len(data)} bars for {request.symbol}")

        except BacktestException:
            raise  # Re-raise our exceptions
        except Exception as e:
            raise DataLoadingException(
                message=f"Failed to load market data: {e}",
                task_id=context.task_id,
                user_id=context.user_id,
                details={"error": str(e)},
                original_exception=e
            )

    def _stage_load_strategies(self, context: WorkflowContext) -> None:
        """
        Load strategies from database.

        TICKET_118 Phase 6: Integrated strategy management (Phase 2)
        """
        logger.info(f"Stage: Load Strategies - task_id={context.task_id}")

        context.progress = 0.15
        context.message = "Loading strategies"
        self._notify_progress(context)

        try:
            # Phase 2: Parse strategy configuration from request
            if not context.json_data:
                raise DataPreparationException(
                    message="json_data is required for strategy loading",
                    task_id=context.task_id,
                    user_id=context.user_id
                )

            test_cases = context.json_data.get("testCases", [])
            if not test_cases:
                raise DataPreparationException(
                    message="testCases is required",
                    task_id=context.task_id,
                    user_id=context.user_id,
                    details={"json_data": context.json_data}
                )

            # Phase 2: Load strategies from database
            db_loader = StrategyDatabaseLoader(
                db_path=context.db_path,
                user_id=context.user_id
            )

            loaded_strategies = []
            for i, test_case in enumerate(test_cases):
                # Extract strategy name from test case
                # Server uses PHASE_EXECUTION key, we'll support both patterns
                strategy_name = test_case.get("execution") or test_case.get("strategy_name")

                if not strategy_name:
                    logger.warning(f"Test case {i} missing strategy name, skipping")
                    continue

                logger.debug(f"Loading strategy: {strategy_name}")

                try:
                    strategy = db_loader.load_strategy_by_name(strategy_name)
                    if strategy:
                        loaded_strategies.append(strategy)
                        logger.debug(f"Strategy loaded: {strategy['name']}")
                    else:
                        raise StrategyNotFoundException(
                            message=f"Strategy '{strategy_name}' not found in database",
                            strategy_name=strategy_name,
                            task_id=context.task_id,
                            user_id=context.user_id
                        )
                except Exception as e:
                    if isinstance(e, BacktestException):
                        raise
                    raise StrategyNotFoundException(
                        message=f"Failed to load strategy '{strategy_name}': {e}",
                        strategy_name=strategy_name,
                        task_id=context.task_id,
                        user_id=context.user_id,
                        original_exception=e
                    )

            if not loaded_strategies:
                raise StrategyNotFoundException(
                    message="No strategies could be loaded from test cases",
                    task_id=context.task_id,
                    user_id=context.user_id,
                    details={"test_cases": test_cases}
                )

            context.loaded_strategies = loaded_strategies
            logger.info(f"Strategies loaded successfully: {len(loaded_strategies)} strategies")

        except BacktestException:
            raise  # Re-raise our exceptions
        except Exception as e:
            raise BacktestException.from_exception(
                e,
                phase="strategy_loading",
                task_id=context.task_id,
                user_id=context.user_id
            )

    def _stage_run_backtest(self, context: WorkflowContext) -> None:
        """
        Execute the backtest.

        TICKET_118 Phase 6: Enhanced error handling for execution phase
        """
        logger.info(f"Stage: Run Backtest - task_id={context.task_id}")

        context.state = WorkflowState.RUNNING
        context.progress = 0.2
        context.message = "Running backtest"
        self._notify_progress(context)

        try:
            # Progress callback wrapper
            def engine_progress(current_bar: int, total_bars: int, equity: float):
                if total_bars > 0:
                    context.progress = 0.2 + (current_bar / total_bars) * 0.7
                context.message = f"Processing bar {current_bar}/{total_bars}"
                self._notify_progress(context)

            # Execute backtest
            result = self.engine.run(
                config=context.config,
                strategy_code=context.strategy_code,
                symbols=context.symbols,
                time_range=context.time_range,
                account_manager=context.account_manager,
                on_progress=engine_progress,
            )

            context.result = result
            logger.info(f"Backtest execution completed: {len(context.account_manager.trades)} trades")

        except BacktestException:
            raise  # Re-raise our exceptions
        except Exception as e:
            # Wrap execution errors
            strategy_name = context.symbols[0] if context.symbols else "unknown"
            raise StrategyExecutionException(
                message=f"Strategy execution failed: {e}",
                strategy_name=strategy_name,
                task_id=context.task_id,
                user_id=context.user_id,
                details={"error": str(e)},
                original_exception=e
            )

    def _stage_calculate_metrics(self, context: WorkflowContext) -> None:
        """Calculate performance metrics."""
        logger.info(f"Stage: Calculate Metrics - task_id={context.task_id}")

        context.state = WorkflowState.CALCULATING
        context.progress = 0.95
        context.message = "Calculating metrics"
        self._notify_progress(context)

        # Get metrics from account manager
        metrics = context.account_manager.get_metrics()

        # Merge with result
        if context.result:
            context.result["metrics"] = metrics
        else:
            context.result = {"metrics": metrics}

        logger.debug(f"Metrics calculated: {metrics}")

    def _stage_complete(self, context: WorkflowContext) -> None:
        """
        Complete the workflow.

        TICKET_118 Phase 6: Integrated result storage (Phase 3)
        """
        logger.info(f"Stage: Complete - task_id={context.task_id}")

        context.state = WorkflowState.COMPLETED
        context.progress = 1.0
        context.message = "Backtest completed"
        context.completed_at = datetime.now()
        self._notify_progress(context)

        try:
            # Add timing info to result
            if context.result:
                context.result["timing"] = {
                    "started_at": context.started_at.isoformat() if context.started_at else None,
                    "completed_at": context.completed_at.isoformat() if context.completed_at else None,
                    "duration_seconds": (
                        context.completed_at - context.started_at
                    ).total_seconds() if context.started_at and context.completed_at else 0,
                }
                # Add resume info if applicable
                if context.resume_from_checkpoint:
                    context.result["resumed_from_bar"] = context.resume_bar

            # Phase 3: Store results to database
            if context.db_path and context.loaded_strategies:
                logger.info("Storing results to database")
                result_store = ResultStore(db_path=context.db_path)

                for i, strategy in enumerate(context.loaded_strategies):
                    # Extract strategy metrics from result
                    metrics = context.result.get("metrics", {}) if context.result else {}

                    # Generate trade_id for this strategy run
                    trade_id = f"{context.task_id}_strategy_{i}"

                    # Prepare strategy run data
                    strategy_run_data = {
                        "trade_id": trade_id,
                        "task_id": context.task_id,
                        "strategy_id": strategy.get("id", 0),
                        "strategy_name": strategy.get("name", "unknown"),
                        "entry_time": context.started_at.isoformat() if context.started_at else None,
                        "initial_value": context.config.initial_capital,
                        "final_value": metrics.get("final_value", context.config.initial_capital),
                        "returns": metrics.get("returns", 0.0),
                        "profit_loss": metrics.get("profit_loss", 0.0),
                        "profit_loss_pct": metrics.get("profit_loss_pct", 0.0),
                        "total_trades": metrics.get("total_trades", 0),
                        "winning_trades": metrics.get("winning_trades", 0),
                        "losing_trades": metrics.get("losing_trades", 0),
                        "win_rate": metrics.get("win_rate", 0.0),
                        "status": "COMPLETED",
                        "parameters": context.json_data if context.json_data else {},
                        "metrics": metrics
                    }

                    # Save strategy run
                    result_store.save_strategy_run(strategy_run_data)

                    # Save individual trade records if available
                    if context.account_manager.trades:
                        for j, trade in enumerate(context.account_manager.trades):
                            trade_record = {
                                "trade_id": trade_id,
                                "task_id": context.task_id,
                                "strategy_type": strategy.get("name", "unknown"),
                                "entry_time": trade.get("entry_time"),
                                "exit_time": trade.get("exit_time"),
                                "direction": trade.get("direction"),
                                "pnl": trade.get("pnl", 0.0),
                                "trade_size": trade.get("size", 0.0),
                                "entry_price": trade.get("entry_price", 0.0),
                                "exit_price": trade.get("exit_price", 0.0)
                            }
                            result_store.save_trade_record(trade_record)

                logger.info(f"Results stored for {len(context.loaded_strategies)} strategies")

            # Cleanup checkpoints on successful completion
            if self.enable_checkpoints:
                deleted = self.checkpoint_manager.cleanup(context.task_id)
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} checkpoints")

            logger.info(
                f"Workflow completed successfully: task_id={context.task_id}, "
                f"trades={len(context.account_manager.trades)}"
            )

        except Exception as e:
            # Result storage is non-critical, log error but don't fail the workflow
            logger.error(f"Failed to store results: {e}")
            logger.debug(f"Traceback: {traceback.format_exc()}")
            # Don't raise, workflow is still considered successful

    def save_checkpoint(
        self,
        context: WorkflowContext,
        bar_index: int,
        strategy_state: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Save a checkpoint during execution.

        Call this periodically during backtest execution to enable resume.

        Args:
            context: Workflow context
            bar_index: Current bar index
            strategy_state: Optional strategy-specific state

        Returns:
            True if checkpoint was saved
        """
        if not self.enable_checkpoints:
            return False

        if not self.checkpoint_manager.should_save(bar_index):
            return False

        # Build checkpoint data
        from .checkpoint import BrokerState

        broker_state = None
        if context.account_manager.broker:
            broker_state = BrokerState(
                cash=context.account_manager.broker.getcash(),
                value=context.account_manager.broker.getvalue(),
            )

        checkpoint = self.checkpoint_manager.create_checkpoint_data(
            task_id=context.task_id,
            bar_index=bar_index,
            broker_state=broker_state,
            strategy_state=strategy_state,
            metrics=context.account_manager.get_metrics(),
        )

        return self.checkpoint_manager.save(
            task_id=context.task_id,
            bar_index=bar_index,
            checkpoint_data=checkpoint,
            strategy_version=context.strategy_version,
        )

    def _notify_progress(self, context: WorkflowContext) -> None:
        """Notify progress callback if registered."""
        if self.on_progress:
            try:
                self.on_progress(context)
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")


class WorkflowBuilder:
    """
    Builder for creating workflow contexts.

    TICKET_118 Phase 6: Extended to support new context fields

    Provides a fluent interface for configuring workflows.
    """

    def __init__(self, task_id: str, user_id: int = 0):
        self.task_id = task_id
        self.user_id = user_id
        self._config: Optional[BacktestConfig] = None
        self._symbols: List[str] = []
        self._strategy_code: str = ""
        self._time_range: Any = None
        self._initial_capital: float = 100000.0
        self._json_data: Optional[Dict[str, Any]] = None
        self._db_path: Optional[str] = None

    def with_config(self, config: BacktestConfig) -> "WorkflowBuilder":
        """Set backtest configuration."""
        self._config = config
        return self

    def with_symbols(self, symbols: List[str]) -> "WorkflowBuilder":
        """Set symbols to trade."""
        self._symbols = symbols
        return self

    def with_strategy(self, code: str) -> "WorkflowBuilder":
        """Set strategy code."""
        self._strategy_code = code
        return self

    def with_time_range(self, time_range: Any) -> "WorkflowBuilder":
        """Set time range."""
        self._time_range = time_range
        return self

    def with_capital(self, capital: float) -> "WorkflowBuilder":
        """Set initial capital."""
        self._initial_capital = capital
        return self

    def with_json_data(self, json_data: Dict[str, Any]) -> "WorkflowBuilder":
        """Set raw JSON request data (Phase 6)."""
        self._json_data = json_data
        return self

    def with_db_path(self, db_path: str) -> "WorkflowBuilder":
        """Set database path (Phase 6)."""
        self._db_path = db_path
        return self

    def build(self) -> WorkflowContext:
        """Build the workflow context."""
        if self._config is None:
            self._config = BacktestConfig(
                task_id=self.task_id,
                initial_capital=self._initial_capital,
            )

        account_manager = BacktestAccountManager(
            task_id=self.task_id,
            user_id=str(self.user_id),
            initial_cash=self._config.initial_capital,
        )

        return WorkflowContext(
            task_id=self.task_id,
            user_id=self.user_id,
            config=self._config,
            symbols=self._symbols or ["BTCUSDT"],
            strategy_code=self._strategy_code,
            time_range=self._time_range,
            account_manager=account_manager,
            json_data=self._json_data,
            db_path=self._db_path,
        )
