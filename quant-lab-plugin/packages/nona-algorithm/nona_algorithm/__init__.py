"""
NONA Algorithm - Signal Factory and Combinator

TICKET_250_7: Python Alpha Factory Framework
TICKET_264: Workflow Signal Source integration

Provides batch signal computation and combination for the Alpha Factory plugin.
"""

from .alpha_factory import AlphaFactory
from .signal_factory import SignalFactory
from .combinator import Combinator

# TICKET_264: Re-export workflow signal source components
from .signal_sources import (
    WorkflowSignalSource,
    ExportedWorkflowConfig,
    load_exported_workflows,
    load_workflow_by_id,
    load_workflow_by_name,
    list_exported_workflows,
)

__version__ = "1.0.0"
__all__ = [
    "AlphaFactory",
    "SignalFactory",
    "Combinator",
    # TICKET_264: Workflow signal source
    "WorkflowSignalSource",
    "ExportedWorkflowConfig",
    "load_exported_workflows",
    "load_workflow_by_id",
    "load_workflow_by_name",
    "list_exported_workflows",
]
