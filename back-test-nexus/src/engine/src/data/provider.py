"""
Data Provider Integration

Provides data fetching capabilities from various sources.
Supports built-in mock data, Data Provider plugin, and file-based data.

Features:
1. Abstract data provider interface
2. Built-in mock data generation
3. Data Provider plugin integration (via gRPC)
4. File-based data loading (CSV, Parquet)
5. Data caching for performance
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum

import pandas as pd
import numpy as np

try:
    import backtrader as bt
except ImportError:
    bt = None

logger = logging.getLogger(__name__)


class DataSourceType(Enum):
    """Data source types."""
    MOCK = "mock"
    FILE = "file"
    PLUGIN = "plugin"
    API = "api"


@dataclass
class TimeRange:
    """Time range specification."""
    start: datetime
    end: datetime
    timeframe: str = "1D"  # 1m, 5m, 15m, 1h, 4h, 1D

    @classmethod
    def from_proto(cls, proto) -> "TimeRange":
        """Create from proto message."""
        return cls(
            start=datetime.fromtimestamp(proto.start_timestamp / 1000)
            if proto.start_timestamp else datetime(2023, 1, 1),
            end=datetime.fromtimestamp(proto.end_timestamp / 1000)
            if proto.end_timestamp else datetime.now(),
            timeframe=proto.timeframe or "1D",
        )

    @classmethod
    def last_days(cls, days: int, timeframe: str = "1D") -> "TimeRange":
        """Create time range for last N days."""
        end = datetime.now()
        start = end - timedelta(days=days)
        return cls(start=start, end=end, timeframe=timeframe)


@dataclass
class OHLCVData:
    """OHLCV data container."""
    symbol: str
    timeframe: str
    data: pd.DataFrame  # datetime, open, high, low, close, volume

    @property
    def bar_count(self) -> int:
        return len(self.data)

    def to_backtrader_feed(self) -> "bt.feeds.PandasData":
        """Convert to Backtrader data feed."""
        if bt is None:
            raise ImportError("Backtrader is required")

        df = self.data.copy()
        if "datetime" in df.columns:
            df.set_index("datetime", inplace=True)

        feed = bt.feeds.PandasData(
            dataname=df,
            datetime=None,
            open="open",
            high="high",
            low="low",
            close="close",
            volume="volume",
            openinterest=-1,
        )
        feed._name = self.symbol

        return feed


class DataProvider(ABC):
    """Abstract base class for data providers."""

    @abstractmethod
    def get_data(
        self,
        symbol: str,
        time_range: TimeRange,
    ) -> Optional[OHLCVData]:
        """
        Fetch OHLCV data for a symbol.

        Args:
            symbol: Trading symbol (e.g., "BTCUSDT")
            time_range: Time range to fetch

        Returns:
            OHLCVData or None if not available
        """
        pass

    @abstractmethod
    def get_available_symbols(self) -> List[str]:
        """Get list of available symbols."""
        pass

    @abstractmethod
    def get_source_type(self) -> DataSourceType:
        """Get the data source type."""
        pass


class MockDataProvider(DataProvider):
    """
    Mock data provider for testing.

    Generates random walk price data for any symbol.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        logger.info("MockDataProvider initialized")

    def get_data(
        self,
        symbol: str,
        time_range: TimeRange,
    ) -> Optional[OHLCVData]:
        """Generate mock OHLCV data."""
        logger.info(
            f"Generating mock data: symbol={symbol}, "
            f"timeframe={time_range.timeframe}"
        )

        # Calculate number of bars
        duration = time_range.end - time_range.start
        freq_map = {
            "1m": "1min",
            "5m": "5min",
            "15m": "15min",
            "1h": "1H",
            "4h": "4H",
            "1D": "1D",
            "1W": "1W",
        }
        freq = freq_map.get(time_range.timeframe, "1D")

        # Generate dates
        dates = pd.date_range(
            start=time_range.start,
            end=time_range.end,
            freq=freq,
        )

        if len(dates) == 0:
            dates = pd.date_range(start=time_range.start, periods=100, freq=freq)

        bars = len(dates)

        # Generate random walk prices
        np.random.seed(self.seed)
        returns = np.random.normal(0.0002, 0.02, bars)
        close = 100 * np.exp(np.cumsum(returns))

        # Generate OHLCV
        high = close * (1 + np.abs(np.random.normal(0, 0.01, bars)))
        low = close * (1 - np.abs(np.random.normal(0, 0.01, bars)))
        open_ = low + (high - low) * np.random.random(bars)
        volume = np.random.uniform(1000000, 10000000, bars)

        df = pd.DataFrame({
            "datetime": dates,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        })

        return OHLCVData(
            symbol=symbol,
            timeframe=time_range.timeframe,
            data=df,
        )

    def get_available_symbols(self) -> List[str]:
        """Return common mock symbols."""
        return ["BTCUSDT", "ETHUSDT", "AAPL", "GOOGL", "MSFT"]

    def get_source_type(self) -> DataSourceType:
        return DataSourceType.MOCK


