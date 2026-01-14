"""
Strategy Database Loader

Ported from: nona_server/src/stock_data/strategy_db_manager.py

Loads strategies from SQLite database (Desktop version).
Replaces server's MySQL-based StrategyDBManager.
"""

import logging
import sqlite3
from datetime import datetime
from typing import Optional, Dict, List
from pathlib import Path

logger = logging.getLogger(__name__)


class StrategyDatabaseLoader:
    """
    Strategy database loader for Desktop.

    Loads strategy code and metadata from SQLite database.
    Port of server's StrategyDBManager with SQLite adaptation.

    Usage:
        >>> loader = StrategyDatabaseLoader()
        >>> strategy = loader.get_strategy_by_name("MyStrategy")
        >>> print(strategy['code'])
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize strategy database loader.

        Args:
            db_path: Path to SQLite database (optional, uses default if None)
        """
        self.db_path = db_path or self._get_default_db_path()
        self.strategy_table = "nona_algorithms"
        self._ensure_table_exists()
        logger.debug(f"StrategyDatabaseLoader initialized with db={self.db_path}")

    def _get_default_db_path(self) -> str:
        """Get default database path."""
        # TODO: Replace with actual Desktop database path
        # For now, use a relative path
        db_path = Path(__file__).parent.parent.parent.parent.parent.parent / "data" / "nexus.db"
        return str(db_path)

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        return conn

    def _ensure_table_exists(self) -> None:
        """
        Ensure strategy table exists in database.

        Creates table if not exists with schema matching server's MySQL table.
        """
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS nona_algorithms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            strategy_name TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            description TEXT,
            pnl REAL DEFAULT 0.0,
            status INTEGER DEFAULT 1,
            strategy_type INTEGER DEFAULT 0,
            activate INTEGER DEFAULT 1,
            prompt_template TEXT,
            metadata TEXT,
            classification_metadata TEXT,
            strategy_rules TEXT,
            is_system INTEGER DEFAULT 0,
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            update_time DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """

        create_index_sql = """
        CREATE INDEX IF NOT EXISTS idx_strategy_name
        ON nona_algorithms(strategy_name);
        """

        try:
            with self._get_connection() as conn:
                conn.execute(create_table_sql)
                conn.execute(create_index_sql)
                conn.commit()
            logger.debug("Strategy table ensured in database")
        except Exception as e:
            logger.error(f"Error ensuring table exists: {e}")
            raise

    def save_strategy(
        self,
        code: str,
        strategy_name: str,
        user_id: int,
        description: Optional[str] = None,
        pnl: float = 0.0,
        status: int = 1,
        strategy_type: int = 0,
        activate: int = 1,
        classification_metadata: Optional[str] = None,
        strategy_rules: Optional[str] = None,
    ) -> int:
        """
        Save strategy to database.

        Port from: server's StrategyDBManager.save_strategy()

        Args:
            code: Strategy code (Python code as string)
            strategy_name: Strategy name
            user_id: User ID
            description: Strategy description (optional)
            pnl: Strategy PnL (optional)
            status: Strategy status (1=active, 0=inactive)
            strategy_type: Strategy type (0-9)
            activate: Is activated (1=yes, 0=no)
            classification_metadata: JSON string with classification info
            strategy_rules: JSON string with strategy rules/blueprint

        Returns:
            int: Strategy ID (inserted row ID)

        Raises:
            Exception: If save fails
        """
        try:
            columns = [
                "code", "strategy_name", "user_id", "description",
                "pnl", "status", "strategy_type", "activate"
            ]
            values = [
                code, strategy_name, user_id, description,
                pnl, status, strategy_type, activate
            ]

            if classification_metadata is not None:
                columns.append("classification_metadata")
                values.append(classification_metadata)

            if strategy_rules is not None:
                columns.append("strategy_rules")
                values.append(strategy_rules)

            columns.extend(["create_time", "update_time"])
            placeholders = ", ".join(["?"] * len(values)) + ", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP"

            sql = f"""
                INSERT INTO nona_algorithms
                ({", ".join(columns)})
                VALUES ({placeholders})
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, tuple(values))
                conn.commit()
                strategy_id = cursor.lastrowid

            logger.info(
                f"Strategy '{strategy_name}' saved successfully with ID: {strategy_id}"
            )
            return strategy_id

        except Exception as e:
            logger.error(f"Error saving strategy: {e}")
            raise

    def get_strategy_by_id(self, strategy_id: int) -> Optional[Dict]:
        """
        Get strategy by ID.

        Port from: server's StrategyDBManager.load_strategy()

        Args:
            strategy_id: Strategy ID

        Returns:
            dict: Strategy data or None if not found

        Raises:
            ValueError: If strategy not found
        """
        try:
            sql = """
                SELECT
                    id, code, strategy_name, user_id, description,
                    pnl, status, strategy_type, activate,
                    prompt_template, metadata, classification_metadata,
                    strategy_rules, is_system, create_time, update_time
                FROM nona_algorithms
                WHERE id = ?
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (strategy_id,))
                row = cursor.fetchone()

            if not row:
                raise ValueError(f"Strategy with ID {strategy_id} not found")

            return dict(row)

        except Exception as e:
            logger.error(f"Error loading strategy: {e}")
            raise

    def get_strategy_by_name(self, strategy_name: str) -> Optional[Dict]:
        """
        Get strategy by name (latest active version).

        Port from: server's StrategyDBManager.get_strategy_by_name()

        Args:
            strategy_name: Strategy name

        Returns:
            dict: Strategy data or None if not found

        Example:
            >>> loader = StrategyDatabaseLoader()
            >>> strategy = loader.get_strategy_by_name("TrendStrategy")
            >>> if strategy:
            ...     print(strategy['code'])
        """
        try:
            sql = """
                SELECT
                    id, code, strategy_name, user_id, description,
                    pnl, status, strategy_type, activate,
                    prompt_template, metadata, classification_metadata,
                    strategy_rules, is_system, create_time, update_time
                FROM nona_algorithms
                WHERE strategy_name = ?
                AND status = 1
                AND activate = 1
                ORDER BY update_time DESC
                LIMIT 1
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (strategy_name,))
                row = cursor.fetchone()

            if not row:
                logger.warning(f"Strategy '{strategy_name}' not found")
                return None

            return dict(row)

        except Exception as e:
            logger.error(f"Error loading strategy by name '{strategy_name}': {e}")
            raise

    def get_all_strategies(
        self,
        user_id: Optional[int] = None,
        status: Optional[int] = None,
        activate: Optional[int] = None,
    ) -> List[Dict]:
        """
        Get all strategies with optional filters.

        Args:
            user_id: Filter by user ID (optional)
            status: Filter by status (optional)
            activate: Filter by activate flag (optional)

        Returns:
            list: List of strategy dictionaries

        Example:
            >>> loader = StrategyDatabaseLoader()
            >>> strategies = loader.get_all_strategies(user_id=1, status=1)
            >>> print(len(strategies))
        """
        try:
            where_clauses = []
            params = []

            if user_id is not None:
                where_clauses.append("user_id = ?")
                params.append(user_id)

            if status is not None:
                where_clauses.append("status = ?")
                params.append(status)

            if activate is not None:
                where_clauses.append("activate = ?")
                params.append(activate)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            sql = f"""
                SELECT
                    id, code, strategy_name, user_id, description,
                    pnl, status, strategy_type, activate,
                    prompt_template, metadata, classification_metadata,
                    strategy_rules, is_system, create_time, update_time
                FROM nona_algorithms
                {where_sql}
                ORDER BY update_time DESC
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, tuple(params))
                rows = cursor.fetchall()

            return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting all strategies: {e}")
            raise

    def update_strategy(
        self,
        strategy_id: int,
        code: Optional[str] = None,
        description: Optional[str] = None,
        pnl: Optional[float] = None,
        status: Optional[int] = None,
        strategy_type: Optional[int] = None,
    ) -> None:
        """
        Update existing strategy.

        Port from: server's StrategyDBManager.update_strategy()

        Args:
            strategy_id: Strategy ID
            code: New code (optional)
            description: New description (optional)
            pnl: New PnL (optional)
            status: New status (optional)
            strategy_type: New type (optional)

        Raises:
            ValueError: If no fields to update or strategy not found
        """
        try:
            update_fields = []
            params = []

            if code is not None:
                update_fields.append("code = ?")
                params.append(code)
            if description is not None:
                update_fields.append("description = ?")
                params.append(description)
            if pnl is not None:
                update_fields.append("pnl = ?")
                params.append(pnl)
            if status is not None:
                update_fields.append("status = ?")
                params.append(status)
            if strategy_type is not None:
                update_fields.append("strategy_type = ?")
                params.append(strategy_type)

            if not update_fields:
                raise ValueError("No fields to update")

            # Always update update_time
            update_fields.append("update_time = CURRENT_TIMESTAMP")
            params.append(strategy_id)

            sql = f"""
                UPDATE nona_algorithms
                SET {", ".join(update_fields)}
                WHERE id = ?
            """

            with self._get_connection() as conn:
                cursor = conn.execute(sql, tuple(params))
                conn.commit()

                if cursor.rowcount == 0:
                    raise ValueError(f"Strategy with ID {strategy_id} not found")

            logger.info(f"Strategy {strategy_id} updated successfully")

        except Exception as e:
            logger.error(f"Error updating strategy: {e}")
            raise

    def delete_strategy(self, strategy_id: int) -> None:
        """
        Delete strategy by ID.

        Args:
            strategy_id: Strategy ID

        Raises:
            ValueError: If strategy not found
        """
        try:
            sql = "DELETE FROM nona_algorithms WHERE id = ?"

            with self._get_connection() as conn:
                cursor = conn.execute(sql, (strategy_id,))
                conn.commit()

                if cursor.rowcount == 0:
                    raise ValueError(f"Strategy with ID {strategy_id} not found")

            logger.info(f"Strategy {strategy_id} deleted successfully")

        except Exception as e:
            logger.error(f"Error deleting strategy: {e}")
            raise
