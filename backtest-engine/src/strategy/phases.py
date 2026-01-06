"""
Strategy Phase Constants

Defines the six-phase strategy execution architecture.
Based on nona_server's constants/business/strategy.py pattern.

Phases:
1. ADVISOR: LLM adaptive algorithm selector
2. DIRECTION: Strategy orchestrator (Director)
3. ANALYSIS: Market analysis / trend detection
4. PRECONDITION: Entry condition checks
5. EXECUTION: Trade execution logic
6. POSTCONDITION: Exit / risk management
"""

from typing import Final, List, Set
from enum import Enum


class StrategyPhase(Enum):
    """Strategy execution phase enumeration."""
    ADVISOR = "advisor"
    DIRECTION = "direction"
    ANALYSIS = "analysis"
    PRECONDITION = "precondition"
    EXECUTION = "execution"
    POSTCONDITION = "postcondition"


class StrategyPhases:
    """
    Strategy execution phase constants.

    Defines the standard phases and their execution order.
    """

    # ==========================================================================
    # Six Strategy Phases
    # ==========================================================================

    ADVISOR: Final[str] = "advisor"
    DIRECTION: Final[str] = "direction"
    ANALYSIS: Final[str] = "analysis"
    PRECONDITION: Final[str] = "precondition"
    EXECUTION: Final[str] = "execution"
    POSTCONDITION: Final[str] = "postcondition"

    # ==========================================================================
    # Phase Lists (Execution Order)
    # ==========================================================================

    # All phases in execution order
    ALL_PHASES: Final[List[str]] = [
        ADVISOR,
        DIRECTION,
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    ]

    # Standard four phases (backward compatible)
    STANDARD_PHASES: Final[List[str]] = [
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    ]

    # Advisor mode (with LLM algorithm selection)
    ADVISOR_MODE_PHASES: Final[List[str]] = [
        ADVISOR,
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    ]

    # Director mode (with strategy orchestration)
    DIRECTOR_MODE_PHASES: Final[List[str]] = [
        DIRECTION,
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    ]

    # ==========================================================================
    # Phase Sets (For Validation)
    # ==========================================================================

    # Core phases (without advisor/director)
    CORE_PHASES: Final[Set[str]] = {
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    }

    # All valid phases
    VALID_PHASES: Final[Set[str]] = {
        ADVISOR,
        DIRECTION,
        ANALYSIS,
        PRECONDITION,
        EXECUTION,
        POSTCONDITION,
    }

    # Required phases (must have at least one strategy)
    REQUIRED_PHASES: Final[Set[str]] = {
        EXECUTION,
    }

    # Optional phases
    OPTIONAL_PHASES: Final[Set[str]] = {
        ADVISOR,
        DIRECTION,
        ANALYSIS,
        PRECONDITION,
        POSTCONDITION,
    }


class StrategyType:
    """
    Strategy type constants.

    Maps strategy types to their phase assignments.
    """

    # Execution phase types
    TYPE_GENERIC: Final[int] = 0
    TYPE_TREND: Final[int] = 1
    TYPE_SWING: Final[int] = 2
    TYPE_RANGE: Final[int] = 3

    # Precondition phase
    TYPE_PRECONDITION: Final[int] = 7

    # Postcondition phase
    TYPE_POSTCONDITION: Final[int] = 8

    # Analysis phase
    TYPE_TREND_DETECTOR: Final[int] = 9

    # LLM-based types
    TYPE_LLM_ENTRY: Final[int] = 12

    # Direction phase
    TYPE_DIRECTOR: Final[int] = 10

    # Advisor phase
    TYPE_ADVISOR: Final[int] = 11

    # Type to phase mapping
    TYPE_TO_PHASE = {
        TYPE_GENERIC: StrategyPhases.EXECUTION,
        TYPE_TREND: StrategyPhases.EXECUTION,
        TYPE_SWING: StrategyPhases.EXECUTION,
        TYPE_RANGE: StrategyPhases.EXECUTION,
        TYPE_LLM_ENTRY: StrategyPhases.EXECUTION,
        TYPE_PRECONDITION: StrategyPhases.PRECONDITION,
        TYPE_POSTCONDITION: StrategyPhases.POSTCONDITION,
        TYPE_TREND_DETECTOR: StrategyPhases.ANALYSIS,
        TYPE_DIRECTOR: StrategyPhases.DIRECTION,
        TYPE_ADVISOR: StrategyPhases.ADVISOR,
    }

    # Execution types set
    EXECUTION_TYPES: Final[Set[int]] = {
        TYPE_GENERIC,
        TYPE_TREND,
        TYPE_SWING,
        TYPE_RANGE,
        TYPE_LLM_ENTRY,
    }


# Convenience aliases (for import compatibility)
PHASE_ADVISOR = StrategyPhases.ADVISOR
PHASE_DIRECTION = StrategyPhases.DIRECTION
PHASE_ANALYSIS = StrategyPhases.ANALYSIS
PHASE_PRECONDITION = StrategyPhases.PRECONDITION
PHASE_EXECUTION = StrategyPhases.EXECUTION
PHASE_POSTCONDITION = StrategyPhases.POSTCONDITION
STANDARD_PHASES = StrategyPhases.STANDARD_PHASES
DIRECTOR_MODE_PHASES = StrategyPhases.DIRECTOR_MODE_PHASES
ADVISOR_MODE_PHASES = StrategyPhases.ADVISOR_MODE_PHASES
