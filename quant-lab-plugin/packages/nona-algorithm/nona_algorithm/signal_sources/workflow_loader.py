"""
Workflow Loader

TICKET_264: Load exported workflows from signal_source_registry database.

Provides functions to query and instantiate WorkflowSignalSource instances
from workflows exported by Strategy Builder.
"""

import json
import os
from typing import List, Optional
from pathlib import Path

from .workflow_signal_source import (
    WorkflowSignalSource,
    ExportedWorkflowConfig,
    ComponentConfig,
    BacktestMetrics,
)


def get_database_path() -> str:
    """
    Get the path to the QuantNexus database.

    Returns:
        Path to quantnexus.db
    """
    # Check environment variable first
    db_path = os.environ.get('QUANTNEXUS_DB_PATH')
    if db_path and os.path.exists(db_path):
        return db_path

    # Try common locations
    possible_paths = [
        # Development path
        Path(__file__).parent.parent.parent.parent.parent.parent.parent / 'apps/desktop/data/quantnexus.db',
        # User data path (Linux)
        Path.home() / '.config/@quantnexus/desktop/quantnexus.db',
        # User data path (macOS)
        Path.home() / 'Library/Application Support/@quantnexus/desktop/quantnexus.db',
        # User data path (Windows)
        Path(os.environ.get('APPDATA', '')) / '@quantnexus/desktop/quantnexus.db',
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    # Default to development path
    return str(possible_paths[0])


def _row_to_config(row: dict) -> ExportedWorkflowConfig:
    """
    Convert database row to ExportedWorkflowConfig.

    Args:
        row: Database row as dictionary

    Returns:
        ExportedWorkflowConfig instance
    """
    # Parse JSON fields
    analysis_params = json.loads(row.get('analysis_parameters') or '{}')
    entry_params = json.loads(row.get('entry_parameters') or '{}')
    exit_params = json.loads(row.get('exit_parameters') or '{}') if row.get('exit_parameters') else {}

    # Build analysis component
    analysis = ComponentConfig(
        algorithm_id=row['analysis_algorithm_id'],
        algorithm_name=row['analysis_algorithm_name'],
        algorithm_code=row['analysis_algorithm_code'],
        base_class=row['analysis_base_class'],
        timeframe=row['analysis_timeframe'],
        parameters=analysis_params,
    )

    # Build entry component
    entry = ComponentConfig(
        algorithm_id=row['entry_algorithm_id'],
        algorithm_name=row['entry_algorithm_name'],
        algorithm_code=row['entry_algorithm_code'],
        base_class=row['entry_base_class'],
        timeframe=row['entry_timeframe'],
        parameters=entry_params,
    )

    # Build exit component (optional)
    exit_comp = None
    if row.get('exit_algorithm_id'):
        exit_comp = ComponentConfig(
            algorithm_id=row['exit_algorithm_id'],
            algorithm_name=row['exit_algorithm_name'],
            algorithm_code=row['exit_algorithm_code'],
            base_class=row['exit_base_class'],
            timeframe=row['exit_timeframe'],
            parameters=exit_params,
        )

    # Build backtest metrics
    metrics = None
    if row.get('backtest_sharpe') is not None:
        metrics = BacktestMetrics(
            sharpe=row['backtest_sharpe'],
            max_drawdown=row['backtest_max_drawdown'],
            win_rate=row['backtest_win_rate'],
            total_trades=row['backtest_total_trades'],
            profit_factor=row.get('backtest_profit_factor'),
        )

    return ExportedWorkflowConfig(
        id=row['id'],
        name=row['name'],
        description=row.get('description') or '',
        analysis=analysis,
        entry=entry,
        exit=exit_comp,
        backtest_metrics=metrics,
        symbol=row.get('symbol') or '',
        date_range_start=row.get('date_range_start') or '',
        date_range_end=row.get('date_range_end') or '',
    )


def load_exported_workflows() -> List[WorkflowSignalSource]:
    """
    Load all exported workflows from the database.

    Returns:
        List of WorkflowSignalSource instances
    """
    workflows = []

    try:
        import sqlite3
        db_path = get_database_path()

        if not os.path.exists(db_path):
            print(f"[WorkflowLoader] Database not found: {db_path}")
            return workflows

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM signal_source_registry
            WHERE source_type = 'workflow'
            ORDER BY exported_at DESC
        """)

        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            try:
                config = _row_to_config(dict(row))
                source = WorkflowSignalSource(config)
                workflows.append(source)
                print(f"[WorkflowLoader] Loaded workflow: {config.name}")
            except Exception as e:
                print(f"[WorkflowLoader] Failed to load workflow {row['name']}: {e}")

    except Exception as e:
        print(f"[WorkflowLoader] Error loading workflows: {e}")

    return workflows


def load_workflow_by_id(workflow_id: str) -> Optional[WorkflowSignalSource]:
    """
    Load a specific workflow by ID.

    Args:
        workflow_id: Workflow ID to load

    Returns:
        WorkflowSignalSource instance or None if not found
    """
    try:
        import sqlite3
        db_path = get_database_path()

        if not os.path.exists(db_path):
            return None

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM signal_source_registry
            WHERE id = ?
        """, (workflow_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            config = _row_to_config(dict(row))
            return WorkflowSignalSource(config)

    except Exception as e:
        print(f"[WorkflowLoader] Error loading workflow {workflow_id}: {e}")

    return None


def load_workflow_by_name(name: str) -> Optional[WorkflowSignalSource]:
    """
    Load a workflow by name.

    Args:
        name: Workflow name to search for

    Returns:
        WorkflowSignalSource instance or None if not found
    """
    try:
        import sqlite3
        db_path = get_database_path()

        if not os.path.exists(db_path):
            return None

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM signal_source_registry
            WHERE name = ?
            ORDER BY exported_at DESC
            LIMIT 1
        """, (name,))

        row = cursor.fetchone()
        conn.close()

        if row:
            config = _row_to_config(dict(row))
            return WorkflowSignalSource(config)

    except Exception as e:
        print(f"[WorkflowLoader] Error loading workflow by name {name}: {e}")

    return None


def list_exported_workflows() -> List[dict]:
    """
    List all exported workflows (metadata only, no code).

    Returns:
        List of workflow metadata dictionaries
    """
    workflows = []

    try:
        import sqlite3
        db_path = get_database_path()

        if not os.path.exists(db_path):
            return workflows

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                id,
                name,
                description,
                exported_at,
                analysis_algorithm_name,
                analysis_timeframe,
                entry_algorithm_name,
                entry_timeframe,
                exit_algorithm_name,
                exit_timeframe,
                backtest_sharpe,
                backtest_max_drawdown,
                backtest_win_rate,
                backtest_total_trades,
                symbol
            FROM signal_source_registry
            WHERE source_type = 'workflow'
            ORDER BY exported_at DESC
        """)

        rows = cursor.fetchall()
        conn.close()

        for row in rows:
            workflows.append({
                'id': row['id'],
                'name': row['name'],
                'description': row['description'],
                'exported_at': row['exported_at'],
                'analysis': {
                    'name': row['analysis_algorithm_name'],
                    'timeframe': row['analysis_timeframe'],
                },
                'entry': {
                    'name': row['entry_algorithm_name'],
                    'timeframe': row['entry_timeframe'],
                },
                'exit': {
                    'name': row['exit_algorithm_name'],
                    'timeframe': row['exit_timeframe'],
                } if row['exit_algorithm_name'] else None,
                'metrics': {
                    'sharpe': row['backtest_sharpe'],
                    'max_drawdown': row['backtest_max_drawdown'],
                    'win_rate': row['backtest_win_rate'],
                    'total_trades': row['backtest_total_trades'],
                } if row['backtest_sharpe'] is not None else None,
                'symbol': row['symbol'],
            })

    except Exception as e:
        print(f"[WorkflowLoader] Error listing workflows: {e}")

    return workflows
