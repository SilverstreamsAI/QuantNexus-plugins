import common_pb2 as _common_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ProgressStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    PROGRESS_STATUS_UNSPECIFIED: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_QUEUED: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_INITIALIZING: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_LOADING_DATA: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_RUNNING: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_CALCULATING_METRICS: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_COMPLETED: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_FAILED: _ClassVar[ProgressStatus]
    PROGRESS_STATUS_CANCELLED: _ClassVar[ProgressStatus]

class StrategyType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    STRATEGY_TYPE_UNSPECIFIED: _ClassVar[StrategyType]
    STRATEGY_TYPE_TREND: _ClassVar[StrategyType]
    STRATEGY_TYPE_MEAN_REVERSION: _ClassVar[StrategyType]
    STRATEGY_TYPE_MOMENTUM: _ClassVar[StrategyType]
    STRATEGY_TYPE_ARBITRAGE: _ClassVar[StrategyType]
    STRATEGY_TYPE_ML_BASED: _ClassVar[StrategyType]
    STRATEGY_TYPE_FACTOR: _ClassVar[StrategyType]
    STRATEGY_TYPE_CUSTOM: _ClassVar[StrategyType]

class Permission(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    PERMISSION_UNSPECIFIED: _ClassVar[Permission]
    PERMISSION_READ_KLINE: _ClassVar[Permission]
    PERMISSION_READ_TICK: _ClassVar[Permission]
    PERMISSION_READ_POSITION: _ClassVar[Permission]
    PERMISSION_WRITE_SIGNAL: _ClassVar[Permission]
    PERMISSION_EXECUTE_PAPER: _ClassVar[Permission]
    PERMISSION_EXECUTE_LIVE: _ClassVar[Permission]

class DataType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    DATA_TYPE_UNSPECIFIED: _ClassVar[DataType]
    DATA_TYPE_KLINE: _ClassVar[DataType]
    DATA_TYPE_TICK: _ClassVar[DataType]
    DATA_TYPE_QUOTE: _ClassVar[DataType]
    DATA_TYPE_DEPTH: _ClassVar[DataType]

class SignalType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_TYPE_UNSPECIFIED: _ClassVar[SignalType]
    SIGNAL_TYPE_BUY: _ClassVar[SignalType]
    SIGNAL_TYPE_SELL: _ClassVar[SignalType]
    SIGNAL_TYPE_HOLD: _ClassVar[SignalType]
    SIGNAL_TYPE_CLOSE_LONG: _ClassVar[SignalType]
    SIGNAL_TYPE_CLOSE_SHORT: _ClassVar[SignalType]

class SignalStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_STATUS_UNSPECIFIED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_RECEIVED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_VALIDATED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_QUEUED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_EXECUTED: _ClassVar[SignalStatus]
    SIGNAL_STATUS_REJECTED: _ClassVar[SignalStatus]

class ReportType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    REPORT_TYPE_UNSPECIFIED: _ClassVar[ReportType]
    REPORT_TYPE_MARKET_ANALYSIS: _ClassVar[ReportType]
    REPORT_TYPE_FACTOR_REPORT: _ClassVar[ReportType]
    REPORT_TYPE_BACKTEST_RESULT: _ClassVar[ReportType]
    REPORT_TYPE_RISK_ASSESSMENT: _ClassVar[ReportType]
    REPORT_TYPE_PERFORMANCE: _ClassVar[ReportType]

class SessionState(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SESSION_STATE_UNSPECIFIED: _ClassVar[SessionState]
    SESSION_STATE_REGISTERED: _ClassVar[SessionState]
    SESSION_STATE_ACTIVE: _ClassVar[SessionState]
    SESSION_STATE_IDLE: _ClassVar[SessionState]
    SESSION_STATE_ERROR: _ClassVar[SessionState]
    SESSION_STATE_DISCONNECTED: _ClassVar[SessionState]
PROGRESS_STATUS_UNSPECIFIED: ProgressStatus
PROGRESS_STATUS_QUEUED: ProgressStatus
PROGRESS_STATUS_INITIALIZING: ProgressStatus
PROGRESS_STATUS_LOADING_DATA: ProgressStatus
PROGRESS_STATUS_RUNNING: ProgressStatus
PROGRESS_STATUS_CALCULATING_METRICS: ProgressStatus
PROGRESS_STATUS_COMPLETED: ProgressStatus
PROGRESS_STATUS_FAILED: ProgressStatus
PROGRESS_STATUS_CANCELLED: ProgressStatus
STRATEGY_TYPE_UNSPECIFIED: StrategyType
STRATEGY_TYPE_TREND: StrategyType
STRATEGY_TYPE_MEAN_REVERSION: StrategyType
STRATEGY_TYPE_MOMENTUM: StrategyType
STRATEGY_TYPE_ARBITRAGE: StrategyType
STRATEGY_TYPE_ML_BASED: StrategyType
STRATEGY_TYPE_FACTOR: StrategyType
STRATEGY_TYPE_CUSTOM: StrategyType
PERMISSION_UNSPECIFIED: Permission
PERMISSION_READ_KLINE: Permission
PERMISSION_READ_TICK: Permission
PERMISSION_READ_POSITION: Permission
PERMISSION_WRITE_SIGNAL: Permission
PERMISSION_EXECUTE_PAPER: Permission
PERMISSION_EXECUTE_LIVE: Permission
DATA_TYPE_UNSPECIFIED: DataType
DATA_TYPE_KLINE: DataType
DATA_TYPE_TICK: DataType
DATA_TYPE_QUOTE: DataType
DATA_TYPE_DEPTH: DataType
SIGNAL_TYPE_UNSPECIFIED: SignalType
SIGNAL_TYPE_BUY: SignalType
SIGNAL_TYPE_SELL: SignalType
SIGNAL_TYPE_HOLD: SignalType
SIGNAL_TYPE_CLOSE_LONG: SignalType
SIGNAL_TYPE_CLOSE_SHORT: SignalType
SIGNAL_STATUS_UNSPECIFIED: SignalStatus
SIGNAL_STATUS_RECEIVED: SignalStatus
SIGNAL_STATUS_VALIDATED: SignalStatus
SIGNAL_STATUS_QUEUED: SignalStatus
SIGNAL_STATUS_EXECUTED: SignalStatus
SIGNAL_STATUS_REJECTED: SignalStatus
REPORT_TYPE_UNSPECIFIED: ReportType
REPORT_TYPE_MARKET_ANALYSIS: ReportType
REPORT_TYPE_FACTOR_REPORT: ReportType
REPORT_TYPE_BACKTEST_RESULT: ReportType
REPORT_TYPE_RISK_ASSESSMENT: ReportType
REPORT_TYPE_PERFORMANCE: ReportType
SESSION_STATE_UNSPECIFIED: SessionState
SESSION_STATE_REGISTERED: SessionState
SESSION_STATE_ACTIVE: SessionState
SESSION_STATE_IDLE: SessionState
SESSION_STATE_ERROR: SessionState
SESSION_STATE_DISCONNECTED: SessionState

class InitializeRequest(_message.Message):
    __slots__ = ("db_path", "log_path", "data_dir", "config")
    class ConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    DB_PATH_FIELD_NUMBER: _ClassVar[int]
    LOG_PATH_FIELD_NUMBER: _ClassVar[int]
    DATA_DIR_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    db_path: str
    log_path: str
    data_dir: str
    config: _containers.ScalarMap[str, str]
    def __init__(self, db_path: _Optional[str] = ..., log_path: _Optional[str] = ..., data_dir: _Optional[str] = ..., config: _Optional[_Mapping[str, str]] = ...) -> None: ...

class InitializeResponse(_message.Message):
    __slots__ = ("success", "message", "plugin_version", "accepted_config")
    class AcceptedConfigEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    PLUGIN_VERSION_FIELD_NUMBER: _ClassVar[int]
    ACCEPTED_CONFIG_FIELD_NUMBER: _ClassVar[int]
    success: bool
    message: str
    plugin_version: str
    accepted_config: _containers.ScalarMap[str, str]
    def __init__(self, success: bool = ..., message: _Optional[str] = ..., plugin_version: _Optional[str] = ..., accepted_config: _Optional[_Mapping[str, str]] = ...) -> None: ...

class BacktestRequest(_message.Message):
    __slots__ = ("task_id", "strategy_id", "strategy_code", "strategy_language", "time_range", "symbols", "config", "data_source", "parameters", "options")
    class ParametersEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_CODE_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_LANGUAGE_FIELD_NUMBER: _ClassVar[int]
    TIME_RANGE_FIELD_NUMBER: _ClassVar[int]
    SYMBOLS_FIELD_NUMBER: _ClassVar[int]
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    DATA_SOURCE_FIELD_NUMBER: _ClassVar[int]
    PARAMETERS_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    strategy_id: str
    strategy_code: str
    strategy_language: str
    time_range: _common_pb2.TimeRange
    symbols: _containers.RepeatedScalarFieldContainer[str]
    config: BacktestConfig
    data_source: str
    parameters: _containers.ScalarMap[str, str]
    options: BacktestOptions
    def __init__(self, task_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., strategy_code: _Optional[str] = ..., strategy_language: _Optional[str] = ..., time_range: _Optional[_Union[_common_pb2.TimeRange, _Mapping]] = ..., symbols: _Optional[_Iterable[str]] = ..., config: _Optional[_Union[BacktestConfig, _Mapping]] = ..., data_source: _Optional[str] = ..., parameters: _Optional[_Mapping[str, str]] = ..., options: _Optional[_Union[BacktestOptions, _Mapping]] = ...) -> None: ...

class BacktestConfig(_message.Message):
    __slots__ = ("initial_capital", "commission_rate", "slippage_rate", "leverage", "currency", "allow_short", "fractional_shares")
    INITIAL_CAPITAL_FIELD_NUMBER: _ClassVar[int]
    COMMISSION_RATE_FIELD_NUMBER: _ClassVar[int]
    SLIPPAGE_RATE_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    ALLOW_SHORT_FIELD_NUMBER: _ClassVar[int]
    FRACTIONAL_SHARES_FIELD_NUMBER: _ClassVar[int]
    initial_capital: float
    commission_rate: float
    slippage_rate: float
    leverage: float
    currency: str
    allow_short: bool
    fractional_shares: bool
    def __init__(self, initial_capital: _Optional[float] = ..., commission_rate: _Optional[float] = ..., slippage_rate: _Optional[float] = ..., leverage: _Optional[float] = ..., currency: _Optional[str] = ..., allow_short: bool = ..., fractional_shares: bool = ...) -> None: ...

class BacktestOptions(_message.Message):
    __slots__ = ("return_trades", "return_equity_curve", "return_positions", "equity_curve_interval", "enable_logging")
    RETURN_TRADES_FIELD_NUMBER: _ClassVar[int]
    RETURN_EQUITY_CURVE_FIELD_NUMBER: _ClassVar[int]
    RETURN_POSITIONS_FIELD_NUMBER: _ClassVar[int]
    EQUITY_CURVE_INTERVAL_FIELD_NUMBER: _ClassVar[int]
    ENABLE_LOGGING_FIELD_NUMBER: _ClassVar[int]
    return_trades: bool
    return_equity_curve: bool
    return_positions: bool
    equity_curve_interval: int
    enable_logging: bool
    def __init__(self, return_trades: bool = ..., return_equity_curve: bool = ..., return_positions: bool = ..., equity_curve_interval: _Optional[int] = ..., enable_logging: bool = ...) -> None: ...

class BacktestProgress(_message.Message):
    __slots__ = ("task_id", "status", "progress", "message", "current_timestamp", "trades_count", "current_equity", "started_at", "elapsed_ms", "estimated_remaining_ms")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    PROGRESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    CURRENT_TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    TRADES_COUNT_FIELD_NUMBER: _ClassVar[int]
    CURRENT_EQUITY_FIELD_NUMBER: _ClassVar[int]
    STARTED_AT_FIELD_NUMBER: _ClassVar[int]
    ELAPSED_MS_FIELD_NUMBER: _ClassVar[int]
    ESTIMATED_REMAINING_MS_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    status: ProgressStatus
    progress: float
    message: str
    current_timestamp: int
    trades_count: int
    current_equity: float
    started_at: int
    elapsed_ms: int
    estimated_remaining_ms: int
    def __init__(self, task_id: _Optional[str] = ..., status: _Optional[_Union[ProgressStatus, str]] = ..., progress: _Optional[float] = ..., message: _Optional[str] = ..., current_timestamp: _Optional[int] = ..., trades_count: _Optional[int] = ..., current_equity: _Optional[float] = ..., started_at: _Optional[int] = ..., elapsed_ms: _Optional[int] = ..., estimated_remaining_ms: _Optional[int] = ...) -> None: ...

class ResultRequest(_message.Message):
    __slots__ = ("task_id", "include_trades", "include_equity_curve")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    INCLUDE_TRADES_FIELD_NUMBER: _ClassVar[int]
    INCLUDE_EQUITY_CURVE_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    include_trades: bool
    include_equity_curve: bool
    def __init__(self, task_id: _Optional[str] = ..., include_trades: bool = ..., include_equity_curve: bool = ...) -> None: ...

class BacktestResult(_message.Message):
    __slots__ = ("task_id", "strategy_id", "status", "error_message", "metrics", "trades_data", "trades_count", "trades_format", "equity_curve_data", "equity_curve_points", "equity_curve_format", "started_at", "completed_at", "duration_ms", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    ERROR_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    METRICS_FIELD_NUMBER: _ClassVar[int]
    TRADES_DATA_FIELD_NUMBER: _ClassVar[int]
    TRADES_COUNT_FIELD_NUMBER: _ClassVar[int]
    TRADES_FORMAT_FIELD_NUMBER: _ClassVar[int]
    EQUITY_CURVE_DATA_FIELD_NUMBER: _ClassVar[int]
    EQUITY_CURVE_POINTS_FIELD_NUMBER: _ClassVar[int]
    EQUITY_CURVE_FORMAT_FIELD_NUMBER: _ClassVar[int]
    STARTED_AT_FIELD_NUMBER: _ClassVar[int]
    COMPLETED_AT_FIELD_NUMBER: _ClassVar[int]
    DURATION_MS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    strategy_id: str
    status: ProgressStatus
    error_message: str
    metrics: _common_pb2.Metrics
    trades_data: bytes
    trades_count: int
    trades_format: str
    equity_curve_data: bytes
    equity_curve_points: int
    equity_curve_format: str
    started_at: int
    completed_at: int
    duration_ms: int
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, task_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., status: _Optional[_Union[ProgressStatus, str]] = ..., error_message: _Optional[str] = ..., metrics: _Optional[_Union[_common_pb2.Metrics, _Mapping]] = ..., trades_data: _Optional[bytes] = ..., trades_count: _Optional[int] = ..., trades_format: _Optional[str] = ..., equity_curve_data: _Optional[bytes] = ..., equity_curve_points: _Optional[int] = ..., equity_curve_format: _Optional[str] = ..., started_at: _Optional[int] = ..., completed_at: _Optional[int] = ..., duration_ms: _Optional[int] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class CancelRequest(_message.Message):
    __slots__ = ("task_id", "reason")
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    task_id: str
    reason: str
    def __init__(self, task_id: _Optional[str] = ..., reason: _Optional[str] = ...) -> None: ...

class CancelResult(_message.Message):
    __slots__ = ("success", "task_id", "final_status", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    FINAL_STATUS_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    task_id: str
    final_status: ProgressStatus
    error: _common_pb2.Error
    def __init__(self, success: bool = ..., task_id: _Optional[str] = ..., final_status: _Optional[_Union[ProgressStatus, str]] = ..., error: _Optional[_Union[_common_pb2.Error, _Mapping]] = ...) -> None: ...

class BacktestCapabilities(_message.Message):
    __slots__ = ("supported_languages", "supported_frequencies", "supports_multi_symbol", "supports_leverage", "supports_short_selling", "supports_fractional_shares", "supports_custom_slippage", "supports_streaming_progress", "max_symbols", "max_lookback_days", "max_concurrent_backtests", "available_data_sources", "available_indicators")
    SUPPORTED_LANGUAGES_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_FREQUENCIES_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_MULTI_SYMBOL_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_SHORT_SELLING_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_FRACTIONAL_SHARES_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_CUSTOM_SLIPPAGE_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_STREAMING_PROGRESS_FIELD_NUMBER: _ClassVar[int]
    MAX_SYMBOLS_FIELD_NUMBER: _ClassVar[int]
    MAX_LOOKBACK_DAYS_FIELD_NUMBER: _ClassVar[int]
    MAX_CONCURRENT_BACKTESTS_FIELD_NUMBER: _ClassVar[int]
    AVAILABLE_DATA_SOURCES_FIELD_NUMBER: _ClassVar[int]
    AVAILABLE_INDICATORS_FIELD_NUMBER: _ClassVar[int]
    supported_languages: _containers.RepeatedScalarFieldContainer[str]
    supported_frequencies: _containers.RepeatedScalarFieldContainer[str]
    supports_multi_symbol: bool
    supports_leverage: bool
    supports_short_selling: bool
    supports_fractional_shares: bool
    supports_custom_slippage: bool
    supports_streaming_progress: bool
    max_symbols: int
    max_lookback_days: int
    max_concurrent_backtests: int
    available_data_sources: _containers.RepeatedScalarFieldContainer[str]
    available_indicators: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, supported_languages: _Optional[_Iterable[str]] = ..., supported_frequencies: _Optional[_Iterable[str]] = ..., supports_multi_symbol: bool = ..., supports_leverage: bool = ..., supports_short_selling: bool = ..., supports_fractional_shares: bool = ..., supports_custom_slippage: bool = ..., supports_streaming_progress: bool = ..., max_symbols: _Optional[int] = ..., max_lookback_days: _Optional[int] = ..., max_concurrent_backtests: _Optional[int] = ..., available_data_sources: _Optional[_Iterable[str]] = ..., available_indicators: _Optional[_Iterable[str]] = ...) -> None: ...

class BatchBacktestRequest(_message.Message):
    __slots__ = ("requests", "max_parallel")
    REQUESTS_FIELD_NUMBER: _ClassVar[int]
    MAX_PARALLEL_FIELD_NUMBER: _ClassVar[int]
    requests: _containers.RepeatedCompositeFieldContainer[BacktestRequest]
    max_parallel: int
    def __init__(self, requests: _Optional[_Iterable[_Union[BacktestRequest, _Mapping]]] = ..., max_parallel: _Optional[int] = ...) -> None: ...

class BatchBacktestResult(_message.Message):
    __slots__ = ("results", "succeeded", "failed", "total_duration_ms")
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    SUCCEEDED_FIELD_NUMBER: _ClassVar[int]
    FAILED_FIELD_NUMBER: _ClassVar[int]
    TOTAL_DURATION_MS_FIELD_NUMBER: _ClassVar[int]
    results: _containers.RepeatedCompositeFieldContainer[BacktestResult]
    succeeded: int
    failed: int
    total_duration_ms: int
    def __init__(self, results: _Optional[_Iterable[_Union[BacktestResult, _Mapping]]] = ..., succeeded: _Optional[int] = ..., failed: _Optional[int] = ..., total_duration_ms: _Optional[int] = ...) -> None: ...

class SessionInfo(_message.Message):
    __slots__ = ("session_id", "strategy_id", "strategy_name", "version", "strategy_type", "permissions", "capabilities", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_NAME_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_TYPE_FIELD_NUMBER: _ClassVar[int]
    PERMISSIONS_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    strategy_name: str
    version: str
    strategy_type: StrategyType
    permissions: _containers.RepeatedScalarFieldContainer[Permission]
    capabilities: SessionCapabilities
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., strategy_name: _Optional[str] = ..., version: _Optional[str] = ..., strategy_type: _Optional[_Union[StrategyType, str]] = ..., permissions: _Optional[_Iterable[_Union[Permission, str]]] = ..., capabilities: _Optional[_Union[SessionCapabilities, _Mapping]] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class SessionCapabilities(_message.Message):
    __slots__ = ("supports_realtime", "supports_historical", "supports_backtest", "supported_symbols", "supported_intervals")
    SUPPORTS_REALTIME_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_HISTORICAL_FIELD_NUMBER: _ClassVar[int]
    SUPPORTS_BACKTEST_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_SYMBOLS_FIELD_NUMBER: _ClassVar[int]
    SUPPORTED_INTERVALS_FIELD_NUMBER: _ClassVar[int]
    supports_realtime: bool
    supports_historical: bool
    supports_backtest: bool
    supported_symbols: _containers.RepeatedScalarFieldContainer[str]
    supported_intervals: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, supports_realtime: bool = ..., supports_historical: bool = ..., supports_backtest: bool = ..., supported_symbols: _Optional[_Iterable[str]] = ..., supported_intervals: _Optional[_Iterable[str]] = ...) -> None: ...

class SessionResult(_message.Message):
    __slots__ = ("success", "session_id", "error", "granted_permissions", "expires_at")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    GRANTED_PERMISSIONS_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_FIELD_NUMBER: _ClassVar[int]
    success: bool
    session_id: str
    error: str
    granted_permissions: _containers.RepeatedScalarFieldContainer[Permission]
    expires_at: int
    def __init__(self, success: bool = ..., session_id: _Optional[str] = ..., error: _Optional[str] = ..., granted_permissions: _Optional[_Iterable[_Union[Permission, str]]] = ..., expires_at: _Optional[int] = ...) -> None: ...

class UnregisterRequest(_message.Message):
    __slots__ = ("session_id", "strategy_id")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ...) -> None: ...

class RuntimeDataRequest(_message.Message):
    __slots__ = ("session_id", "strategy_id", "symbol", "interval", "time_range", "data_type", "limit")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    INTERVAL_FIELD_NUMBER: _ClassVar[int]
    TIME_RANGE_FIELD_NUMBER: _ClassVar[int]
    DATA_TYPE_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    symbol: str
    interval: str
    time_range: _common_pb2.TimeRange
    data_type: DataType
    limit: int
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., symbol: _Optional[str] = ..., interval: _Optional[str] = ..., time_range: _Optional[_Union[_common_pb2.TimeRange, _Mapping]] = ..., data_type: _Optional[_Union[DataType, str]] = ..., limit: _Optional[int] = ...) -> None: ...

class DataChunk(_message.Message):
    __slots__ = ("symbol", "data_type", "candles", "ticks", "is_last", "total_records")
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    DATA_TYPE_FIELD_NUMBER: _ClassVar[int]
    CANDLES_FIELD_NUMBER: _ClassVar[int]
    TICKS_FIELD_NUMBER: _ClassVar[int]
    IS_LAST_FIELD_NUMBER: _ClassVar[int]
    TOTAL_RECORDS_FIELD_NUMBER: _ClassVar[int]
    symbol: str
    data_type: DataType
    candles: _containers.RepeatedCompositeFieldContainer[_common_pb2.Candle]
    ticks: _containers.RepeatedCompositeFieldContainer[TickData]
    is_last: bool
    total_records: int
    def __init__(self, symbol: _Optional[str] = ..., data_type: _Optional[_Union[DataType, str]] = ..., candles: _Optional[_Iterable[_Union[_common_pb2.Candle, _Mapping]]] = ..., ticks: _Optional[_Iterable[_Union[TickData, _Mapping]]] = ..., is_last: bool = ..., total_records: _Optional[int] = ...) -> None: ...

class TickData(_message.Message):
    __slots__ = ("timestamp", "price", "volume", "side")
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    VOLUME_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    timestamp: int
    price: float
    volume: float
    side: _common_pb2.Side
    def __init__(self, timestamp: _Optional[int] = ..., price: _Optional[float] = ..., volume: _Optional[float] = ..., side: _Optional[_Union[_common_pb2.Side, str]] = ...) -> None: ...

class TradingSignal(_message.Message):
    __slots__ = ("session_id", "strategy_id", "symbol", "signal_type", "confidence", "reason", "factors", "timestamp", "metadata")
    class FactorsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: float
        def __init__(self, key: _Optional[str] = ..., value: _Optional[float] = ...) -> None: ...
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONFIDENCE_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    FACTORS_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    symbol: str
    signal_type: SignalType
    confidence: float
    reason: str
    factors: _containers.ScalarMap[str, float]
    timestamp: int
    metadata: SignalMetadata
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., symbol: _Optional[str] = ..., signal_type: _Optional[_Union[SignalType, str]] = ..., confidence: _Optional[float] = ..., reason: _Optional[str] = ..., factors: _Optional[_Mapping[str, float]] = ..., timestamp: _Optional[int] = ..., metadata: _Optional[_Union[SignalMetadata, _Mapping]] = ...) -> None: ...

