"""
CheckpointManager - Backtest Resume Capability

Manages periodic checkpoint saving and restoration for backtest resume.
Based on nona_server's checkpoint_manager.py pattern.

Features:
1. Periodic checkpoint saving (every N bars)
2. Resume from latest checkpoint
3. Warmup period for indicator restoration
4. Automatic cleanup of old checkpoints
"""

import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from datetime import datetime

from .storage import CheckpointStorage

logger = logging.getLogger(__name__)


@dataclass
class CheckpointConfig:
    """
    Checkpoint configuration.

    Attributes:
        enabled: Whether checkpointing is enabled
        interval: Save interval (bars between saves)
        max_count: Maximum checkpoints to keep per task
        warmup_period: Bars to replay for indicator warmup
        cleanup_on_complete: Delete checkpoints after task completes
        version: Checkpoint format version
    """
    enabled: bool = True
    interval: int = 50
    max_count: int = 5
    warmup_period: int = 50
    cleanup_on_complete: bool = True
    version: int = 1


@dataclass
class BrokerState:
    """Broker state snapshot."""
    cash: float
    value: float
    commission_paid: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BrokerState":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class PositionState:
    """Position state snapshot."""
    symbol: str
    size: float
    price: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PositionState":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class CheckpointData:
    """
    Complete checkpoint data structure.

    Contains all state needed to resume a backtest.
    """
    task_id: str
    bar_index: int
    checkpoint_type: str = "warmup"

    # Core state
    broker: Optional[Dict[str, Any]] = None
    positions: List[Dict[str, Any]] = field(default_factory=list)
    open_orders: List[Dict[str, Any]] = field(default_factory=list)

    # Data info
    data_info: Optional[Dict[str, Any]] = None

    # Strategy state (custom per strategy)
    strategy_state: Optional[Dict[str, Any]] = None

    # Account metrics at checkpoint
    metrics: Optional[Dict[str, Any]] = None

    # Metadata
    warmup_period: int = 50
    strategy_version: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckpointData":
        """Create from dictionary."""
        return cls(**{k: v for k, v in data.items()
                     if k in cls.__dataclass_fields__})


