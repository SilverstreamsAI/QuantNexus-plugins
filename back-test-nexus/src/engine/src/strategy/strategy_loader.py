"""
Strategy Loader

Ported from: nona_server/src/strategies/managers/strategy_loader.py

Dynamically creates strategy classes from code strings.
Simplified version for Desktop (no Freqtrade support initially).
"""

import logging
import sys
import types
from typing import Type, Dict, Any, Optional
import backtrader as bt
import numpy as np

logger = logging.getLogger(__name__)


class StrategyLoader:
    """
    Strategy loader for dynamic strategy creation.

    Port from: server's StrategyLoader

    Loads strategy code from database and creates executable strategy classes.

    Usage:
        >>> loader = StrategyLoader()
        >>> loader.load_base_classes()
        >>> strategy_class = loader.create_strategy_class(
        ...     strategy_code="class MyStrategy(bt.Strategy): ...",
        ...     strategy_id=1
        ... )
        >>> cerebro.addstrategy(strategy_class)
    """

    def __init__(self):
        """Initialize strategy loader."""
        self.loaded_bases: Dict[str, Type] = {}
        self.strategy_modules = set()
        logger.debug("StrategyLoader initialized")

    def load_base_classes(self) -> None:
        """
        Load base strategy classes.

        Port from: server's StrategyLoader.load_base_classes()

        Loads common base classes that strategies might inherit from.
        For Desktop, we start with just bt.Strategy.
        """
        # Base Backtrader Strategy
        self.loaded_bases["Strategy"] = bt.Strategy

        logger.info(f"Loaded {len(self.loaded_bases)} base class(es)")

    def create_strategy_class(
        self,
        strategy_code: str,
        strategy_id: int,
        strategy_name: Optional[str] = None,
    ) -> Type[bt.Strategy]:
        """
        Create strategy class from code string.

        Port from: server's StrategyLoader.create_strategy_class()

        Args:
            strategy_code: Python code defining the strategy class
            strategy_id: Strategy ID (for module naming)
            strategy_name: Strategy name (optional, for validation)

        Returns:
            Type[bt.Strategy]: Strategy class ready for Cerebro

        Raises:
            ValueError: If code is invalid or no strategy class found

        Example:
            >>> code = '''
            ... class TrendStrategy(bt.Strategy):
            ...     def __init__(self):
            ...         self.sma = bt.indicators.SMA(self.data.close, period=20)
            ...
            ...     def next(self):
            ...         if self.data.close[0] > self.sma[0]:
            ...             self.buy()
            ...         elif self.data.close[0] < self.sma[0]:
            ...             self.sell()
            ... '''
            >>> strategy_class = loader.create_strategy_class(code, 1)
            >>> print(strategy_class.__name__)
            TrendStrategy
        """
        try:
            logger.info(f"Creating strategy class for ID {strategy_id}")

            # Load base classes if not already loaded
            if not self.loaded_bases:
                logger.debug("Loading base classes")
                self.load_base_classes()

            # Create unique module name
            module_name = f"strategies.dynamic.strategy_{strategy_id}"
            logger.debug(f"Module name: {module_name}")

            # Remove old module if exists (force fresh load)
            if module_name in sys.modules:
                logger.warning(f"Removing old module from cache: {module_name}")
                del sys.modules[module_name]
                if module_name in self.strategy_modules:
                    self.strategy_modules.remove(module_name)

            # Create new module
            module = types.ModuleType(module_name)
            sys.modules[module_name] = module
            self.strategy_modules.add(module_name)

            # Inject dependencies into module namespace
            module.__dict__["bt"] = bt
            module.__dict__["np"] = np
            module.__dict__["backtrader"] = bt  # Alias

            # Inject base classes
            for base_name, base_class in self.loaded_bases.items():
                module.__dict__[base_name] = base_class

            logger.debug(f"Executing strategy code (length={len(strategy_code)})")

            # Execute strategy code in module namespace
            exec(strategy_code, module.__dict__)

            logger.debug("Strategy code executed successfully")

            # Find strategy class in module
            strategy_class = self._find_strategy_class(module.__dict__)

            # Set module and ID attributes
            strategy_class.__module__ = module_name
            strategy_class.strategy_id = strategy_id

            logger.info(
                f"Successfully created strategy class: {strategy_class.__name__} "
                f"(ID={strategy_id})"
            )

            # Validate class name if strategy_name provided
            if strategy_name and strategy_class.__name__ != strategy_name:
                logger.warning(
                    f"Strategy class name mismatch: "
                    f"expected={strategy_name}, actual={strategy_class.__name__}"
                )

            return strategy_class

        except Exception as e:
            logger.error(
                f"Error creating strategy class for ID {strategy_id}: {e}",
                exc_info=True
            )
            raise ValueError(
                f"Failed to create strategy class (ID={strategy_id}): {e}"
            ) from e

    def _find_strategy_class(self, module_dict: dict) -> Type[bt.Strategy]:
        """
        Find strategy class in module namespace.

        Port from: server's StrategyLoader._find_strategy_class()

        Args:
            module_dict: Module's __dict__

        Returns:
            Type[bt.Strategy]: Found strategy class

        Raises:
            ValueError: If no strategy class found or multiple found
        """
        strategy_classes = []

        for item_name, item in module_dict.items():
            # Check if it's a class and subclass of bt.Strategy
            # Exclude base classes we injected
            if (
                isinstance(item, type)
                and issubclass(item, bt.Strategy)
                and item not in self.loaded_bases.values()
                and item is not bt.Strategy  # Exclude bt.Strategy itself
            ):
                strategy_classes.append(item)
                logger.debug(f"Found strategy class: {item.__name__}")

        if not strategy_classes:
            raise ValueError(
                "No strategy class found in code. "
                "Strategy code must define a class that inherits from bt.Strategy."
            )

        if len(strategy_classes) > 1:
            class_names = [cls.__name__ for cls in strategy_classes]
            raise ValueError(
                f"Multiple strategy classes found: {class_names}. "
                f"Code should define exactly one strategy class."
            )

        return strategy_classes[0]

    def cleanup(self) -> None:
        """
        Cleanup loaded modules.

        Removes dynamically created strategy modules from sys.modules.
        """
        for module_name in list(self.strategy_modules):
            if module_name in sys.modules:
                del sys.modules[module_name]

        self.strategy_modules.clear()
        logger.debug("Strategy modules cleaned up")


