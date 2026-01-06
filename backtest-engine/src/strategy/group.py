"""
StrategyGroup - Multi-phase Strategy Container

Manages strategies organized by execution phase.
Based on nona_server's src/strategies/strategy_group.py pattern.

Features:
1. Organize strategies by phase (analysis, precondition, execution, postcondition)
2. Load strategies on demand
3. Validate phase requirements
4. Support for multiple execution modes (standard, director, advisor)
"""

import logging
from typing import Dict, List, Any, Optional, Type, Set
from dataclasses import dataclass, field

try:
    import backtrader as bt
except ImportError:
    bt = None

from .phases import (
    StrategyPhases,
    StrategyType,
    PHASE_ANALYSIS,
    PHASE_PRECONDITION,
    PHASE_EXECUTION,
    PHASE_POSTCONDITION,
    PHASE_DIRECTION,
    PHASE_ADVISOR,
)
from .state_manager import StrategyStateManager

logger = logging.getLogger(__name__)


@dataclass
class StrategyInfo:
    """Information about a loaded strategy."""
    strategy_id: str
    strategy_name: str
    strategy_type: int
    phase: str
    strategy_class: Optional[Type] = None
    code: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy_id": self.strategy_id,
            "strategy_name": self.strategy_name,
            "strategy_type": self.strategy_type,
            "phase": self.phase,
            "params": self.params,
        }


@dataclass
class TestCase:
    """
    Test case configuration for multi-phase execution.

    Defines which strategy to use for each phase.
    """
    case_id: str
    analysis: Optional[str] = None
    precondition: Optional[str] = None
    execution: Optional[str] = None
    postcondition: Optional[str] = None
    direction: Optional[str] = None
    advisor: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)

    def get_phases(self) -> List[str]:
        """Get list of phases that have strategies assigned."""
        phases = []
        if self.advisor:
            phases.append(PHASE_ADVISOR)
        if self.direction:
            phases.append(PHASE_DIRECTION)
        if self.analysis:
            phases.append(PHASE_ANALYSIS)
        if self.precondition:
            phases.append(PHASE_PRECONDITION)
        if self.execution:
            phases.append(PHASE_EXECUTION)
        if self.postcondition:
            phases.append(PHASE_POSTCONDITION)
        return phases

    def get_strategy_for_phase(self, phase: str) -> Optional[str]:
        """Get strategy name for a specific phase."""
        phase_map = {
            PHASE_ADVISOR: self.advisor,
            PHASE_DIRECTION: self.direction,
            PHASE_ANALYSIS: self.analysis,
            PHASE_PRECONDITION: self.precondition,
            PHASE_EXECUTION: self.execution,
            PHASE_POSTCONDITION: self.postcondition,
        }
        return phase_map.get(phase)

    def has_direction(self) -> bool:
        """Check if test case uses director mode."""
        return bool(self.direction)

    def has_advisor(self) -> bool:
        """Check if test case uses advisor mode."""
        return bool(self.advisor)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            PHASE_ANALYSIS: self.analysis,
            PHASE_PRECONDITION: self.precondition,
            PHASE_EXECUTION: self.execution,
            PHASE_POSTCONDITION: self.postcondition,
            PHASE_DIRECTION: self.direction,
            PHASE_ADVISOR: self.advisor,
            "params": self.params,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TestCase":
        return cls(
            case_id=data.get("case_id", ""),
            analysis=data.get(PHASE_ANALYSIS) or data.get("analysis"),
            precondition=data.get(PHASE_PRECONDITION) or data.get("precondition"),
            execution=data.get(PHASE_EXECUTION) or data.get("execution"),
            postcondition=data.get(PHASE_POSTCONDITION) or data.get("postcondition"),
            direction=data.get(PHASE_DIRECTION) or data.get("direction"),
            advisor=data.get(PHASE_ADVISOR) or data.get("advisor"),
            params=data.get("params", {}),
        )


