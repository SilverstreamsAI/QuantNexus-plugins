"""
Progress Tracker

Ported from: nona_server/src/worker/redis_progress_tracker.py
             and src/db/models/backtest_task_status.py

Manages backtest progress tracking and notifications.
Simplified version for Desktop (callback-based instead of Redis).
"""

import logging
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ProgressPhase(Enum):
    """
    Backtest progress phases.

    Port from: server's backtest workflow phases
    """
    INITIALIZING = "initializing"
    LOADING_DATA = "loading_data"
    PREPARING_STRATEGIES = "preparing_strategies"
    RUNNING_BACKTEST = "running_backtest"
    STORING_RESULTS = "storing_results"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProgressUpdate:
    """
    Progress update data structure.

    Contains all information about current backtest progress.
    """
    task_id: str
    phase: ProgressPhase
    current: int
    total: int
    percentage: float
    message: str
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "phase": self.phase.value,
            "current": self.current,
            "total": self.total,
            "percentage": self.percentage,
            "message": self.message,
            "metadata": self.metadata or {}
        }


class ProgressTracker:
    """
    Progress tracker for backtest execution.

    Port from: server's RedisProgressTracker + BacktestTaskStatus

    Simplified version for Desktop using callbacks instead of Redis.

    Usage:
        >>> def on_progress(update: ProgressUpdate):
        ...     print(f"{update.phase.value}: {update.percentage:.1f}%")
        ...
        >>> tracker = ProgressTracker(
        ...     task_id="task_123",
        ...     on_progress=on_progress
        ... )
        >>> tracker.set_phase(ProgressPhase.LOADING_DATA, "Loading market data")
        >>> tracker.set_total_bars(1000)
        >>> tracker.update_bars_loaded(500)  # 50% progress
    """

    def __init__(
        self,
        task_id: str,
        on_progress: Optional[Callable[[ProgressUpdate], None]] = None
    ):
        """
        Initialize progress tracker.

        Args:
            task_id: Task identifier
            on_progress: Progress update callback (optional)
        """
        self.task_id = task_id
        self.on_progress = on_progress

        # Progress state
        self.current_phase = ProgressPhase.INITIALIZING
        self.total_bars = 0
        self.processed_bars = 0
        self.left_bars = 0
        self.current_message = ""

        logger.debug(f"ProgressTracker initialized for task {task_id}")

    def set_phase(
        self,
        phase: ProgressPhase,
        message: str = "",
        metadata: Optional[Dict] = None
    ) -> None:
        """
        Set current progress phase.

        Args:
            phase: New phase
            message: Progress message
            metadata: Additional metadata (optional)
        """
        self.current_phase = phase
        self.current_message = message

        logger.info(f"Task {self.task_id}: {phase.value} - {message}")

        self._notify_progress(metadata=metadata)

    def set_total_bars(self, total: int) -> None:
        """
        Set total number of bars to process.

        Port from: RedisProgressTracker.set_total_bars()

        Args:
            total: Total bar count
        """
        self.total_bars = total
        self.left_bars = total
        self.processed_bars = 0

        logger.debug(
            f"Task {self.task_id}: Set total bars to {total}"
        )

        self._notify_progress()

    def set_left_bars(self, left: int) -> None:
        """
        Set number of bars left to process.

        Port from: RedisProgressTracker.set_left_bars()

        Args:
            left: Remaining bar count
        """
        self.left_bars = left
        self.processed_bars = self.total_bars - left

        logger.debug(
            f"Task {self.task_id}: {self.processed_bars}/{self.total_bars} bars processed"
        )

        self._notify_progress()

    def update_bars_loaded(self, loaded: int) -> None:
        """
        Update number of bars loaded (for data loading phase).

        Args:
            loaded: Number of bars loaded so far
        """
        if self.total_bars > 0:
            self.processed_bars = loaded
            self.left_bars = self.total_bars - loaded

            logger.debug(
                f"Task {self.task_id}: Loaded {loaded}/{self.total_bars} bars"
            )

            self._notify_progress()

    def update_bars_processed(self, processed: int) -> None:
        """
        Update number of bars processed (for backtest execution phase).

        Args:
            processed: Number of bars processed so far
        """
        if self.total_bars > 0:
            self.processed_bars = processed
            self.left_bars = self.total_bars - processed

            logger.debug(
                f"Task {self.task_id}: Processed {processed}/{self.total_bars} bars"
            )

            self._notify_progress()

    def increment_processed(self, count: int = 1) -> None:
        """
        Increment processed bar count.

        Args:
            count: Number of bars to add (default: 1)
        """
        self.processed_bars += count
        self.left_bars = max(0, self.total_bars - self.processed_bars)

        self._notify_progress()

    def set_completed(self, message: str = "Backtest completed") -> None:
        """
        Mark progress as completed.

        Args:
            message: Completion message
        """
        self.current_phase = ProgressPhase.COMPLETED
        self.current_message = message
        self.processed_bars = self.total_bars
        self.left_bars = 0

        logger.info(f"Task {self.task_id}: Completed - {message}")

        self._notify_progress()

    def set_failed(self, error_message: str) -> None:
        """
        Mark progress as failed.

        Args:
            error_message: Error message
        """
        self.current_phase = ProgressPhase.FAILED
        self.current_message = error_message

        logger.error(f"Task {self.task_id}: Failed - {error_message}")

        self._notify_progress()

    def get_percentage(self) -> float:
        """
        Calculate current progress percentage.

        Returns:
            float: Progress percentage (0-100)
        """
        if self.total_bars == 0:
            return 0.0

        return (self.processed_bars / self.total_bars) * 100.0

    def _notify_progress(self, metadata: Optional[Dict] = None) -> None:
        """
        Send progress update via callback.

        Args:
            metadata: Additional metadata (optional)
        """
        if not self.on_progress:
            return

        update = ProgressUpdate(
            task_id=self.task_id,
            phase=self.current_phase,
            current=self.processed_bars,
            total=self.total_bars,
            percentage=self.get_percentage(),
            message=self.current_message,
            metadata=metadata
        )

        try:
            self.on_progress(update)
        except Exception as e:
            logger.error(
                f"Error in progress callback for task {self.task_id}: {e}",
                exc_info=True
            )


