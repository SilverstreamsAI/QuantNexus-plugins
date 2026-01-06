"""
Strategy module for multi-phase strategy execution.

Based on nona_server's six-phase strategy architecture:
1. ADVISOR: LLM adaptive algorithm selector
2. DIRECTION: Strategy orchestrator
3. ANALYSIS: Market analysis / trend detection
4. PRECONDITION: Entry condition checks
5. EXECUTION: Trade execution logic
6. POSTCONDITION: Exit / risk management
"""

from .phases import (
    StrategyPhase,
    StrategyPhases,
    StrategyType,
    PHASE_ADVISOR,
    PHASE_DIRECTION,
    PHASE_ANALYSIS,
    PHASE_PRECONDITION,
    PHASE_EXECUTION,
    PHASE_POSTCONDITION,
    STANDARD_PHASES,
    DIRECTOR_MODE_PHASES,
    ADVISOR_MODE_PHASES,
)
from .state_manager import (
    StrategyStateManager,
    TrendDirection,
    PhaseResult,
)
from .group import (
    StrategyGroup,
    StrategyInfo,
    TestCase,
)

__all__ = [
    # Phases
    "StrategyPhase",
    "StrategyPhases",
    "StrategyType",
    "PHASE_ADVISOR",
    "PHASE_DIRECTION",
    "PHASE_ANALYSIS",
    "PHASE_PRECONDITION",
    "PHASE_EXECUTION",
    "PHASE_POSTCONDITION",
    "STANDARD_PHASES",
    "DIRECTOR_MODE_PHASES",
    "ADVISOR_MODE_PHASES",
    # State Management
    "StrategyStateManager",
    "TrendDirection",
    "PhaseResult",
    # Strategy Group
    "StrategyGroup",
    "StrategyInfo",
    "TestCase",
]