def create_strategy_from_config(
    strategy_config: Dict[str, Any],
    strategy_loader: Optional[StrategyLoader] = None
) -> Type[bt.Strategy]:
    """
    Create strategy class from strategy config dictionary.

    Helper function to simplify strategy creation from test suite configs.

    Args:
        strategy_config: Strategy configuration with keys:
            - strategy_id: Strategy ID
            - strategy_name: Strategy name
            - strategy_code: Python code string
        strategy_loader: Existing StrategyLoader instance (optional)

    Returns:
        Type[bt.Strategy]: Strategy class

    Example:
        >>> config = {
        ...     'strategy_id': 1,
        ...     'strategy_name': 'TrendStrategy',
        ...     'strategy_code': 'class TrendStrategy(bt.Strategy): ...'
        ... }
        >>> strategy_class = create_strategy_from_config(config)
    """
    strategy_id = strategy_config.get("strategy_id")
    strategy_name = strategy_config.get("strategy_name")
    strategy_code = strategy_config.get("strategy_code")

    if not strategy_id:
        raise ValueError("strategy_config missing 'strategy_id'")

    if not strategy_code:
        raise ValueError(f"strategy_config missing 'strategy_code' for ID {strategy_id}")

    # Create or reuse loader
    if strategy_loader is None:
        strategy_loader = StrategyLoader()

    # Create strategy class
    return strategy_loader.create_strategy_class(
        strategy_code=strategy_code,
        strategy_id=strategy_id,
        strategy_name=strategy_name
    )
