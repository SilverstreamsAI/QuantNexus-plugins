"""
Storage module for backtest results and task management.

Phase 3: Result Storage System (Desktop Implementation)

Replaces server's Redis-based storage with SQLite.
"""

from .task_store import TaskStore, TaskStatus
from .result_store import ResultStore, store_strategy_results

__all__ = [
    "TaskStore",
    "TaskStatus",
    "ResultStore",
    "store_strategy_results",
]