class FileDataProvider(DataProvider):
    """
    File-based data provider.

    Loads data from CSV or Parquet files.
    """

    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._cache: Dict[str, OHLCVData] = {}
        logger.info(f"FileDataProvider initialized: data_dir={data_dir}")

    def get_data(
        self,
        symbol: str,
        time_range: TimeRange,
    ) -> Optional[OHLCVData]:
        """Load data from file."""
        cache_key = f"{symbol}_{time_range.timeframe}"

        # Check cache
        if cache_key in self._cache:
            data = self._cache[cache_key]
            # Filter by time range
            mask = (
                (data.data["datetime"] >= time_range.start) &
                (data.data["datetime"] <= time_range.end)
            )
            filtered_df = data.data[mask].copy()
            return OHLCVData(
                symbol=symbol,
                timeframe=time_range.timeframe,
                data=filtered_df,
            )

        # Try to load file
        import os

        for ext in [".parquet", ".csv"]:
            filename = f"{symbol}_{time_range.timeframe}{ext}"
            filepath = os.path.join(self.data_dir, filename)

            if os.path.exists(filepath):
                try:
                    if ext == ".parquet":
                        df = pd.read_parquet(filepath)
                    else:
                        df = pd.read_csv(filepath, parse_dates=["datetime"])

                    data = OHLCVData(
                        symbol=symbol,
                        timeframe=time_range.timeframe,
                        data=df,
                    )
                    self._cache[cache_key] = data

                    # Filter by time range
                    mask = (
                        (df["datetime"] >= time_range.start) &
                        (df["datetime"] <= time_range.end)
                    )
                    filtered_df = df[mask].copy()

                    logger.info(f"Loaded data from {filepath}: {len(filtered_df)} bars")

                    return OHLCVData(
                        symbol=symbol,
                        timeframe=time_range.timeframe,
                        data=filtered_df,
                    )

                except Exception as e:
                    logger.error(f"Error loading {filepath}: {e}")

        logger.warning(f"No data file found for {symbol}")
        return None

    def get_available_symbols(self) -> List[str]:
        """Scan data directory for available symbols."""
        import os

        symbols = set()
        if os.path.exists(self.data_dir):
            for filename in os.listdir(self.data_dir):
                if filename.endswith((".csv", ".parquet")):
                    # Extract symbol from filename
                    parts = filename.rsplit("_", 1)
                    if len(parts) >= 1:
                        symbols.add(parts[0])

        return list(symbols)

    def get_source_type(self) -> DataSourceType:
        return DataSourceType.FILE


class DataProviderManager:
    """
    Manages multiple data providers with fallback support.

    Tries providers in order until data is found.
    """

    def __init__(self):
        self._providers: List[DataProvider] = []
        self._default_provider: Optional[DataProvider] = None
        logger.info("DataProviderManager initialized")

    def add_provider(self, provider: DataProvider, default: bool = False) -> None:
        """Add a data provider."""
        self._providers.append(provider)
        if default:
            self._default_provider = provider
        logger.info(f"Added provider: {provider.get_source_type().value}")

    def get_data(
        self,
        symbol: str,
        time_range: TimeRange,
    ) -> Optional[OHLCVData]:
        """
        Get data from providers with fallback.

        Tries each provider in order until data is found.
        """
        for provider in self._providers:
            try:
                data = provider.get_data(symbol, time_range)
                if data and data.bar_count > 0:
                    logger.info(
                        f"Got data from {provider.get_source_type().value}: "
                        f"{symbol}, {data.bar_count} bars"
                    )
                    return data
            except Exception as e:
                logger.warning(
                    f"Provider {provider.get_source_type().value} failed: {e}"
                )

        # Fallback to default provider
        if self._default_provider:
            return self._default_provider.get_data(symbol, time_range)

        logger.warning(f"No data found for {symbol}")
        return None

    def get_multiple(
        self,
        symbols: List[str],
        time_range: TimeRange,
    ) -> Dict[str, OHLCVData]:
        """Get data for multiple symbols."""
        result = {}
        for symbol in symbols:
            data = self.get_data(symbol, time_range)
            if data:
                result[symbol] = data
        return result


def create_default_provider_manager() -> DataProviderManager:
    """Create default data provider manager with mock fallback."""
    manager = DataProviderManager()

    # Add file provider first (if data files exist)
    manager.add_provider(FileDataProvider())

    # Add mock provider as fallback
    manager.add_provider(MockDataProvider(), default=True)

    return manager
