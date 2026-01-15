"""
Task Store

Ported from: nona_server/src/db/models/backtest_task.py

Manages backtest task lifecycle and status tracking using SQLite.
Replaces server's MySQL-based BacktestTask.
"""

import logging
import sqlite3
import json
from datetime import datetime
from typing import Dict, Optional, List
from pathlib import Path
from enum import Enum
from ..utils import get_default_db_path

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """
    Task status enumeration.

    Port from: server's TaskStatus model
    """
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskStore:
    """
    Task storage manager for Desktop.

    Port from: server's BacktestTask class

    Manages task lifecycle using SQLite instead of MySQL.

    Usage:
        >>> store = TaskStore()
        >>> task_id = store.create_task(
        ...     task_id="task_123",
        ...     user_id=1,
        ...     symbol="EURUSD",
        ...     test_cases=[...]
        ... )
        >>> store.update_task_status(task_id, TaskStatus.RUNNING)
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize task store.

        Args:
            db_path: Path to SQLite database (optional, uses default if None)
        """
        self.db_path = db_path or get_default_db_path()
        self._ensure_table_exists()
        logger.debug(f"TaskStore initialized with db={self.db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        return conn

    def _ensure_table_exists(self) -> None:
        """
        Ensure backtest_tasks table exists.

        Port from: server's backtest_tasks table schema
        """
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS backtest_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            test_cases TEXT,
            ws_token TEXT,
            status TEXT DEFAULT 'queued',
            project_name TEXT DEFAULT 'DefaultProject',
            start_time TEXT,
            end_time TEXT,
            timeframe TEXT,
            initial_capital REAL,
            order_size_value REAL,
            order_size_unit TEXT,
            result TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """

        create_index_sql = """
        CREATE INDEX IF NOT EXISTS idx_task_id
        ON backtest_tasks(task_id);
        """

        try:
            with self._get_connection() as conn:
                conn.execute(create_table_sql)
                conn.execute(create_index_sql)
                conn.commit()
            logger.debug("Task table ensured in database")
        except Exception as e:
            logger.error(f"Error ensuring table exists: {e}")
            raise

    def create_task(
        self,
        task_id: str,
        user_id: int,
        symbol: str,
        test_cases: list,
        ws_token: Optional[Dict] = None,
        project_name: str = "DefaultProject",
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        timeframe: Optional[str] = None,
        initial_capital: Optional[float] = None,
        order_size_value: Optional[float] = None,
        order_size_unit: Optional[str] = None,
    ) -> str:
        """
        Create a new backtest task.

        Port from: BacktestTask.create_task()

        Args:
            task_id: Unique task identifier
            user_id: User ID
            symbol: Trading symbol
            test_cases: List of test case dictionaries
            ws_token: WebSocket token (optional)
            project_name: Project name (optional)
            start_time: Backtest start time (optional)
            end_time: Backtest end time (optional)
            timeframe: Timeframe string (optional)
            initial_capital: Initial capital (optional)
            order_size_value: Order size value (optional)
            order_size_unit: Order size unit (optional)

        Returns:
            str: Task ID

        Example:
            >>> store = TaskStore()
            >>> task_id = store.create_task(
            ...     task_id="task_123",
            ...     user_id=1,
            ...     symbol="EURUSD",
            ...     test_cases=[{"analysis": "TrendStrategy"}],
            ...     timeframe="1h",
            ...     initial_capital=100000.0
            ... )
        """
        try:
            sql = """
                INSERT INTO backtest_tasks
                (task_id, user_id, symbol, test_cases, ws_token, status, project_name,
                 start_time, end_time, timeframe, initial_capital, order_size_value, order_size_unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            params = (
                task_id,
                user_id,
                symbol,
                json.dumps(test_cases),
                json.dumps(ws_token) if ws_token else None,
                TaskStatus.QUEUED.value,
                project_name,
                start_time,
                end_time,
                timeframe,
                initial_capital,
                order_size_value,
                order_size_unit,
            )

            with self._get_connection() as conn:
                conn.execute(sql, params)
                conn.commit()

            logger.info(
                f"Task created: task_id={task_id}, symbol={symbol}, "
                f"user_id={user_id}, status={TaskStatus.QUEUED.value}"
            )

            return task_id

        except Exception as e:
            logger.error(f"Error creating task {task_id}: {e}")
            raise

    def update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        result: Optional[Dict] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Update task status and result.

        Port from: BacktestTask.update_task_status()

        Args:
            task_id: Task ID
            status: New task status
            result: Task result dictionary (optional)
            error_message: Error message if failed (optional)

        Example:
            >>> store = TaskStore()
            >>> store.update_task_status(
            ...     task_id="task_123",
            ...     status=TaskStatus.COMPLETED,
            ...     result={"final_value": 105000.0, "returns": 5.0}
            ... )
        """
        try:
            sql = """
                UPDATE backtest_tasks
                SET status = ?, result = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE task_id = ?
            """

            params = (
                status.value if isinstance(status, TaskStatus) else status,
                json.dumps(result) if result else None,
                error_message,
                task_id,
            )

            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                conn.commit()

                if cursor.rowcount == 0:
                    logger.warning(f"Task {task_id} not found for status update")

            logger.info(f"Task {task_id} status updated to {status.value if isinstance(status, TaskStatus) else status}")

        except Exception as e:
            logger.error(f"Error updating task {task_id} status: {e}")
            raise

    def update_test_cases(self, task_id: str, test_cases: list) -> None:
        """
        Update test_cases field for a task.

        Port from: BacktestTask.update_test_cases()

        Used for estimation mode where test cases might be modified.

        Args:
            task_id: Task ID
            test_cases: Updated test cases list
        """
        try:
            sql = """
                UPDATE backtest_tasks
                SET test_cases = ?, updated_at = CURRENT_TIMESTAMP
                WHERE task_id = ?
            """

            params = (json.dumps(test_cases), task_id)

            with self._get_connection() as conn:
                conn.execute(sql, params)
                conn.commit()

            logger.debug(f"Task {task_id} test_cases updated")

        except Exception as e:
            logger.error(f"Error updating task {task_id} test_cases: {e}")
            raise

    def get_task(self, task_id: str) -> Optional[Dict]:
        """
        Get task by ID.

        Port from: BacktestTask.get_task()

        Args:
            task_id: Task ID

        Returns:
            dict: Task data or None if not found

        Example:
            >>> store = TaskStore()
            >>> task = store.get_task("task_123")
            >>> if task:
            ...     print(task['status'])
        """
        try:
            sql = """
                SELECT * FROM backtest_tasks
                WHERE task_id = ?
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (task_id,))
                row = cursor.fetchone()

            if not row:
                logger.debug(f"Task {task_id} not found")
                return None

            # Convert Row to dict
            task = dict(row)

            # Parse JSON fields
            if task.get("test_cases"):
                try:
                    task["test_cases"] = json.loads(task["test_cases"])
                except json.JSONDecodeError:
                    pass

            if task.get("ws_token"):
                try:
                    task["ws_token"] = json.loads(task["ws_token"])
                except json.JSONDecodeError:
                    pass

            if task.get("result"):
                try:
                    task["result"] = json.loads(task["result"])
                except json.JSONDecodeError:
                    pass

            return task

        except Exception as e:
            logger.error(f"Error getting task {task_id}: {e}")
            raise

    def get_tasks_by_user(
        self,
        user_id: int,
        status: Optional[TaskStatus] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Get tasks by user ID with optional status filter.

        Args:
            user_id: User ID
            status: Filter by status (optional)
            limit: Maximum number of tasks to return

        Returns:
            list: List of task dictionaries

        Example:
            >>> store = TaskStore()
            >>> tasks = store.get_tasks_by_user(user_id=1, status=TaskStatus.COMPLETED)
            >>> print(len(tasks))
        """
        try:
            if status:
                sql = """
                    SELECT * FROM backtest_tasks
                    WHERE user_id = ? AND status = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """
                params = (user_id, status.value if isinstance(status, TaskStatus) else status, limit)
            else:
                sql = """
                    SELECT * FROM backtest_tasks
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """
                params = (user_id, limit)

            with self._get_connection() as conn:
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()

            tasks = []
            for row in rows:
                task = dict(row)

                # Parse JSON fields
                if task.get("test_cases"):
                    try:
                        task["test_cases"] = json.loads(task["test_cases"])
                    except json.JSONDecodeError:
                        pass

                if task.get("result"):
                    try:
                        task["result"] = json.loads(task["result"])
                    except json.JSONDecodeError:
                        pass

                tasks.append(task)

            logger.debug(f"Retrieved {len(tasks)} tasks for user {user_id}")
            return tasks

        except Exception as e:
            logger.error(f"Error getting tasks for user {user_id}: {e}")
            raise

    def delete_task(self, task_id: str) -> None:
        """
        Delete task by ID.

        Args:
            task_id: Task ID

        Raises:
            ValueError: If task not found
        """
        try:
            sql = "DELETE FROM backtest_tasks WHERE task_id = ?"

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (task_id,))
                conn.commit()

                if cursor.rowcount == 0:
                    raise ValueError(f"Task {task_id} not found")

            logger.info(f"Task {task_id} deleted")

        except Exception as e:
            logger.error(f"Error deleting task {task_id}: {e}")
            raise
