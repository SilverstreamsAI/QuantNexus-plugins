"""
Backtest Workflow Execution

Orchestrates the backtest execution process.
Based on nona_server's backtest_workflow.py pattern.

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

from .config import BacktestConfig
from .account import BacktestAccountManager
from .engine.backtrader_engine import BacktraderEngine
from .checkpoint import CheckpointManager, CheckpointData, get_checkpoint_manager

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
    config: BacktestConfig
    symbols: List[str]
    strategy_code: str
    time_range: Any
    account_manager: BacktestAccountManager

    # Runtime state
    state: WorkflowState = WorkflowState.PENDING
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None

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

        Args:
            context: Workflow context with all parameters

        Returns:
            Dictionary with backtest results
        """
        logger.info(f"Starting workflow: task_id={context.task_id}")
        context.started_at = datetime.now()

        try:
            # Stage 1: Initialize (check for resume)
            self._stage_initialize(context)

            # Stage 1.5: Resume from checkpoint if available
            if context.resume_from_checkpoint:
                self._stage_resume(context)

            # Stage 2: Load Data
            self._stage_load_data(context)

            # Stage 3: Run Backtest
            self._stage_run_backtest(context)

            # Stage 4: Calculate Metrics
            self._stage_calculate_metrics(context)

            # Stage 5: Complete
            self._stage_complete(context)

            return context.result or {}

        except Exception as e:
            logger.error(f"Workflow failed: task_id={context.task_id}, error={e}")
            context.state = WorkflowState.FAILED
            context.error = str(e)
            self._notify_progress(context)
            raise

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
        """Load market data."""
        logger.info(f"Stage: Load Data - task_id={context.task_id}")

        context.state = WorkflowState.LOADING_DATA
        context.progress = 0.1
        context.message = "Loading market data"
        self._notify_progress(context)

        # Data loading is handled by the engine
        # TODO: Integrate with Data Provider plugin
        logger.debug(f"Symbols to load: {context.symbols}")

    def _stage_run_backtest(self, context: WorkflowContext) -> None:
        """Execute the backtest."""
        logger.info(f"Stage: Run Backtest - task_id={context.task_id}")

        context.state = WorkflowState.RUNNING
        context.progress = 0.2
        context.message = "Running backtest"
        self._notify_progress(context)

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
        logger.debug(f"Engine result: {result}")

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
        """Complete the workflow."""
        logger.info(f"Stage: Complete - task_id={context.task_id}")

        context.state = WorkflowState.COMPLETED
        context.progress = 1.0
        context.message = "Backtest completed"
        context.completed_at = datetime.now()
        self._notify_progress(context)

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

        # Cleanup checkpoints on successful completion
        if self.enable_checkpoints:
            deleted = self.checkpoint_manager.cleanup(context.task_id)
            if deleted > 0:
                logger.info(f"Cleaned up {deleted} checkpoints")

        logger.info(
            f"Workflow completed: task_id={context.task_id}, "
            f"trades={len(context.account_manager.trades)}"
        )

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

    Provides a fluent interface for configuring workflows.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self._config: Optional[BacktestConfig] = None
        self._symbols: List[str] = []
        self._strategy_code: str = ""
        self._time_range: Any = None
        self._initial_capital: float = 100000.0

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

    def build(self) -> WorkflowContext:
        """Build the workflow context."""
        if self._config is None:
            self._config = BacktestConfig(
                task_id=self.task_id,
                initial_capital=self._initial_capital,
            )

        account_manager = BacktestAccountManager(
            task_id=self.task_id,
            user_id=self.task_id,
            initial_cash=self._config.initial_capital,
        )

        return WorkflowContext(
            task_id=self.task_id,
            config=self._config,
            symbols=self._symbols or ["BTCUSDT"],
            strategy_code=self._strategy_code,
            time_range=self._time_range,
            account_manager=account_manager,
        )
