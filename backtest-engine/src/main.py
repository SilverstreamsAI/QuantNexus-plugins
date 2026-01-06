"""
Backtest Engine Plugin - Main Entry Point

gRPC server for the backtest plugin.
Implements full plugin lifecycle with Core integration.
"""

import sys
import os
import argparse
import logging
import signal
import time
from concurrent import futures
from typing import Optional

import grpc

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.proto import backtest_pb2_grpc
from src.service import BacktestPluginServicer
from src.lifecycle import PluginLifecycleManager, PluginConfig, PluginState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class PluginServer:
    """
    Backtest Plugin gRPC Server.

    Handles:
    - gRPC server lifecycle
    - Plugin registration with Core
    - Heartbeat mechanism
    - Command handling (pause/resume/shutdown)
    """

    def __init__(self, port: int = 50052, core_address: Optional[str] = None):
        self.port = port
        self.core_address = core_address
        self.server: Optional[grpc.Server] = None
        self.running = False
        self.servicer: Optional[BacktestPluginServicer] = None

        # Lifecycle manager for Core integration
        config = PluginConfig(
            plugin_id="com.quantnexus.backtest-engine",
            name="Backtest Engine",
            version="1.0.0",
            description="Python-based backtest engine with Backtrader",
            grpc_port=port,
            core_address=core_address,
        )
        self.lifecycle = PluginLifecycleManager(config)

        # Register custom command handlers
        self.lifecycle.register_command_handler("cancel_all", self._handle_cancel_all)

    def start(self):
        """Start the gRPC server."""
        logger.info(f"Starting Backtest Engine Plugin on port {self.port}")

        # Create gRPC server
        self.server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=10),
            options=[
                ("grpc.max_send_message_length", 100 * 1024 * 1024),  # 100MB
                ("grpc.max_receive_message_length", 100 * 1024 * 1024),
            ],
        )

        # Create servicer with lifecycle integration
        self.servicer = BacktestPluginServicer()
        self.servicer.set_lifecycle_manager(self.lifecycle)

        # Add BacktestPlugin service
        backtest_pb2_grpc.add_BacktestPluginServicer_to_server(
            self.servicer, self.server
        )

        # Bind to port
        self.server.add_insecure_port(f"[::]:{self.port}")

        # Start server
        self.server.start()
        self.running = True
        logger.info(f"Backtest Engine Plugin started on port {self.port}")

        # Start lifecycle manager (handles registration and heartbeat)
        self.lifecycle.start()

    def wait_for_termination(self):
        """Wait for server termination."""
        try:
            while self.running and self.lifecycle.is_running():
                # Check if paused
                if self.lifecycle.is_paused():
                    logger.debug("Plugin is paused")
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        """Stop the gRPC server."""
        logger.info("Stopping Backtest Engine Plugin")
        self.running = False

        # Stop lifecycle manager (handles unregistration)
        self.lifecycle.stop()

        if self.server:
            self.server.stop(grace=5)
            logger.info("Backtest Engine Plugin stopped")

    def _handle_cancel_all(self, params: dict) -> None:
        """Handle cancel_all command from Core."""
        logger.info("Cancelling all active backtests")
        if self.servicer:
            for task_id in list(self.servicer.active_tasks.keys()):
                self.servicer.active_tasks[task_id]["status"] = "cancelled"


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Backtest Engine Plugin")
    parser.add_argument(
        "--port",
        type=int,
        default=50052,
        help="gRPC server port (default: 50052)",
    )
    parser.add_argument(
        "--core-address",
        type=str,
        default=None,
        help="Core engine gRPC address for registration (e.g., localhost:50051)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)",
    )

    args = parser.parse_args()

    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    # Create and start server
    server = PluginServer(
        port=args.port,
        core_address=args.core_address,
    )

    # Handle signals
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}")
        server.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start and wait
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    main()
