"""
QuantNexus Backtest Engine Plugin

A Python-based backtest engine with Backtrader integration,
designed based on nona_server patterns.

Components:
- BacktestConfig: Configuration management
- BacktestAccountManager: Account and position tracking
- BacktraderEngine: Backtrader integration wrapper
- BacktestWorkflow: Workflow orchestration
- CheckpointManager: Resume capability
- LLMTriggerEstimator: LLM call estimation
- StrategyGroup: Multi-phase strategy management
- StrategyStateManager: Phase state coordination
- DataProviderManager: Data source integration

Note (TICKET_211): PluginLifecycleManager requires explicit import:
  from src.lifecycle import PluginLifecycleManager
"""

__version__ = "1.0.0"
__author__ = "QuantNexus Team"

from .config import BacktestConfig
from .account import BacktestAccountManager, TradeRecord, PositionDetail, EquityPoint
from .workflow import BacktestWorkflow, WorkflowContext, WorkflowState, WorkflowBuilder
from .engine import BacktraderEngine
from .checkpoint import (
    CheckpointManager,
    CheckpointConfig,
    CheckpointData,
    CheckpointStorage,
    get_checkpoint_manager,
)
from .estimator import LLMTriggerEstimator, EstimationResult, WarningLevel
from .strategy import (
    StrategyPhases,
    StrategyType,
    StrategyStateManager,
    StrategyGroup,
    StrategyInfo,
    TestCase,
    PHASE_ANALYSIS,
    PHASE_PRECONDITION,
    PHASE_EXECUTION,
    PHASE_POSTCONDITION,
    STANDARD_PHASES,
)
# TICKET_211: lifecycle removed from top-level imports (V3 no gRPC)
# Use explicit import if needed: from src.lifecycle import PluginLifecycleManager
from .data import (
    DataProviderManager,
    MockDataProvider,
    FileDataProvider,
    TimeRange,
    OHLCVData,
    create_default_provider_manager,
)

__all__ = [
    # Core
    "BacktestConfig",
    "BacktestAccountManager",
    "TradeRecord",
    "PositionDetail",
    "EquityPoint",
    # Workflow
    "BacktestWorkflow",
    "WorkflowContext",
    "WorkflowState",
    "WorkflowBuilder",
    # Engine
    "BacktraderEngine",
    # Checkpoint
    "CheckpointManager",
    "CheckpointConfig",
    "CheckpointData",
    "CheckpointStorage",
    "get_checkpoint_manager",
    # Estimator
    "LLMTriggerEstimator",
    "EstimationResult",
    "WarningLevel",
    # Strategy (Multi-phase)
    "StrategyPhases",
    "StrategyType",
    "StrategyStateManager",
    "StrategyGroup",
    "StrategyInfo",
    "TestCase",
    "PHASE_ANALYSIS",
    "PHASE_PRECONDITION",
    "PHASE_EXECUTION",
    "PHASE_POSTCONDITION",
    "STANDARD_PHASES",
    # TICKET_211: Lifecycle removed (V3 no gRPC)
    # Data (Phase 4)
    "DataProviderManager",
    "MockDataProvider",
    "FileDataProvider",
    "TimeRange",
    "OHLCVData",
    "create_default_provider_manager",
]
