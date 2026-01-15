from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class StatusCode(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    STATUS_CODE_UNSPECIFIED: _ClassVar[StatusCode]
    STATUS_CODE_OK: _ClassVar[StatusCode]
    STATUS_CODE_ERROR: _ClassVar[StatusCode]
    STATUS_CODE_TIMEOUT: _ClassVar[StatusCode]
    STATUS_CODE_CANCELLED: _ClassVar[StatusCode]
    STATUS_CODE_NOT_FOUND: _ClassVar[StatusCode]
    STATUS_CODE_ALREADY_EXISTS: _ClassVar[StatusCode]
    STATUS_CODE_PERMISSION_DENIED: _ClassVar[StatusCode]
    STATUS_CODE_INVALID_ARGUMENT: _ClassVar[StatusCode]

class Side(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIDE_UNSPECIFIED: _ClassVar[Side]
    SIDE_BUY: _ClassVar[Side]
    SIDE_SELL: _ClassVar[Side]

class OrderType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_TYPE_UNSPECIFIED: _ClassVar[OrderType]
    ORDER_TYPE_MARKET: _ClassVar[OrderType]
    ORDER_TYPE_LIMIT: _ClassVar[OrderType]
    ORDER_TYPE_STOP: _ClassVar[OrderType]
    ORDER_TYPE_STOP_LIMIT: _ClassVar[OrderType]

class OrderStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    ORDER_STATUS_UNSPECIFIED: _ClassVar[OrderStatus]
    ORDER_STATUS_PENDING: _ClassVar[OrderStatus]
    ORDER_STATUS_SUBMITTED: _ClassVar[OrderStatus]
    ORDER_STATUS_PARTIAL: _ClassVar[OrderStatus]
    ORDER_STATUS_FILLED: _ClassVar[OrderStatus]
    ORDER_STATUS_CANCELLED: _ClassVar[OrderStatus]
    ORDER_STATUS_REJECTED: _ClassVar[OrderStatus]
STATUS_CODE_UNSPECIFIED: StatusCode
STATUS_CODE_OK: StatusCode
STATUS_CODE_ERROR: StatusCode
STATUS_CODE_TIMEOUT: StatusCode
STATUS_CODE_CANCELLED: StatusCode
STATUS_CODE_NOT_FOUND: StatusCode
STATUS_CODE_ALREADY_EXISTS: StatusCode
STATUS_CODE_PERMISSION_DENIED: StatusCode
STATUS_CODE_INVALID_ARGUMENT: StatusCode
SIDE_UNSPECIFIED: Side
SIDE_BUY: Side
SIDE_SELL: Side
ORDER_TYPE_UNSPECIFIED: OrderType
ORDER_TYPE_MARKET: OrderType
ORDER_TYPE_LIMIT: OrderType
ORDER_TYPE_STOP: OrderType
ORDER_TYPE_STOP_LIMIT: OrderType
ORDER_STATUS_UNSPECIFIED: OrderStatus
ORDER_STATUS_PENDING: OrderStatus
ORDER_STATUS_SUBMITTED: OrderStatus
ORDER_STATUS_PARTIAL: OrderStatus
ORDER_STATUS_FILLED: OrderStatus
ORDER_STATUS_CANCELLED: OrderStatus
ORDER_STATUS_REJECTED: OrderStatus

class Empty(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class Timestamp(_message.Message):
    __slots__ = ("millis",)
    MILLIS_FIELD_NUMBER: _ClassVar[int]
    millis: int
    def __init__(self, millis: _Optional[int] = ...) -> None: ...

class TimeRange(_message.Message):
    __slots__ = ("start_millis", "end_millis")
    START_MILLIS_FIELD_NUMBER: _ClassVar[int]
    END_MILLIS_FIELD_NUMBER: _ClassVar[int]
    start_millis: int
    end_millis: int
    def __init__(self, start_millis: _Optional[int] = ..., end_millis: _Optional[int] = ...) -> None: ...

class Error(_message.Message):
    __slots__ = ("code", "message", "details")
    class DetailsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    CODE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    DETAILS_FIELD_NUMBER: _ClassVar[int]
    code: StatusCode
    message: str
    details: _containers.ScalarMap[str, str]
    def __init__(self, code: _Optional[_Union[StatusCode, str]] = ..., message: _Optional[str] = ..., details: _Optional[_Mapping[str, str]] = ...) -> None: ...

class Response(_message.Message):
    __slots__ = ("success", "error")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    success: bool
    error: Error
    def __init__(self, success: bool = ..., error: _Optional[_Union[Error, _Mapping]] = ...) -> None: ...

class PingRequest(_message.Message):
    __slots__ = ("client_id",)
    CLIENT_ID_FIELD_NUMBER: _ClassVar[int]
    client_id: str
    def __init__(self, client_id: _Optional[str] = ...) -> None: ...

class PingResponse(_message.Message):
    __slots__ = ("ok", "version", "uptime_seconds", "timestamp")
    OK_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    UPTIME_SECONDS_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    ok: bool
    version: str
    uptime_seconds: int
    timestamp: int
    def __init__(self, ok: bool = ..., version: _Optional[str] = ..., uptime_seconds: _Optional[int] = ..., timestamp: _Optional[int] = ...) -> None: ...

class Candle(_message.Message):
    __slots__ = ("timestamp", "open", "high", "low", "close", "volume", "turnover")
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    OPEN_FIELD_NUMBER: _ClassVar[int]
    HIGH_FIELD_NUMBER: _ClassVar[int]
    LOW_FIELD_NUMBER: _ClassVar[int]
    CLOSE_FIELD_NUMBER: _ClassVar[int]
    VOLUME_FIELD_NUMBER: _ClassVar[int]
    TURNOVER_FIELD_NUMBER: _ClassVar[int]
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    turnover: float
    def __init__(self, timestamp: _Optional[int] = ..., open: _Optional[float] = ..., high: _Optional[float] = ..., low: _Optional[float] = ..., close: _Optional[float] = ..., volume: _Optional[float] = ..., turnover: _Optional[float] = ...) -> None: ...

class Tick(_message.Message):
    __slots__ = ("timestamp", "price", "volume", "direction")
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    VOLUME_FIELD_NUMBER: _ClassVar[int]
    DIRECTION_FIELD_NUMBER: _ClassVar[int]
    timestamp: int
    price: float
    volume: float
    direction: int
    def __init__(self, timestamp: _Optional[int] = ..., price: _Optional[float] = ..., volume: _Optional[float] = ..., direction: _Optional[int] = ...) -> None: ...

class Trade(_message.Message):
    __slots__ = ("trade_id", "order_id", "symbol", "side", "price", "quantity", "commission", "slippage", "pnl", "timestamp")
    TRADE_ID_FIELD_NUMBER: _ClassVar[int]
    ORDER_ID_FIELD_NUMBER: _ClassVar[int]
    SYMBOL_FIELD_NUMBER: _ClassVar[int]
    SIDE_FIELD_NUMBER: _ClassVar[int]
    PRICE_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    COMMISSION_FIELD_NUMBER: _ClassVar[int]
    SLIPPAGE_FIELD_NUMBER: _ClassVar[int]
    PNL_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    trade_id: str
    order_id: str
    symbol: str
    side: Side
    price: float
    quantity: float
    commission: float
    slippage: float
    pnl: float
    timestamp: int
    def __init__(self, trade_id: _Optional[str] = ..., order_id: _Optional[str] = ..., symbol: _Optional[str] = ..., side: _Optional[_Union[Side, str]] = ..., price: _Optional[float] = ..., quantity: _Optional[float] = ..., commission: _Optional[float] = ..., slippage: _Optional[float] = ..., pnl: _Optional[float] = ..., timestamp: _Optional[int] = ...) -> None: ...

class BacktestConfig(_message.Message):
    __slots__ = ("initial_capital", "commission_rate", "slippage_rate", "leverage", "allow_short", "benchmark")
    INITIAL_CAPITAL_FIELD_NUMBER: _ClassVar[int]
    COMMISSION_RATE_FIELD_NUMBER: _ClassVar[int]
    SLIPPAGE_RATE_FIELD_NUMBER: _ClassVar[int]
    LEVERAGE_FIELD_NUMBER: _ClassVar[int]
    ALLOW_SHORT_FIELD_NUMBER: _ClassVar[int]
    BENCHMARK_FIELD_NUMBER: _ClassVar[int]
    initial_capital: float
    commission_rate: float
    slippage_rate: float
    leverage: int
    allow_short: bool
    benchmark: str
    def __init__(self, initial_capital: _Optional[float] = ..., commission_rate: _Optional[float] = ..., slippage_rate: _Optional[float] = ..., leverage: _Optional[int] = ..., allow_short: bool = ..., benchmark: _Optional[str] = ...) -> None: ...

class Metrics(_message.Message):
    __slots__ = ("total_return", "annualized_return", "benchmark_return", "sharpe_ratio", "sortino_ratio", "calmar_ratio", "max_drawdown", "volatility", "total_trades", "winning_trades", "losing_trades", "win_rate", "profit_factor", "avg_win", "avg_loss", "largest_win", "largest_loss", "exposure_time", "alpha", "beta")
    TOTAL_RETURN_FIELD_NUMBER: _ClassVar[int]
    ANNUALIZED_RETURN_FIELD_NUMBER: _ClassVar[int]
    BENCHMARK_RETURN_FIELD_NUMBER: _ClassVar[int]
    SHARPE_RATIO_FIELD_NUMBER: _ClassVar[int]
    SORTINO_RATIO_FIELD_NUMBER: _ClassVar[int]
    CALMAR_RATIO_FIELD_NUMBER: _ClassVar[int]
    MAX_DRAWDOWN_FIELD_NUMBER: _ClassVar[int]
    VOLATILITY_FIELD_NUMBER: _ClassVar[int]
    TOTAL_TRADES_FIELD_NUMBER: _ClassVar[int]
    WINNING_TRADES_FIELD_NUMBER: _ClassVar[int]
    LOSING_TRADES_FIELD_NUMBER: _ClassVar[int]
    WIN_RATE_FIELD_NUMBER: _ClassVar[int]
    PROFIT_FACTOR_FIELD_NUMBER: _ClassVar[int]
    AVG_WIN_FIELD_NUMBER: _ClassVar[int]
    AVG_LOSS_FIELD_NUMBER: _ClassVar[int]
    LARGEST_WIN_FIELD_NUMBER: _ClassVar[int]
    LARGEST_LOSS_FIELD_NUMBER: _ClassVar[int]
    EXPOSURE_TIME_FIELD_NUMBER: _ClassVar[int]
    ALPHA_FIELD_NUMBER: _ClassVar[int]
    BETA_FIELD_NUMBER: _ClassVar[int]
    total_return: float
    annualized_return: float
    benchmark_return: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown: float
    volatility: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_factor: float
    avg_win: float
    avg_loss: float
    largest_win: float
    largest_loss: float
    exposure_time: float
    alpha: float
    beta: float
    def __init__(self, total_return: _Optional[float] = ..., annualized_return: _Optional[float] = ..., benchmark_return: _Optional[float] = ..., sharpe_ratio: _Optional[float] = ..., sortino_ratio: _Optional[float] = ..., calmar_ratio: _Optional[float] = ..., max_drawdown: _Optional[float] = ..., volatility: _Optional[float] = ..., total_trades: _Optional[int] = ..., winning_trades: _Optional[int] = ..., losing_trades: _Optional[int] = ..., win_rate: _Optional[float] = ..., profit_factor: _Optional[float] = ..., avg_win: _Optional[float] = ..., avg_loss: _Optional[float] = ..., largest_win: _Optional[float] = ..., largest_loss: _Optional[float] = ..., exposure_time: _Optional[float] = ..., alpha: _Optional[float] = ..., beta: _Optional[float] = ...) -> None: ...

class EquityPoint(_message.Message):
    __slots__ = ("timestamp", "equity", "drawdown", "position_value", "cash")
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    EQUITY_FIELD_NUMBER: _ClassVar[int]
    DRAWDOWN_FIELD_NUMBER: _ClassVar[int]
    POSITION_VALUE_FIELD_NUMBER: _ClassVar[int]
    CASH_FIELD_NUMBER: _ClassVar[int]
    timestamp: int
    equity: float
    drawdown: float
    position_value: float
    cash: float
    def __init__(self, timestamp: _Optional[int] = ..., equity: _Optional[float] = ..., drawdown: _Optional[float] = ..., position_value: _Optional[float] = ..., cash: _Optional[float] = ...) -> None: ...
