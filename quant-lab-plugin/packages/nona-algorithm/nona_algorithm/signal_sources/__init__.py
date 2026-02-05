"""
Signal Sources

TICKET_250_7: Example signal source implementations
TICKET_264: Workflow signal source for exported Strategy Builder workflows
"""

from .base import SignalSourceBase
from .rsi_signal import RSISignal
from .macd_signal import MACDSignal
from .sma_cross_signal import SMACrossSignal

# TICKET_264: Workflow signal source
from .workflow_signal_source import (
    WorkflowSignalSource,
    ExportedWorkflowConfig,
    ComponentConfig,
    BacktestMetrics,
)
from .workflow_loader import (
    load_exported_workflows,
    load_workflow_by_id,
    load_workflow_by_name,
    list_exported_workflows,
)

__all__ = [
    # Base
    "SignalSourceBase",
    # Built-in signals
    "RSISignal",
    "MACDSignal",
    "SMACrossSignal",
    # TICKET_264: Workflow signal source
    "WorkflowSignalSource",
    "ExportedWorkflowConfig",
    "ComponentConfig",
    "BacktestMetrics",
    # TICKET_264: Workflow loader
    "load_exported_workflows",
    "load_workflow_by_id",
    "load_workflow_by_name",
    "list_exported_workflows",
]