class CheckpointManager:
    """
    Checkpoint Manager - Save and restore backtest state.

    Responsibilities:
    1. Periodic checkpoint saving (every N bars)
    2. Resume from latest checkpoint
    3. Warmup period for indicator restoration
    4. Automatic cleanup of old checkpoints

    Usage:
        manager = CheckpointManager()

        # During backtest
        if manager.should_save(bar_index):
            manager.save(task_id, bar_index, checkpoint_data)

        # To resume
        checkpoint = manager.load(task_id)
        if checkpoint:
            # Restore state and continue from checkpoint.bar_index
            pass

        # After completion
        manager.cleanup(task_id)
    """

    _instance: Optional["CheckpointManager"] = None

    def __new__(cls, *args, **kwargs) -> "CheckpointManager":
        """Singleton pattern for shared state."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(
        self,
        config: Optional[CheckpointConfig] = None,
        storage: Optional[CheckpointStorage] = None,
    ):
        """
        Initialize manager.

        Args:
            config: Checkpoint configuration
            storage: Storage backend (defaults to SQLite)
        """
        if self._initialized:
            return

        self.config = config or CheckpointConfig()
        self.storage = storage or CheckpointStorage()
        self._initialized = True

        logger.info(
            f"CheckpointManager initialized: "
            f"enabled={self.config.enabled}, interval={self.config.interval}, "
            f"max_count={self.config.max_count}, warmup={self.config.warmup_period}"
        )

    def should_save(self, bar_index: int) -> bool:
        """
        Check if checkpoint should be saved at this bar.

        Args:
            bar_index: Current bar index

        Returns:
            True if checkpoint should be saved
        """
        if not self.config.enabled:
            return False

        # Don't save on first bar
        if bar_index <= 0:
            return False

        # Save every N bars
        return bar_index % self.config.interval == 0

    def save(
        self,
        task_id: str,
        bar_index: int,
        checkpoint_data: CheckpointData,
        strategy_version: Optional[str] = None,
    ) -> bool:
        """
        Save a checkpoint.

        Args:
            task_id: Task identifier
            bar_index: Current bar index
            checkpoint_data: Checkpoint data to save
            strategy_version: Strategy version identifier

        Returns:
            True if saved successfully
        """
        if not self.config.enabled:
            return False

        # Set metadata
        checkpoint_data.task_id = task_id
        checkpoint_data.bar_index = bar_index
        checkpoint_data.warmup_period = self.config.warmup_period
        checkpoint_data.strategy_version = strategy_version
        checkpoint_data.created_at = datetime.now().isoformat()

        # Save to storage
        success = self.storage.save(
            task_id=task_id,
            bar_index=bar_index,
            checkpoint_data=checkpoint_data.to_dict(),
            strategy_version=strategy_version,
            checkpoint_version=self.config.version,
        )

        if success:
            logger.debug(f"Checkpoint saved: task_id={task_id}, bar_index={bar_index}")
            # Cleanup old checkpoints
            self.storage.cleanup_old(task_id, self.config.max_count)

        return success

    def load(self, task_id: str) -> Optional[CheckpointData]:
        """
        Load the latest checkpoint for a task.

        Args:
            task_id: Task identifier

        Returns:
            CheckpointData or None if not found
        """
        data = self.storage.load_latest(task_id)
        if not data:
            return None

        # Remove metadata before creating CheckpointData
        data.pop("_meta", None)

        checkpoint = CheckpointData.from_dict(data)
        logger.info(
            f"Checkpoint loaded: task_id={task_id}, "
            f"bar_index={checkpoint.bar_index}"
        )
        return checkpoint

    def load_all(self, task_id: str) -> List[CheckpointData]:
        """
        Load all checkpoints for a task.

        Args:
            task_id: Task identifier

        Returns:
            List of CheckpointData, ordered by bar_index DESC
        """
        data_list = self.storage.load_all(task_id)
        checkpoints = []
        for data in data_list:
            data.pop("_meta", None)
            checkpoints.append(CheckpointData.from_dict(data))
        return checkpoints

    def cleanup(self, task_id: str) -> int:
        """
        Delete all checkpoints for a task.

        Args:
            task_id: Task identifier

        Returns:
            Number of checkpoints deleted
        """
        if not self.config.cleanup_on_complete:
            return 0

        deleted = self.storage.delete(task_id)
        logger.info(f"Checkpoints cleaned up: task_id={task_id}, deleted={deleted}")
        return deleted

    def has_checkpoint(self, task_id: str) -> bool:
        """Check if a task has any checkpoints."""
        return self.storage.get_checkpoint_count(task_id) > 0

    def get_resume_bar(self, task_id: str) -> int:
        """
        Get the bar index to resume from (accounting for warmup).

        Args:
            task_id: Task identifier

        Returns:
            Bar index to start from (checkpoint bar - warmup period),
            or 0 if no checkpoint exists
        """
        checkpoint = self.load(task_id)
        if not checkpoint:
            return 0

        # Calculate resume point with warmup
        resume_bar = max(0, checkpoint.bar_index - checkpoint.warmup_period)
        logger.info(
            f"Resume calculation: checkpoint_bar={checkpoint.bar_index}, "
            f"warmup={checkpoint.warmup_period}, resume_bar={resume_bar}"
        )
        return resume_bar

    def create_checkpoint_data(
        self,
        task_id: str,
        bar_index: int,
        broker_state: Optional[BrokerState] = None,
        positions: Optional[List[PositionState]] = None,
        strategy_state: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> CheckpointData:
        """
        Create a CheckpointData instance with common fields.

        Args:
            task_id: Task identifier
            bar_index: Current bar index
            broker_state: Broker state snapshot
            positions: List of position states
            strategy_state: Strategy-specific state
            metrics: Performance metrics at checkpoint

        Returns:
            CheckpointData instance
        """
        return CheckpointData(
            task_id=task_id,
            bar_index=bar_index,
            broker=broker_state.to_dict() if broker_state else None,
            positions=[p.to_dict() for p in positions] if positions else [],
            strategy_state=strategy_state,
            metrics=metrics,
            warmup_period=self.config.warmup_period,
        )


def get_checkpoint_manager(
    config: Optional[CheckpointConfig] = None,
    storage: Optional[CheckpointStorage] = None,
) -> CheckpointManager:
    """
    Get the singleton CheckpointManager instance.

    Args:
        config: Optional configuration (only used on first call)
        storage: Optional storage backend (only used on first call)

    Returns:
        CheckpointManager instance
    """
    return CheckpointManager(config=config, storage=storage)
