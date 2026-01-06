"""
StrategyStateManager - Phase-based Strategy State Management

Manages state passing between strategy phases during backtest execution.
Based on nona_server's src/strategies/base/strategy_state_manager.py pattern.

Features:
1. State sharing between phases (analysis -> precondition -> execution -> postcondition)
2. Execution order tracking
3. Phase registration and validation
4. Multi-strategy group support
"""

import logging
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum

from .phases import StrategyPhases, PHASE_ANALYSIS, PHASE_PRECONDITION, PHASE_EXECUTION

logger = logging.getLogger(__name__)


class TrendDirection(Enum):
    """Market trend direction."""
    UP = "up"
    DOWN = "down"
    NEUTRAL = "neutral"


@dataclass
class PhaseResult:
    """Result from a strategy phase."""
    phase: str
    strategy_id: str
    strategy_name: str
    signal_triggered: bool = False
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[str] = None


class StrategyStateManager:
    """
    Strategy State Manager - Coordinates state between phases.

    Responsibilities:
    1. Store and retrieve phase results
    2. Track execution order
    3. Manage trend/analysis state
    4. Support multi-strategy groups

    Usage:
        state_manager = StrategyStateManager()

        # Register strategies
        state_manager.register_strategy("strategy_001", PHASE_ANALYSIS)
        state_manager.register_strategy("strategy_002", PHASE_EXECUTION)

        # Set analysis result
        state_manager.set_analysis_result({"is_trending": True, "direction": "up"})

        # Check in execution phase
        if state_manager.get_is_trending():
            # Execute trend-following logic
            pass
    """

    def __init__(self):
        # Core state
        self._state: Dict[str, Any] = {
            "is_trending": False,
            "trend_direction": None,
            "analysis_results": {},
            "precondition_results": {},
            "execution_results": {},
            "postcondition_results": {},
        }

        # Execution tracking
        self._execution_order: List[str] = []
        self._current_phase: Optional[str] = None
        self._is_final_phase: bool = False
        self._initialized: bool = False

        # Strategy registration
        self._strategy_phases: Dict[str, str] = {}  # strategy_id -> phase
        self._strategy_instances: Dict[int, str] = {}  # id(instance) -> strategy_id

        # Multi-group support
        self._strategy_groups: Dict[str, Dict] = {}
        self._current_group_id: Optional[str] = None

        # Context tracking
        self._user_id: Optional[str] = None
        self._task_id: Optional[str] = None
        self._bar_counts: Dict[str, int] = {}

        logger.debug("StrategyStateManager initialized")

    # ==========================================================================
    # Initialization
    # ==========================================================================

    def initialize(
        self,
        execution_order: List[str],
        user_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> None:
        """
        Initialize state manager with execution order.

        Args:
            execution_order: List of phases in execution order
            user_id: User ID for context
            task_id: Task ID for context
        """
        self._execution_order = execution_order
        self._user_id = user_id
        self._task_id = task_id
        self._initialized = True

        logger.info(
            f"StateManager initialized: phases={execution_order}, "
            f"user_id={user_id}, task_id={task_id}"
        )

    def reset(self) -> None:
        """Reset state for new backtest."""
        self._state = {
            "is_trending": False,
            "trend_direction": None,
            "analysis_results": {},
            "precondition_results": {},
            "execution_results": {},
            "postcondition_results": {},
        }
        self._current_phase = None
        self._is_final_phase = False
        self._strategy_phases.clear()
        self._strategy_instances.clear()
        logger.debug("StateManager reset")

    # ==========================================================================
    # Strategy Registration
    # ==========================================================================

    def register_strategy(self, strategy_id: str, phase: str) -> None:
        """
        Register a strategy with its phase.

        Args:
            strategy_id: Unique strategy identifier
            phase: Phase this strategy belongs to
        """
        if phase not in StrategyPhases.VALID_PHASES:
            raise ValueError(f"Invalid phase: {phase}")

        self._strategy_phases[strategy_id] = phase
        logger.debug(f"Registered strategy: {strategy_id} -> {phase}")

    def register_strategy_instance(
        self,
        strategy_instance: Any,
        strategy_id: str,
        phase: str,
    ) -> None:
        """
        Register a strategy instance with its ID and phase.

        Args:
            strategy_instance: The strategy instance object
            strategy_id: Unique strategy identifier
            phase: Phase this strategy belongs to
        """
        self._strategy_instances[id(strategy_instance)] = strategy_id
        self.register_strategy(strategy_id, phase)
        logger.debug(
            f"Registered strategy instance: {id(strategy_instance)} -> {strategy_id}"
        )

    def get_strategy_phase(self, strategy_id: str) -> Optional[str]:
        """Get the phase for a strategy."""
        return self._strategy_phases.get(strategy_id)

    def get_strategy_id_for_instance(self, strategy_instance: Any) -> Optional[str]:
        """Get strategy ID for a strategy instance."""
        return self._strategy_instances.get(id(strategy_instance))

    # ==========================================================================
    # Phase Management
    # ==========================================================================

    def set_current_phase(self, phase: str) -> None:
        """
        Set the current execution phase.

        Args:
            phase: Current phase name
        """
        self._current_phase = phase

        # Check if this is the final phase
        if self._execution_order:
            self._is_final_phase = phase == self._execution_order[-1]

        logger.debug(f"Current phase: {phase}, is_final={self._is_final_phase}")

    def get_current_phase(self) -> Optional[str]:
        """Get the current execution phase."""
        return self._current_phase

    def is_final_phase(self) -> bool:
        """Check if current phase is the final phase."""
        return self._is_final_phase

    def is_instance_in_final_phase(self, strategy_instance: Any) -> bool:
        """
        Check if strategy instance is in the final phase.

        Args:
            strategy_instance: Strategy instance to check

        Returns:
            True if instance is in final phase
        """
        if not self._initialized or not self._execution_order:
            return False

        strategy_id = self.get_strategy_id_for_instance(strategy_instance)
        if not strategy_id:
            return False

        strategy_phase = self.get_strategy_phase(strategy_id)
        if not strategy_phase:
            return False

        return strategy_phase == self._current_phase and self._is_final_phase

    # ==========================================================================
    # Analysis State
    # ==========================================================================

    def set_is_trending(self, is_trending: bool) -> None:
        """Set whether market is trending."""
        self._state["is_trending"] = is_trending

    def get_is_trending(self) -> bool:
        """Get whether market is trending."""
        return self._state.get("is_trending", False)

    def set_trend_direction(self, direction: TrendDirection) -> None:
        """Set trend direction."""
        self._state["trend_direction"] = direction

    def get_trend_direction(self) -> Optional[TrendDirection]:
        """Get trend direction."""
        return self._state.get("trend_direction")

    def set_analysis_result(self, result: Dict[str, Any]) -> None:
        """
        Set analysis phase result.

        Args:
            result: Analysis result dictionary
        """
        self._state["analysis_results"]["_unified"] = result

        # Extract common fields
        if "is_trending" in result:
            self.set_is_trending(result["is_trending"])
        if "direction" in result:
            direction = result["direction"]
            if isinstance(direction, str):
                direction = TrendDirection(direction.lower())
            self.set_trend_direction(direction)

        logger.debug(f"Analysis result set: {result}")

    def get_analysis_result(self) -> Dict[str, Any]:
        """Get analysis phase result."""
        return self._state["analysis_results"].get("_unified", {})

    # ==========================================================================
    # Precondition State
    # ==========================================================================

    def set_precondition_result(self, result: Dict[str, Any]) -> None:
        """
        Set precondition phase result.

        Args:
            result: Precondition result with signal_triggered flag
        """
        self._state["precondition_results"]["_unified"] = result
        logger.debug(f"Precondition result set: {result}")

    def get_precondition_result(self) -> Dict[str, Any]:
        """Get precondition phase result."""
        return self._state["precondition_results"].get("_unified", {})

    def is_signal_triggered(self) -> bool:
        """Check if precondition signal was triggered."""
        result = self.get_precondition_result()
        return result.get("signal_triggered", False)

    # ==========================================================================
    # Execution State
    # ==========================================================================

    def set_execution_result(self, result: Dict[str, Any]) -> None:
        """Set execution phase result."""
        self._state["execution_results"]["_unified"] = result
        logger.debug(f"Execution result set: {result}")

    def get_execution_result(self) -> Dict[str, Any]:
        """Get execution phase result."""
        return self._state["execution_results"].get("_unified", {})

    # ==========================================================================
    # Postcondition State
    # ==========================================================================

    def set_postcondition_result(self, result: Dict[str, Any]) -> None:
        """Set postcondition phase result."""
        self._state["postcondition_results"]["_unified"] = result
        logger.debug(f"Postcondition result set: {result}")

    def get_postcondition_result(self) -> Dict[str, Any]:
        """Get postcondition phase result."""
        return self._state["postcondition_results"].get("_unified", {})

    # ==========================================================================
    # Phase Result Storage (Generic)
    # ==========================================================================

    def set_phase_result(
        self,
        phase: str,
        strategy_id: str,
        result: Dict[str, Any],
    ) -> None:
        """
        Set result for a specific phase and strategy.

        Args:
            phase: Phase name
            strategy_id: Strategy identifier
            result: Result dictionary
        """
        key = f"{phase}_results"
        if key not in self._state:
            self._state[key] = {}
        self._state[key][strategy_id] = result

    def get_phase_result(
        self,
        phase: str,
        strategy_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get result for a specific phase.

        Args:
            phase: Phase name
            strategy_id: Strategy identifier (optional)

        Returns:
            Result dictionary or all results for phase
        """
        key = f"{phase}_results"
        results = self._state.get(key, {})

        if strategy_id:
            return results.get(strategy_id, {})
        return results

    # ==========================================================================
    # Context
    # ==========================================================================

    def set_bar_counts(self, bar_counts: Dict[str, int]) -> None:
        """Set bar count information."""
        self._bar_counts = bar_counts

    def get_bar_counts(self) -> Dict[str, int]:
        """Get bar count information."""
        return self._bar_counts

    def get_user_id(self) -> Optional[str]:
        """Get user ID."""
        return self._user_id

    def get_task_id(self) -> Optional[str]:
        """Get task ID."""
        return self._task_id

    # ==========================================================================
    # Serialization
    # ==========================================================================

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state to dictionary."""
        return {
            "state": self._state.copy(),
            "execution_order": self._execution_order,
            "current_phase": self._current_phase,
            "strategy_phases": self._strategy_phases.copy(),
            "user_id": self._user_id,
            "task_id": self._task_id,
        }

    def from_dict(self, data: Dict[str, Any]) -> None:
        """Restore state from dictionary."""
        self._state = data.get("state", self._state)
        self._execution_order = data.get("execution_order", [])
        self._current_phase = data.get("current_phase")
        self._strategy_phases = data.get("strategy_phases", {})
        self._user_id = data.get("user_id")
        self._task_id = data.get("task_id")
        self._initialized = bool(self._execution_order)
