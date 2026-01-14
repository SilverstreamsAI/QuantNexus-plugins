"""
Date Range Utilities
Ported from nona_server backtest_workflow.py

Critical functions for date range calculation and validation.
"""

import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta
import pytz
from typing import Tuple

logger = logging.getLogger(__name__)


def calculate_date_range(
    end_year: int, end_month: int, years_back: int, months_back: int
) -> Tuple[datetime, datetime]:
    """
    Calculate date range based on end point and backward offsets.

    Port from: nona_server/src/backtest/backtest_workflow.py:calculate_date_range()

    Args:
        end_year: Target end year (e.g., 2024)
        end_month: Target end month (1-12)
        years_back: Number of years to go backwards
        months_back: Number of months to go backwards

    Returns:
        Tuple of (start_date, end_date) as datetime objects with UTC timezone

    Raises:
        TypeError: If input types are invalid
        ValueError: If date parameters are out of valid range

    Example:
        >>> start, end = calculate_date_range(2024, 1, 0, 1)
        >>> print(start.strftime('%Y-%m'))
        2023-12
        >>> print(end.strftime('%Y-%m'))
        2024-01
    """
    # Enhanced input validation
    if not isinstance(end_year, int) or not isinstance(end_month, int):
        raise TypeError("Year and month must be integers")
    if not isinstance(years_back, int) or not isinstance(months_back, int):
        raise TypeError("Years_back and months_back must be integers")
    if not (1 <= end_month <= 12):
        raise ValueError("End month must be between 1 and 12")
    if years_back < 0 or months_back < 0:
        raise ValueError("Years and months back must be non-negative")
    if end_year < 1900:
        raise ValueError("Year must be 1900 or later")

    # Create end date with UTC timezone
    try:
        end_date = datetime(end_year, end_month, 1, tzinfo=pytz.UTC)
    except ValueError as e:
        raise ValueError(f"Invalid date combination: {str(e)}")

    # Calculate start date by going backwards
    total_months_back = (years_back * 12) + months_back
    start_date = end_date - relativedelta(months=total_months_back)

    # Ensure start date is earlier than end date
    if start_date >= end_date:
        raise ValueError(
            f"Invalid date range: start_date ({start_date.strftime('%Y-%m')}) "
            f"must be earlier than end_date ({end_date.strftime('%Y-%m')})"
        )

    logger.debug(
        f"Date range calculated: {start_date.strftime('%Y-%m-%d')} to "
        f"{end_date.strftime('%Y-%m-%d')} ({years_back}y {months_back}m back)"
    )

    return start_date, end_date


def get_query_date_range(
    db,
    symbol: str,
    end_year: int,
    end_month: int,
    years_back: int,
    months_back: int,
) -> Tuple[datetime, datetime]:
    """
    Get validated query date range considering database limits.

    Port from: nona_server/src/backtest/backtest_workflow.py:get_query_date_range()

    Args:
        db: Database connection with get_data_time_range() method
        symbol: Symbol/currency pair to query
        end_year: Target end year
        end_month: Target end month
        years_back: Years to look back
        months_back: Months to look back

    Returns:
        Tuple of (query_start, query_end) as datetime objects

    Raises:
        ValueError: If symbol is invalid or no data is available

    Example:
        >>> with Database() as db:
        ...     start, end = get_query_date_range(db, "BTCUSDT", 2024, 1, 0, 1)
        ...     print(f"Range: {start} to {end}")
    """
    # Validate symbol
    if not isinstance(symbol, str) or not symbol.strip():
        raise ValueError("Symbol must be a non-empty string")

    # Get database date range
    try:
        db_start, db_end = db.get_data_time_range(symbol)
    except Exception as e:
        raise ValueError(f"Failed to get database range for {symbol}: {str(e)}")

    # Ensure database dates have UTC timezone
    if db_start.tzinfo is None:
        db_start = pytz.UTC.localize(db_start)
    if db_end.tzinfo is None:
        db_end = pytz.UTC.localize(db_end)

    # Validate database range
    if db_start >= db_end:
        raise ValueError(
            f"Invalid database range for {symbol}: "
            f"start ({db_start}) is not before end ({db_end})"
        )

    # Calculate desired date range
    start_date, end_date = calculate_date_range(
        end_year, end_month, years_back, months_back
    )

    # Validate against database range and adjust if necessary
    query_end = min(end_date, db_end)
    query_start = max(start_date, db_start)

    # Check if we have any valid data range
    if query_start >= query_end:
        raise ValueError(
            f"No valid data available for the requested period. "
            f"Database range: {db_start.strftime('%Y-%m')} to {db_end.strftime('%Y-%m')}, "
            f"Requested: {start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')}"
        )

    # Log adjustments if any were made
    if query_start > start_date:
        logger.warning(
            f"Adjusted start date to database start: {query_start.strftime('%Y-%m')}"
        )
    if query_end < end_date:
        logger.warning(
            f"Adjusted end date to database end: {query_end.strftime('%Y-%m')}"
        )

    logger.info(
        f"Query date range for {symbol}: "
        f"{query_start.strftime('%Y-%m-%d')} to {query_end.strftime('%Y-%m-%d')}"
    )

    return query_start, query_end
