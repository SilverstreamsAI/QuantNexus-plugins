"""
Database Utilities

Common database utilities for plugin components.
TICKET_118: Centralized database path resolution.
"""

import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def get_default_db_path() -> str:
    """
    Get default database path (FALLBACK ONLY).

    Order of precedence (TICKET_118 - Updated 2026-01-15):
    1. gRPC Initialize RPC (recommended for Desktop) - handled by caller
    2. Environment variable QUANTNEXUS_DB_PATH (server deployment only)
    3. Relative path fallback (development only)

    DEPRECATED: This function should not be called in production.
    Host should pass db_path via Initialize RPC (see TICKET_010 Section 4.3).

    Returns:
        Database file path
    """
    # Method 1: Environment variable (server deployment only)
    db_path = os.environ.get('QUANTNEXUS_DB_PATH')
    if db_path:
        logger.warning(f"Using database path from environment variable (server deployment mode): {db_path}")
        logger.warning("Desktop apps should use gRPC Initialize RPC instead (see TICKET_118)")
        return db_path

    # Method 2: Fallback to relative path (development only)
    db_path = Path(__file__).parent.parent.parent.parent.parent.parent / "data" / "quantnexus.db"
    logger.warning("="*70)
    logger.warning("WARNING: Using fallback database path - Initialize RPC not called!")
    logger.warning(f"Fallback path: {db_path}")
    logger.warning("This is acceptable for local development ONLY.")
    logger.warning("Production apps MUST call Initialize RPC first (see TICKET_010).")
    logger.warning("="*70)
    return str(db_path)
