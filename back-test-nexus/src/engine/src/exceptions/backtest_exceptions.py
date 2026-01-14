"""
Backtest engine custom exception types.

TICKET_118 Phase 5: Exception Handling

Ported from server: exception/backtest_exceptions.py
All exceptions inherit from BacktestException for unified error handling.
"""

import traceback
from typing import Optional, Dict, Any
from enum import Enum


class ExceptionTypes(Enum):
    """Exception type classification for logging and monitoring."""

    # Configuration errors
    INVALID_CONFIG = "invalid_config"
    STRATEGY_VALIDATION_FAILED = "strategy_validation_failed"
    DATA_VALIDATION_FAILED = "data_validation_failed"

    # Data errors
    DATA_NOT_FOUND = "data_not_found"
    DATA_INSUFFICIENT = "data_insufficient"
    DATA_LOADING_FAILED = "data_loading_failed"
    DATA_FORMAT_ERROR = "data_format_error"

    # Strategy errors
    STRATEGY_NOT_FOUND = "strategy_not_found"
    STRATEGY_LOADING_FAILED = "strategy_loading_failed"
    STRATEGY_EXECUTION_FAILED = "strategy_execution_failed"
    STRATEGY_CONFIG_ERROR = "strategy_config_error"

    # Execution errors
    EXECUTION_TIMEOUT = "execution_timeout"
    EXECUTION_CRASHED = "execution_crashed"

    # Result processing errors
    RESULT_PROCESSING_FAILED = "result_processing_failed"
    RESULT_STORAGE_FAILED = "result_storage_failed"

    # System errors
    DATABASE_ERROR = "database_error"
    FILESYSTEM_ERROR = "filesystem_error"
    UNKNOWN_ERROR = "unknown_error"


class BacktestException(Exception):
    """
    Base exception for all backtest-related errors.

    Attributes:
        message: Human-readable error message
        exception_type: Classification of the error (ExceptionTypes enum)
        phase: Which phase of backtest workflow failed
        task_id: Associated task ID (if available)
        user_id: Associated user ID (if available)
        details: Additional context (dict)
        original_exception: Original exception if wrapped
    """

    def __init__(
        self,
        message: str,
        exception_type: Optional[ExceptionTypes] = None,
        phase: Optional[str] = None,
        task_id: Optional[str] = None,
        user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        original_exception: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.exception_type = exception_type or ExceptionTypes.UNKNOWN_ERROR
        self.phase = phase
        self.task_id = task_id
        self.user_id = user_id
        self.details = details or {}
        self.original_exception = original_exception
        self.traceback_str = traceback.format_exc() if original_exception else None

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/serialization."""
        return {
            'error_type': self.__class__.__name__,
            'message': self.message,
            'exception_type': self.exception_type.value if isinstance(self.exception_type, ExceptionTypes) else str(self.exception_type),
            'phase': self.phase,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'details': self.details,
            'traceback': self.traceback_str
        }

    @classmethod
    def from_exception(cls, exc: Exception, **kwargs) -> 'BacktestException':
        """
        Wrap a generic exception in BacktestException.

        Args:
            exc: Original exception
            **kwargs: Additional context (phase, task_id, user_id, etc.)

        Returns:
            BacktestException wrapping the original exception
        """
        if isinstance(exc, BacktestException):
            # Already a BacktestException, return as-is
            return exc

        return cls(
            message=str(exc),
            exception_type=kwargs.get('exception_type', ExceptionTypes.UNKNOWN_ERROR),
            phase=kwargs.get('phase'),
            task_id=kwargs.get('task_id'),
            user_id=kwargs.get('user_id'),
            details=kwargs.get('details', {}),
            original_exception=exc
        )

    def __str__(self) -> str:
        """String representation for logging."""
        parts = [f"{self.__class__.__name__}: {self.message}"]
        if self.exception_type:
            parts.append(f"Type: {self.exception_type.value if isinstance(self.exception_type, ExceptionTypes) else self.exception_type}")
        if self.phase:
            parts.append(f"Phase: {self.phase}")
        if self.task_id:
            parts.append(f"Task: {self.task_id}")
        if self.user_id:
            parts.append(f"User: {self.user_id}")
        if self.details:
            parts.append(f"Details: {self.details}")
        return " | ".join(parts)


# ============================================================================
# Data-related Exceptions
# ============================================================================

class DataPreparationException(BacktestException):
    """Raised when data preparation phase fails."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.DATA_VALIDATION_FAILED),
            phase=kwargs.pop('phase', 'data_preparation'),
            **kwargs
        )


