"""
Backtest engine exception module.

TICKET_118 Phase 5: Exception Handling

This module defines custom exception types for the backtest engine.
All exceptions inherit from BacktestException for easy catching.
"""

from .backtest_exceptions import (
    BacktestException,
    DataPreparationException,
    StrategyExecutionException,
    ResultProcessingException,
    DataSourceException,
    StrategyConfigurationException,
    DataInsufficientException,
    StrategyValidationException,
    DataLoadingException,
    DataFormatException,
    StrategyNotFoundException,
)

__all__ = [
    'BacktestException',
    'DataPreparationException',
    'StrategyExecutionException',
    'ResultProcessingException',
    'DataSourceException',
    'StrategyConfigurationException',
    'DataInsufficientException',
    'StrategyValidationException',
    'DataLoadingException',
    'DataFormatException',
    'StrategyNotFoundException',
]