class SignalMetadata(_message.Message):
    __slots__ = ("target_price", "stop_loss", "take_profit", "valid_until", "strategy_name", "extra")
    class ExtraEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    TARGET_PRICE_FIELD_NUMBER: _ClassVar[int]
    STOP_LOSS_FIELD_NUMBER: _ClassVar[int]
    TAKE_PROFIT_FIELD_NUMBER: _ClassVar[int]
    VALID_UNTIL_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_NAME_FIELD_NUMBER: _ClassVar[int]
    EXTRA_FIELD_NUMBER: _ClassVar[int]
    target_price: float
    stop_loss: float
    take_profit: float
    valid_until: int
    strategy_name: str
    extra: _containers.ScalarMap[str, str]
    def __init__(self, target_price: _Optional[float] = ..., stop_loss: _Optional[float] = ..., take_profit: _Optional[float] = ..., valid_until: _Optional[int] = ..., strategy_name: _Optional[str] = ..., extra: _Optional[_Mapping[str, str]] = ...) -> None: ...

class SignalResult(_message.Message):
    __slots__ = ("success", "signal_id", "error", "status", "received_at")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_ID_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    RECEIVED_AT_FIELD_NUMBER: _ClassVar[int]
    success: bool
    signal_id: str
    error: str
    status: SignalStatus
    received_at: int
    def __init__(self, success: bool = ..., signal_id: _Optional[str] = ..., error: _Optional[str] = ..., status: _Optional[_Union[SignalStatus, str]] = ..., received_at: _Optional[int] = ...) -> None: ...

