"""
Checkpoint Storage - SQLite Backend

Provides persistent storage for backtest checkpoints.
Designed for standalone operation without external database dependencies.
"""

import sqlite3
import json
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class CheckpointStorage:
    """
    SQLite-based checkpoint storage.

    Provides persistent storage for backtest checkpoints,
    enabling resume capability for interrupted backtests.

    Attributes:
        db_path: Path to SQLite database file
    """

    # Default database location
    DEFAULT_DB_PATH = "data/checkpoints.db"

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize storage.

        Args:
            db_path: Path to database file. Creates parent directories if needed.
        """
        self.db_path = Path(db_path or self.DEFAULT_DB_PATH)
        self._ensure_db_exists()
        logger.info(f"CheckpointStorage initialized: db_path={self.db_path}")

    def _ensure_db_exists(self) -> None:
        """Ensure database and tables exist."""
        # Create parent directories
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Create tables
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS checkpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    bar_index INTEGER NOT NULL,
                    checkpoint_data TEXT NOT NULL,
                    strategy_version TEXT,
                    checkpoint_version INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    UNIQUE(task_id, bar_index)
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id
                ON checkpoints(task_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_checkpoints_task_bar
                ON checkpoints(task_id, bar_index DESC)
            """)
            conn.commit()

    @contextmanager
    def _get_connection(self):
        """Get database connection with context management."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def save(
        self,
        task_id: str,
        bar_index: int,
        checkpoint_data: Dict[str, Any],
        strategy_version: Optional[str] = None,
        checkpoint_version: int = 1,
    ) -> bool:
        """
        Save a checkpoint.

        Args:
            task_id: Task identifier
            bar_index: Current bar index
            checkpoint_data: Checkpoint data dictionary
            strategy_version: Strategy version identifier
            checkpoint_version: Checkpoint format version

        Returns:
            True if saved successfully
        """
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO checkpoints
                    (task_id, bar_index, checkpoint_data, strategy_version,
                     checkpoint_version, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    task_id,
                    bar_index,
                    json.dumps(checkpoint_data, default=str),
                    strategy_version,
                    checkpoint_version,
                    datetime.now().isoformat(),
                ))
                conn.commit()

            logger.debug(f"Checkpoint saved: task_id={task_id}, bar_index={bar_index}")
            return True

        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            return False

    def load_latest(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Load the latest checkpoint for a task.

        Args:
            task_id: Task identifier

        Returns:
            Checkpoint data dictionary or None if not found
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT checkpoint_data, bar_index, strategy_version,
                           checkpoint_version, created_at
                    FROM checkpoints
                    WHERE task_id = ?
                    ORDER BY bar_index DESC
                    LIMIT 1
                """, (task_id,))
                row = cursor.fetchone()

            if not row:
                logger.debug(f"No checkpoint found: task_id={task_id}")
                return None

            checkpoint = json.loads(row["checkpoint_data"])
            checkpoint["_meta"] = {
                "bar_index": row["bar_index"],
                "strategy_version": row["strategy_version"],
                "checkpoint_version": row["checkpoint_version"],
                "created_at": row["created_at"],
            }

            logger.info(
                f"Checkpoint loaded: task_id={task_id}, "
                f"bar_index={row['bar_index']}"
            )
            return checkpoint

        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return None

    def load_all(self, task_id: str) -> List[Dict[str, Any]]:
        """
        Load all checkpoints for a task.

        Args:
            task_id: Task identifier

        Returns:
            List of checkpoint data dictionaries, ordered by bar_index DESC
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT checkpoint_data, bar_index, strategy_version,
                           checkpoint_version, created_at
                    FROM checkpoints
                    WHERE task_id = ?
                    ORDER BY bar_index DESC
                """, (task_id,))
                rows = cursor.fetchall()

            checkpoints = []
            for row in rows:
                checkpoint = json.loads(row["checkpoint_data"])
                checkpoint["_meta"] = {
                    "bar_index": row["bar_index"],
                    "strategy_version": row["strategy_version"],
                    "checkpoint_version": row["checkpoint_version"],
                    "created_at": row["created_at"],
                }
                checkpoints.append(checkpoint)

            return checkpoints

        except Exception as e:
            logger.error(f"Failed to load checkpoints: {e}")
            return []

    def delete(self, task_id: str) -> int:
        """
        Delete all checkpoints for a task.

        Args:
            task_id: Task identifier

        Returns:
            Number of checkpoints deleted
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    DELETE FROM checkpoints WHERE task_id = ?
                """, (task_id,))
                deleted = cursor.rowcount
                conn.commit()

            logger.info(f"Checkpoints deleted: task_id={task_id}, count={deleted}")
            return deleted

        except Exception as e:
            logger.error(f"Failed to delete checkpoints: {e}")
            return 0

    def cleanup_old(self, task_id: str, keep_count: int = 5) -> int:
        """
        Keep only the latest N checkpoints for a task.

        Args:
            task_id: Task identifier
            keep_count: Number of checkpoints to keep

        Returns:
            Number of checkpoints deleted
        """
        try:
            with self._get_connection() as conn:
                # Get IDs to keep
                cursor = conn.execute("""
                    SELECT id FROM checkpoints
                    WHERE task_id = ?
                    ORDER BY bar_index DESC
                    LIMIT ?
                """, (task_id, keep_count))
                keep_ids = [row["id"] for row in cursor.fetchall()]

                if not keep_ids:
                    return 0

                # Delete older checkpoints
                placeholders = ",".join("?" * len(keep_ids))
                cursor = conn.execute(f"""
                    DELETE FROM checkpoints
                    WHERE task_id = ? AND id NOT IN ({placeholders})
                """, (task_id, *keep_ids))
                deleted = cursor.rowcount
                conn.commit()

            if deleted > 0:
                logger.debug(
                    f"Old checkpoints cleaned: task_id={task_id}, "
                    f"deleted={deleted}"
                )
            return deleted

        except Exception as e:
            logger.error(f"Failed to cleanup checkpoints: {e}")
            return 0

    def get_checkpoint_count(self, task_id: str) -> int:
        """Get number of checkpoints for a task."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT COUNT(*) as count FROM checkpoints WHERE task_id = ?
                """, (task_id,))
                row = cursor.fetchone()
                return row["count"] if row else 0
        except Exception as e:
            logger.error(f"Failed to count checkpoints: {e}")
            return 0

    def list_tasks(self) -> List[Dict[str, Any]]:
        """
        List all tasks with checkpoints.

        Returns:
            List of task summaries with latest checkpoint info
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT task_id,
                           MAX(bar_index) as latest_bar,
                           COUNT(*) as checkpoint_count,
                           MAX(created_at) as latest_at
                    FROM checkpoints
                    GROUP BY task_id
                    ORDER BY latest_at DESC
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to list tasks: {e}")
            return []
