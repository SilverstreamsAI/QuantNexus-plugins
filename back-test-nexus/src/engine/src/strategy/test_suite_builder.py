"""
Test Suite Builder

Ported from: nona_server/src/backtest/backtest_workflow_tools.py

Builds test suites for multi-strategy backtest execution.
Handles test case configuration and strategy grouping.
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Constants (from server's constants/business/*)
DEFAULT_INITIAL_CASH = 100000.0
DEFAULT_STRATEGY_BASE = "BaseStrategy"
DEFAULT_EXECUTION_ORDER = [
    "direction",
    "analysis",
    "precondition",
    "execution",
    "postcondition"
]

# Phase constants
PHASE_DIRECTION = "direction"
PHASE_ANALYSIS = "analysis"
PHASE_PRECONDITION = "precondition"
PHASE_EXECUTION = "execution"
PHASE_POSTCONDITION = "postcondition"

STANDARD_PHASES = [
    PHASE_DIRECTION,
    PHASE_ANALYSIS,
    PHASE_PRECONDITION,
    PHASE_EXECUTION,
    PHASE_POSTCONDITION
]


@dataclass
class TestCase:
    """
    Test case configuration.

    Represents a single backtest test case with its component strategies.
    """
    components: List[str]
    strategy_base: str = DEFAULT_STRATEGY_BASE
    initial_cash: float = DEFAULT_INITIAL_CASH
    strategy_configs: Dict[str, Any] = field(default_factory=dict)
    execution_order: List[str] = field(default_factory=lambda: DEFAULT_EXECUTION_ORDER.copy())


class TestSuiteBuilder:
    """
    Test suite builder.

    Port from: server's TestSuiteManager (backtest_workflow_tools.py)

    Builds and manages test suites for backtest execution.

    Usage:
        >>> builder = TestSuiteBuilder()
        >>> builder.add_test_case(
        ...     components=["TrendStrategy", "RiskManager"],
        ...     initial_cash=100000.0
        ... )
        >>> test_cases = builder.get_test_cases()
    """

    def __init__(self):
        """Initialize test suite builder."""
        self.test_cases: List[TestCase] = []
        logger.debug("TestSuiteBuilder initialized")

    def add_test_case(
        self,
        components: List[str],
        strategy_base: str = DEFAULT_STRATEGY_BASE,
        initial_cash: float = DEFAULT_INITIAL_CASH,
        strategy_configs: Optional[Dict] = None,
        execution_order: Optional[List[str]] = None,
    ) -> None:
        """
        Add a test case to the suite.

        Port from: server's TestSuiteManager.add_test_case()

        Args:
            components: List of component strategy names
            strategy_base: Strategy base class name
            initial_cash: Initial capital
            strategy_configs: Complete strategy configuration dict
            execution_order: Strategy execution order

        Example:
            >>> builder = TestSuiteBuilder()
            >>> builder.add_test_case(
            ...     components=["TrendStrategy", "ExecutionStrategy"],
            ...     initial_cash=100000.0
            ... )
        """
        test_case = TestCase(
            components=components,
            strategy_base=strategy_base,
            initial_cash=initial_cash,
            strategy_configs=strategy_configs or {},
            execution_order=execution_order or DEFAULT_EXECUTION_ORDER.copy(),
        )
        self.test_cases.append(test_case)
        logger.debug(
            f"Added test case: {len(components)} components, "
            f"initial_cash={initial_cash}"
        )

    def get_test_cases(self) -> List[TestCase]:
        """
        Get all test cases.

        Returns:
            list: List of TestCase objects
        """
        return self.test_cases

    def get_test_case_dicts(self) -> List[Dict]:
        """
        Get test cases as dictionaries (for Cerebro compatibility).

        Returns:
            list: List of test case dictionaries

        Example:
            >>> builder = TestSuiteBuilder()
            >>> builder.add_test_case(...)
            >>> dicts = builder.get_test_case_dicts()
            >>> print(dicts[0]['initial_cash'])
            100000.0
        """
        return [
            {
                "components": tc.components,
                "strategy_base": tc.strategy_base,
                "initial_cash": tc.initial_cash,
                "strategy_configs": tc.strategy_configs,
                "execution_order": tc.execution_order,
            }
            for tc in self.test_cases
        ]

    def clear(self) -> None:
        """Clear all test cases."""
        self.test_cases.clear()
        logger.debug("Test cases cleared")

    def count(self) -> int:
        """Get number of test cases."""
        return len(self.test_cases)


def create_test_suites_from_request(
    request_data: Dict[str, Any],
    loaded_strategies: List[Dict],
    initial_capital: float = DEFAULT_INITIAL_CASH,
) -> List[Dict]:
    """
    Create test suites from backtest request data.

    Port from: server's create_parallel_test_suites() function

    Args:
        request_data: Parsed request data (from RequestParser)
        loaded_strategies: List of loaded strategy dictionaries
        initial_capital: Initial capital (default: 100000)

    Returns:
        list: List of test suite dictionaries

    Example:
        >>> request_data = {...}
        >>> strategies = [{"strategy_name": "Trend", "code": "..."}]
        >>> suites = create_test_suites_from_request(request_data, strategies)
        >>> print(len(suites))
        1
    """
    test_suites = []

    # Extract test cases from request
    test_cases = request_data.get("testCases") or request_data.get("test_cases") or []

    if not test_cases:
        logger.warning("No test cases found in request data")
        return []

    for test_case in test_cases:
        # Build component list from test case phases
        components = []
        strategy_configs = {}

        for phase in STANDARD_PHASES:
            strategy_name = test_case.get(phase)
            if strategy_name:
                components.append(strategy_name)

                # Find strategy in loaded strategies
                strategy_data = None
                for s in loaded_strategies:
                    if s.get("strategy_name") == strategy_name:
                        strategy_data = s
                        break

                if strategy_data:
                    strategy_configs[phase] = {
                        "strategy_name": strategy_name,
                        "strategy_code": strategy_data.get("code", ""),
                        "strategy_id": strategy_data.get("id"),
                        "strategy_config": {},  # Additional config can be added here
                    }

        if components:
            suite = {
                "components": components,
                "strategy_base": DEFAULT_STRATEGY_BASE,
                "initial_cash": initial_capital,
                "strategy_configs": strategy_configs,
                "execution_order": DEFAULT_EXECUTION_ORDER.copy(),
            }
            test_suites.append(suite)

    logger.info(f"Created {len(test_suites)} test suite(s)")
    return test_suites


def create_test_suite_from_strategies(
    strategies: List[Dict],
    initial_capital: float = DEFAULT_INITIAL_CASH,
    execution_order: Optional[List[str]] = None,
) -> Dict:
    """
    Create a single test suite from strategy list.

    Simple helper for single-strategy or sequential strategy execution.

    Args:
        strategies: List of strategy dictionaries
        initial_capital: Initial capital
        execution_order: Execution order (optional)

    Returns:
        dict: Test suite dictionary

    Example:
        >>> strategies = [
        ...     {"strategy_name": "Trend", "code": "..."},
        ...     {"strategy_name": "Execution", "code": "..."}
        ... ]
        >>> suite = create_test_suite_from_strategies(strategies)
        >>> print(suite['components'])
        ['Trend', 'Execution']
    """
    components = []
    strategy_configs = {}

    for i, strategy in enumerate(strategies):
        strategy_name = strategy.get("strategy_name", f"Strategy_{i}")
        components.append(strategy_name)

        # Assign to execution phase by default
        phase = PHASE_EXECUTION
        strategy_configs[phase] = {
            "strategy_name": strategy_name,
            "strategy_code": strategy.get("code", ""),
            "strategy_id": strategy.get("id"),
            "strategy_config": {},
        }

    return {
        "components": components,
        "strategy_base": DEFAULT_STRATEGY_BASE,
        "initial_cash": initial_capital,
        "strategy_configs": strategy_configs,
        "execution_order": execution_order or DEFAULT_EXECUTION_ORDER.copy(),
    }


def validate_test_suite(suite: Dict) -> bool:
    """
    Validate test suite structure.

    Args:
        suite: Test suite dictionary

    Returns:
        bool: True if valid

    Raises:
        ValueError: If validation fails with specific error message
    """
    # Check required fields
    if "components" not in suite:
        raise ValueError("Test suite missing 'components' field")

    if not isinstance(suite["components"], list):
        raise ValueError("'components' must be a list")

    if len(suite["components"]) == 0:
        raise ValueError("'components' cannot be empty")

    if "initial_cash" not in suite:
        raise ValueError("Test suite missing 'initial_cash' field")

    if suite["initial_cash"] <= 0:
        raise ValueError(f"'initial_cash' must be positive, got {suite['initial_cash']}")

    # Check strategy configs
    if "strategy_configs" in suite:
        configs = suite["strategy_configs"]
        if not isinstance(configs, dict):
            raise ValueError("'strategy_configs' must be a dictionary")

    logger.debug("Test suite validation passed")
    return True