class AnalysisReport(_message.Message):
    __slots__ = ("session_id", "strategy_id", "report_id", "report_type", "title", "summary", "content", "content_type", "generated_at", "symbols", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    REPORT_ID_FIELD_NUMBER: _ClassVar[int]
    REPORT_TYPE_FIELD_NUMBER: _ClassVar[int]
    TITLE_FIELD_NUMBER: _ClassVar[int]
    SUMMARY_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    GENERATED_AT_FIELD_NUMBER: _ClassVar[int]
    SYMBOLS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    report_id: str
    report_type: ReportType
    title: str
    summary: str
    content: bytes
    content_type: str
    generated_at: int
    symbols: _containers.RepeatedScalarFieldContainer[str]
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., report_id: _Optional[str] = ..., report_type: _Optional[_Union[ReportType, str]] = ..., title: _Optional[str] = ..., summary: _Optional[str] = ..., content: _Optional[bytes] = ..., content_type: _Optional[str] = ..., generated_at: _Optional[int] = ..., symbols: _Optional[_Iterable[str]] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class ReportResult(_message.Message):
    __slots__ = ("success", "report_id", "error", "storage_url")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    REPORT_ID_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    STORAGE_URL_FIELD_NUMBER: _ClassVar[int]
    success: bool
    report_id: str
    error: str
    storage_url: str
    def __init__(self, success: bool = ..., report_id: _Optional[str] = ..., error: _Optional[str] = ..., storage_url: _Optional[str] = ...) -> None: ...

class SessionStatusRequest(_message.Message):
    __slots__ = ("session_id", "strategy_id")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ...) -> None: ...

