"""
Progress tracking module for backtest execution.

Phase 4: Progress Tracking System (Desktop Implementation)

Provides callback-based progress tracking instead of Redis.
"""

from .tracker import (
    ProgressTracker,
    ProgressPhase,
    ProgressUpdate,
    create_progress_callbacks,
    create_strategy_progress_callback,
)

__all__ = [
    "ProgressTracker",
    "ProgressPhase",
    "ProgressUpdate",
    "create_progress_callbacks",
    "create_strategy_progress_callback",
]