class DataSourceException(BacktestException):
    """Raised when data source is unavailable or returns invalid data."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.DATA_NOT_FOUND),
            phase=kwargs.pop('phase', 'data_loading'),
            **kwargs
        )


class DataLoadingException(BacktestException):
    """Raised when data loading from database fails."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.DATA_LOADING_FAILED),
            phase=kwargs.pop('phase', 'data_loading'),
            **kwargs
        )


class DataInsufficientException(BacktestException):
    """Raised when loaded data is insufficient for backtesting."""

    def __init__(self, message: str, symbol: Optional[str] = None, bars_required: Optional[int] = None, bars_found: Optional[int] = None, **kwargs):
        details = kwargs.get('details', {})
        if symbol:
            details['symbol'] = symbol
        if bars_required is not None:
            details['bars_required'] = bars_required
        if bars_found is not None:
            details['bars_found'] = bars_found

        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.DATA_INSUFFICIENT),
            phase=kwargs.pop('phase', 'data_validation'),
            details=details,
            **kwargs
        )


class DataFormatException(BacktestException):
    """Raised when data format is invalid or incompatible."""

    def __init__(self, message: str, expected_format: Optional[str] = None, actual_format: Optional[str] = None, **kwargs):
        details = kwargs.get('details', {})
        if expected_format:
            details['expected_format'] = expected_format
        if actual_format:
            details['actual_format'] = actual_format

        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.DATA_FORMAT_ERROR),
            phase=kwargs.pop('phase', 'data_validation'),
            details=details,
            **kwargs
        )


# ============================================================================
# Strategy-related Exceptions
# ============================================================================

class StrategyNotFoundException(BacktestException):
    """Raised when strategy cannot be found in database."""

    def __init__(self, message: str, strategy_name: Optional[str] = None, strategy_id: Optional[int] = None, **kwargs):
        details = kwargs.get('details', {})
        if strategy_name:
            details['strategy_name'] = strategy_name
        if strategy_id is not None:
            details['strategy_id'] = strategy_id

        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.STRATEGY_NOT_FOUND),
            phase=kwargs.pop('phase', 'strategy_loading'),
            details=details,
            **kwargs
        )


class StrategyConfigurationException(BacktestException):
    """Raised when strategy configuration is invalid."""

    def __init__(self, message: str, strategy_name: Optional[str] = None, invalid_params: Optional[Dict] = None, **kwargs):
        details = kwargs.get('details', {})
        if strategy_name:
            details['strategy_name'] = strategy_name
        if invalid_params:
            details['invalid_params'] = invalid_params

        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.STRATEGY_CONFIG_ERROR),
            phase=kwargs.pop('phase', 'strategy_validation'),
            details=details,
            **kwargs
        )


class StrategyValidationException(BacktestException):
    """Raised when strategy validation fails."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.STRATEGY_VALIDATION_FAILED),
            phase=kwargs.pop('phase', 'strategy_validation'),
            **kwargs
        )


class StrategyExecutionException(BacktestException):
    """Raised when strategy execution fails during backtest."""

    def __init__(self, message: str, strategy_name: Optional[str] = None, **kwargs):
        details = kwargs.get('details', {})
        if strategy_name:
            details['strategy_name'] = strategy_name

        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.STRATEGY_EXECUTION_FAILED),
            phase=kwargs.pop('phase', 'execution'),
            details=details,
            **kwargs
        )


# ============================================================================
# Result Processing Exceptions
# ============================================================================

class ResultProcessingException(BacktestException):
    """Raised when result processing or storage fails."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            exception_type=kwargs.pop('exception_type', ExceptionTypes.RESULT_PROCESSING_FAILED),
            phase=kwargs.pop('phase', 'result_processing'),
            **kwargs
        )