class SessionStatus(_message.Message):
    __slots__ = ("session_id", "state", "registered_at", "last_heartbeat", "signals_submitted", "reports_submitted", "data_requests", "error")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    REGISTERED_AT_FIELD_NUMBER: _ClassVar[int]
    LAST_HEARTBEAT_FIELD_NUMBER: _ClassVar[int]
    SIGNALS_SUBMITTED_FIELD_NUMBER: _ClassVar[int]
    REPORTS_SUBMITTED_FIELD_NUMBER: _ClassVar[int]
    DATA_REQUESTS_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    state: SessionState
    registered_at: int
    last_heartbeat: int
    signals_submitted: int
    reports_submitted: int
    data_requests: int
    error: str
    def __init__(self, session_id: _Optional[str] = ..., state: _Optional[_Union[SessionState, str]] = ..., registered_at: _Optional[int] = ..., last_heartbeat: _Optional[int] = ..., signals_submitted: _Optional[int] = ..., reports_submitted: _Optional[int] = ..., data_requests: _Optional[int] = ..., error: _Optional[str] = ...) -> None: ...

class HeartbeatRequest(_message.Message):
    __slots__ = ("session_id", "strategy_id", "timestamp")
    SESSION_ID_FIELD_NUMBER: _ClassVar[int]
    STRATEGY_ID_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    session_id: str
    strategy_id: str
    timestamp: int
    def __init__(self, session_id: _Optional[str] = ..., strategy_id: _Optional[str] = ..., timestamp: _Optional[int] = ...) -> None: ...

class HeartbeatResponse(_message.Message):
    __slots__ = ("success", "server_timestamp", "next_heartbeat_due")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SERVER_TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    NEXT_HEARTBEAT_DUE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    server_timestamp: int
    next_heartbeat_due: int
    def __init__(self, success: bool = ..., server_timestamp: _Optional[int] = ..., next_heartbeat_due: _Optional[int] = ...) -> None: ...
