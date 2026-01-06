"""
Plugin Lifecycle Manager

Handles plugin registration, heartbeat, and command processing with Core engine.
Based on QuantNexus plugin protocol (plugin.proto).

Features:
1. Plugin registration with Core
2. Periodic heartbeat with status reporting
3. Command handling (pause/resume/shutdown)
4. Graceful shutdown and unregistration
5. Reconnection on connection loss
"""

import logging
import threading
import time
import os
import psutil
from typing import Optional, Dict, Any, Callable, List
from dataclasses import dataclass, field
from enum import Enum

import grpc

from .proto import plugin_pb2
from .proto import plugin_pb2_grpc

logger = logging.getLogger(__name__)


class PluginState(Enum):
    """Plugin execution state."""
    STARTING = "starting"
    READY = "ready"
    BUSY = "busy"
    PAUSED = "paused"
    ERROR = "error"
    STOPPING = "stopping"


@dataclass
class PluginMetrics:
    """Plugin runtime metrics."""
    uptime_seconds: int = 0
    active_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    cpu_usage: float = 0.0
    memory_usage_bytes: int = 0
    last_error: Optional[str] = None


@dataclass
class PluginConfig:
    """Plugin configuration."""
    plugin_id: str = "com.quantnexus.back-test-nexus"
    name: str = "Backtest Engine"
    version: str = "1.0.0"
    description: str = "Python-based backtest engine with Backtrader"
    grpc_port: int = 50052
    core_address: Optional[str] = None
    heartbeat_interval_ms: int = 5000
    reconnect_interval_ms: int = 10000
    max_reconnect_attempts: int = 10