class StrategyGroup:
    """
    Strategy Group - Manages strategies by phase.

    Organizes strategies into phase-based groups and provides
    methods for loading, validation, and execution.

    Attributes:
        state_manager: StrategyStateManager for phase coordination
        strategies: Dictionary of strategies by phase
    """

    def __init__(self, state_manager: Optional[StrategyStateManager] = None):
        self.state_manager = state_manager or StrategyStateManager()

        # Strategy storage by phase
        self._strategies: Dict[str, List[StrategyInfo]] = {
            PHASE_ADVISOR: [],
            PHASE_DIRECTION: [],
            PHASE_ANALYSIS: [],
            PHASE_PRECONDITION: [],
            PHASE_EXECUTION: [],
            PHASE_POSTCONDITION: [],
        }

        # Loaded strategy classes
        self._loaded_classes: Dict[str, Type] = {}

        logger.info("StrategyGroup initialized")

    # ==========================================================================
    # Strategy Loading
    # ==========================================================================

    def add_strategy(self, strategy_info: StrategyInfo) -> None:
        """
        Add a strategy to the appropriate phase group.

        Args:
            strategy_info: Strategy information
        """
        phase = strategy_info.phase
        if phase not in self._strategies:
            raise ValueError(f"Invalid phase: {phase}")

        self._strategies[phase].append(strategy_info)

        # Register with state manager
        self.state_manager.register_strategy(
            strategy_info.strategy_id,
            phase,
        )

        logger.info(
            f"Added strategy: {strategy_info.strategy_name} -> {phase}"
        )

    def load_strategies_from_test_case(
        self,
        test_case: TestCase,
        strategy_loader: Optional[Any] = None,
    ) -> None:
        """
        Load strategies from a test case configuration.

        Args:
            test_case: Test case with strategy assignments
            strategy_loader: Optional loader for strategy code/classes
        """
        for phase in test_case.get_phases():
            strategy_name = test_case.get_strategy_for_phase(phase)
            if not strategy_name:
                continue

            # Determine strategy type from phase
            type_for_phase = {
                PHASE_ADVISOR: StrategyType.TYPE_ADVISOR,
                PHASE_DIRECTION: StrategyType.TYPE_DIRECTOR,
                PHASE_ANALYSIS: StrategyType.TYPE_TREND_DETECTOR,
                PHASE_PRECONDITION: StrategyType.TYPE_PRECONDITION,
                PHASE_EXECUTION: StrategyType.TYPE_GENERIC,
                PHASE_POSTCONDITION: StrategyType.TYPE_POSTCONDITION,
            }

            strategy_info = StrategyInfo(
                strategy_id=f"{phase}_{strategy_name}",
                strategy_name=strategy_name,
                strategy_type=type_for_phase.get(phase, 0),
                phase=phase,
                params=test_case.params,
            )

            self.add_strategy(strategy_info)

    def get_strategies_for_phase(self, phase: str) -> List[StrategyInfo]:
        """Get all strategies for a specific phase."""
        return self._strategies.get(phase, [])

    def get_all_strategy_names(self) -> Set[str]:
        """Get all unique strategy names across all phases."""
        names = set()
        for strategies in self._strategies.values():
            for strategy in strategies:
                names.add(strategy.strategy_name)
        return names

    # ==========================================================================
    # Execution Mode
    # ==========================================================================

    def get_execution_order(self, test_case: Optional[TestCase] = None) -> List[str]:
        """
        Get the execution order for phases.

        Args:
            test_case: Optional test case to determine mode

        Returns:
            List of phases in execution order
        """
        if test_case:
            if test_case.has_advisor():
                return StrategyPhases.ADVISOR_MODE_PHASES
            elif test_case.has_direction():
                return StrategyPhases.DIRECTOR_MODE_PHASES

        # Default to standard phases
        return StrategyPhases.STANDARD_PHASES

    def validate_test_case(self, test_case: TestCase) -> bool:
        """
        Validate that a test case has required strategies.

        Args:
            test_case: Test case to validate

        Returns:
            True if valid
        """
        # Must have execution strategy
        if not test_case.execution:
            logger.warning(f"Test case {test_case.case_id} missing execution strategy")
            return False

        return True

    # ==========================================================================
    # Phase Execution
    # ==========================================================================

    def execute_phase(
        self,
        phase: str,
        cerebro: Any,
        data_feed: Any,
    ) -> List[Any]:
        """
        Execute all strategies for a phase.

        Args:
            phase: Phase to execute
            cerebro: Backtrader Cerebro instance
            data_feed: Data feed for strategies

        Returns:
            List of strategy results
        """
        if bt is None:
            raise ImportError("Backtrader is required")

        strategies = self.get_strategies_for_phase(phase)
        if not strategies:
            logger.debug(f"No strategies for phase: {phase}")
            return []

        self.state_manager.set_current_phase(phase)

        results = []
        for strategy_info in strategies:
            if strategy_info.strategy_class:
                # Add strategy to cerebro
                cerebro.addstrategy(
                    strategy_info.strategy_class,
                    state_manager=self.state_manager,
                    **strategy_info.params,
                )

                logger.info(
                    f"Added strategy to cerebro: {strategy_info.strategy_name} "
                    f"(phase={phase})"
                )

        return results

    # ==========================================================================
    # Serialization
    # ==========================================================================

    def to_dict(self) -> Dict[str, Any]:
        """Serialize strategy group to dictionary."""
        return {
            phase: [s.to_dict() for s in strategies]
            for phase, strategies in self._strategies.items()
        }

    def get_phase_summary(self) -> Dict[str, int]:
        """Get count of strategies per phase."""
        return {
            phase: len(strategies)
            for phase, strategies in self._strategies.items()
        }

    def clear(self) -> None:
        """Clear all loaded strategies."""
        for phase in self._strategies:
            self._strategies[phase].clear()
        self._loaded_classes.clear()
        logger.debug("StrategyGroup cleared")