def create_progress_callbacks(
    tracker: ProgressTracker
) -> tuple[Callable, Callable]:
    """
    Create progress callbacks for data loading.

    Port from: backtest_workflow.py on_bars_estimated / on_data_retrieved

    Creates callback functions compatible with DataLoader.

    Args:
        tracker: ProgressTracker instance

    Returns:
        tuple: (on_bars_estimated, on_data_retrieved) callbacks

    Example:
        >>> tracker = ProgressTracker(task_id="task_123")
        >>> on_bars_est, on_data_ret = create_progress_callbacks(tracker)
        >>> loader = DataLoader()
        >>> data = loader.load(
        ...     ...,
        ...     on_bars_estimated=on_bars_est,
        ...     on_data_retrieved=on_data_ret
        ... )
    """
    def on_bars_estimated(identifier: str, timeframe: str, estimated_bars: int):
        """Callback when bar count is estimated."""
        tracker.set_phase(
            ProgressPhase.LOADING_DATA,
            f"Loading {estimated_bars} bars of {identifier} ({timeframe})",
            metadata={"symbol": identifier, "timeframe": timeframe}
        )
        tracker.set_total_bars(estimated_bars)

    def on_data_retrieved(identifier: str, timeframe: str, actual_bars: int):
        """Callback when data is actually retrieved."""
        tracker.set_total_bars(actual_bars)
        tracker.update_bars_loaded(actual_bars)
        tracker.set_phase(
            ProgressPhase.LOADING_DATA,
            f"Loaded {actual_bars} bars of {identifier} ({timeframe})",
            metadata={"symbol": identifier, "timeframe": timeframe}
        )

    return on_bars_estimated, on_data_retrieved


def create_strategy_progress_callback(
    tracker: ProgressTracker,
    total_strategies: int
) -> Callable[[int, str], None]:
    """
    Create progress callback for strategy execution.

    Args:
        tracker: ProgressTracker instance
        total_strategies: Total number of strategies

    Returns:
        Callable: Strategy progress callback

    Example:
        >>> tracker = ProgressTracker(task_id="task_123")
        >>> on_strategy = create_strategy_progress_callback(tracker, 3)
        >>> on_strategy(1, "TrendStrategy")  # Strategy 1 of 3
    """
    def on_strategy_progress(current: int, strategy_name: str):
        """Callback for strategy execution progress."""
        percentage = (current / total_strategies) * 100.0
        tracker.set_phase(
            ProgressPhase.RUNNING_BACKTEST,
            f"Running strategy {current}/{total_strategies}: {strategy_name}",
            metadata={"current_strategy": current, "total_strategies": total_strategies}
        )

    return on_strategy_progress