class PluginLifecycleManager:
    """
    Plugin Lifecycle Manager.

    Manages the complete lifecycle of the plugin including:
    - Registration with Core engine
    - Heartbeat mechanism
    - Command processing
    - Graceful shutdown

    Usage:
        lifecycle = PluginLifecycleManager(config)
        lifecycle.register_command_handler("pause", handle_pause)
        lifecycle.start()
        # ... plugin runs ...
        lifecycle.stop()
    """

    def __init__(self, config: PluginConfig):
        self.config = config
        self.state = PluginState.STARTING
        self.metrics = PluginMetrics()

        # Registration state
        self.session_id: Optional[str] = None
        self.registered = False

        # Threading
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()

        # Command handlers
        self._command_handlers: Dict[str, Callable] = {}

        # Core connection
        self._channel: Optional[grpc.Channel] = None
        self._stub: Optional[plugin_pb2_grpc.PluginManagerStub] = None

        # Start time for uptime calculation
        self._start_time = time.time()

        # Reconnection
        self._reconnect_attempts = 0

        logger.info(f"PluginLifecycleManager initialized: plugin_id={config.plugin_id}")

    # ==========================================================================
    # Lifecycle Management
    # ==========================================================================

    def start(self) -> bool:
        """
        Start the lifecycle manager.

        Returns:
            True if started successfully
        """
        if self._running:
            logger.warning("Lifecycle manager already running")
            return False

        self._running = True
        self._start_time = time.time()

        # Register with Core if address provided
        if self.config.core_address:
            if self._connect_to_core():
                self._register()
                self._start_heartbeat()
            else:
                logger.warning("Could not connect to Core, running standalone")

        self.state = PluginState.READY
        logger.info("PluginLifecycleManager started")
        return True

    def stop(self) -> None:
        """Stop the lifecycle manager and unregister from Core."""
        logger.info("Stopping PluginLifecycleManager")
        self.state = PluginState.STOPPING
        self._running = False

        # Stop heartbeat
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=5)
            self._heartbeat_thread = None

        # Unregister from Core
        if self.registered:
            self._unregister()

        # Close connection
        if self._channel:
            self._channel.close()
            self._channel = None

        logger.info("PluginLifecycleManager stopped")

    # ==========================================================================
    # Core Connection
    # ==========================================================================

    def _connect_to_core(self) -> bool:
        """Connect to Core engine."""
        if not self.config.core_address:
            return False

        try:
            logger.info(f"Connecting to Core at {self.config.core_address}")

            self._channel = grpc.insecure_channel(
                self.config.core_address,
                options=[
                    ("grpc.keepalive_time_ms", 10000),
                    ("grpc.keepalive_timeout_ms", 5000),
                    ("grpc.keepalive_permit_without_calls", True),
                ],
            )

            # Wait for channel to be ready
            try:
                grpc.channel_ready_future(self._channel).result(timeout=5)
            except grpc.FutureTimeoutError:
                logger.warning("Timeout waiting for Core connection")
                return False

            self._stub = plugin_pb2_grpc.PluginManagerStub(self._channel)
            self._reconnect_attempts = 0
            logger.info("Connected to Core")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Core: {e}")
            return False

    def _reconnect(self) -> bool:
        """Attempt to reconnect to Core."""
        if self._reconnect_attempts >= self.config.max_reconnect_attempts:
            logger.error("Max reconnection attempts reached")
            return False

        self._reconnect_attempts += 1
        logger.info(
            f"Reconnection attempt {self._reconnect_attempts}/"
            f"{self.config.max_reconnect_attempts}"
        )

        # Close existing channel
        if self._channel:
            self._channel.close()

        # Try to reconnect
        if self._connect_to_core():
            self._register()
            return True

        return False

    # ==========================================================================
    # Registration
    # ==========================================================================

    def _register(self) -> bool:
        """Register plugin with Core."""
        if not self._stub:
            return False

        try:
            logger.info("Registering with Core")

            plugin_info = plugin_pb2.PluginInfo(
                plugin_id=self.config.plugin_id,
                name=self.config.name,
                version=self.config.version,
                description=self.config.description,
                type=plugin_pb2.PLUGIN_TYPE_BACKTEST,
                capabilities=[
                    plugin_pb2.CAPABILITY_STREAMING,
                    plugin_pb2.CAPABILITY_BATCH,
                    plugin_pb2.CAPABILITY_HISTORICAL,
                ],
                grpc_address=f"localhost:{self.config.grpc_port}",
            )

            result = self._stub.Register(plugin_info)

            if result.success:
                self.session_id = result.session_id
                self.config.heartbeat_interval_ms = result.heartbeat_interval_ms
                self.registered = True
                logger.info(
                    f"Registered with Core: session_id={self.session_id}, "
                    f"heartbeat_interval={self.config.heartbeat_interval_ms}ms"
                )
                return True
            else:
                logger.error(f"Registration failed: {result.error.message}")
                return False

        except grpc.RpcError as e:
            logger.error(f"Registration RPC error: {e}")
            return False

    def _unregister(self) -> bool:
        """Unregister plugin from Core."""
        if not self._stub or not self.registered:
            return False

        try:
            logger.info("Unregistering from Core")

            request = plugin_pb2.UnregisterRequest(
                plugin_id=self.config.plugin_id,
                session_id=self.session_id or "",
                reason="shutdown",
            )

            result = self._stub.Unregister(request)

            if result.success:
                self.registered = False
                self.session_id = None
                logger.info("Unregistered from Core")
                return True
            else:
                logger.warning(f"Unregister failed: {result.error.message}")
                return False

        except grpc.RpcError as e:
            logger.warning(f"Unregister RPC error: {e}")
            return False

    # ==========================================================================
    # Heartbeat
    # ==========================================================================

    def _start_heartbeat(self) -> None:
        """Start heartbeat thread."""
        if self._heartbeat_thread:
            return

        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True,
            name="heartbeat",
        )
        self._heartbeat_thread.start()
        logger.info("Heartbeat thread started")

    def _heartbeat_loop(self) -> None:
        """Heartbeat loop - runs in separate thread."""
        interval_sec = self.config.heartbeat_interval_ms / 1000.0

        while self._running:
            try:
                if self.registered and self._stub:
                    self._send_heartbeat()

                time.sleep(interval_sec)

            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                # Try to reconnect
                if not self._reconnect():
                    time.sleep(self.config.reconnect_interval_ms / 1000.0)

    def _send_heartbeat(self) -> None:
        """Send heartbeat to Core."""
        if not self._stub:
            return

        try:
            # Update metrics
            self._update_metrics()

            # Build status
            status = plugin_pb2.PluginStatus(
                plugin_id=self.config.plugin_id,
                state=self._get_proto_state(),
                uptime_seconds=self.metrics.uptime_seconds,
                active_tasks=self.metrics.active_tasks,
                completed_tasks=self.metrics.completed_tasks,
                failed_tasks=self.metrics.failed_tasks,
                cpu_usage=self.metrics.cpu_usage,
                memory_usage_bytes=self.metrics.memory_usage_bytes,
                last_error=self.metrics.last_error or "",
            )

            # Send heartbeat
            request = plugin_pb2.HeartbeatRequest(
                plugin_id=self.config.plugin_id,
                session_id=self.session_id or "",
                timestamp=int(time.time() * 1000),
                status=status,
            )

            response = self._stub.Heartbeat(request)

            if response.acknowledged:
                # Process any commands from Core
                for command in response.commands:
                    self._process_command(command)
            else:
                logger.warning("Heartbeat not acknowledged")

        except grpc.RpcError as e:
            logger.warning(f"Heartbeat failed: {e}")
            self.registered = False

    def _update_metrics(self) -> None:
        """Update runtime metrics."""
        self.metrics.uptime_seconds = int(time.time() - self._start_time)

        # Get system metrics
        try:
            process = psutil.Process(os.getpid())
            self.metrics.cpu_usage = process.cpu_percent()
            self.metrics.memory_usage_bytes = process.memory_info().rss
        except Exception:
            pass

    def _get_proto_state(self) -> int:
        """Convert state to proto enum."""
        state_map = {
            PluginState.STARTING: plugin_pb2.PLUGIN_STATE_STARTING,
            PluginState.READY: plugin_pb2.PLUGIN_STATE_READY,
            PluginState.BUSY: plugin_pb2.PLUGIN_STATE_BUSY,
            PluginState.PAUSED: plugin_pb2.PLUGIN_STATE_PAUSED,
            PluginState.ERROR: plugin_pb2.PLUGIN_STATE_ERROR,
            PluginState.STOPPING: plugin_pb2.PLUGIN_STATE_STOPPING,
        }
        return state_map.get(self.state, plugin_pb2.PLUGIN_STATE_UNSPECIFIED)

    # ==========================================================================
    # Command Handling
    # ==========================================================================

    def register_command_handler(
        self,
        action: str,
        handler: Callable[[Dict[str, str]], None],
    ) -> None:
        """
        Register a command handler.

        Args:
            action: Command action (e.g., "pause", "resume", "shutdown")
            handler: Function to handle the command
        """
        self._command_handlers[action] = handler
        logger.debug(f"Registered command handler: {action}")

    def _process_command(self, command: plugin_pb2.PluginCommand) -> None:
        """Process a command from Core."""
        action = command.action
        params = dict(command.parameters)

        logger.info(f"Processing command: action={action}, params={params}")

        # Built-in handlers
        if action == "pause":
            self._handle_pause(params)
        elif action == "resume":
            self._handle_resume(params)
        elif action == "shutdown":
            self._handle_shutdown(params)
        elif action == "reload":
            self._handle_reload(params)

        # Custom handlers
        if action in self._command_handlers:
            try:
                self._command_handlers[action](params)
            except Exception as e:
                logger.error(f"Command handler error: {e}")

    def _handle_pause(self, params: Dict[str, str]) -> None:
        """Handle pause command."""
        logger.info("Pausing plugin")
        self.state = PluginState.PAUSED

    def _handle_resume(self, params: Dict[str, str]) -> None:
        """Handle resume command."""
        logger.info("Resuming plugin")
        self.state = PluginState.READY

    def _handle_shutdown(self, params: Dict[str, str]) -> None:
        """Handle shutdown command."""
        logger.info("Shutdown requested by Core")
        self._running = False

    def _handle_reload(self, params: Dict[str, str]) -> None:
        """Handle reload command."""
        logger.info("Reload requested by Core")
        # Could reload configuration here

    # ==========================================================================
    # Task Tracking
    # ==========================================================================

    def task_started(self) -> None:
        """Called when a task starts."""
        with self._lock:
            self.metrics.active_tasks += 1
            if self.state == PluginState.READY:
                self.state = PluginState.BUSY

    def task_completed(self) -> None:
        """Called when a task completes successfully."""
        with self._lock:
            self.metrics.active_tasks = max(0, self.metrics.active_tasks - 1)
            self.metrics.completed_tasks += 1
            if self.metrics.active_tasks == 0 and self.state == PluginState.BUSY:
                self.state = PluginState.READY

    def task_failed(self, error: str) -> None:
        """Called when a task fails."""
        with self._lock:
            self.metrics.active_tasks = max(0, self.metrics.active_tasks - 1)
            self.metrics.failed_tasks += 1
            self.metrics.last_error = error
            if self.metrics.active_tasks == 0 and self.state == PluginState.BUSY:
                self.state = PluginState.READY

    # ==========================================================================
    # State Access
    # ==========================================================================

    def is_running(self) -> bool:
        """Check if lifecycle manager is running."""
        return self._running

    def is_registered(self) -> bool:
        """Check if plugin is registered with Core."""
        return self.registered

    def is_paused(self) -> bool:
        """Check if plugin is paused."""
        return self.state == PluginState.PAUSED

    def get_state(self) -> PluginState:
        """Get current plugin state."""
        return self.state

    def get_metrics(self) -> PluginMetrics:
        """Get current metrics."""
        self._update_metrics()
        return self.metrics
