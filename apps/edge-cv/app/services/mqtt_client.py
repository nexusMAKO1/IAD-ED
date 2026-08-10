"""
mqtt_client.py — Production-ready MQTT Client for Edge-CV
Express Display SmartVision — T-021

Wraps paho-mqtt 2.x with:
  - Non-blocking connection with a dedicated background network thread
  - MQTT Last Will on smartvision/system/health (status: offline)
  - Automatic reconnection with exponential back-off (via paho reconnect_delay_set)
  - Subscribe to command topics (config-update, camera, model-update, restart)
  - Handler registration API for subscribe callbacks
  - Pydantic validation of all incoming command payloads
  - Typed publish helpers for every Edge-CV topic
  - Periodic heartbeat (30 s by default)
  - Thread-safe connection-status flag consumed by /health and /status

Topic hierarchy (mirrors Backend's mqtt.topics.ts):
  smartvision/edge/detections     QoS 1
  smartvision/edge/tracking       QoS 1
  smartvision/edge/demographics   QoS 1
  smartvision/edge/crowd-density  QoS 0
  smartvision/edge/performance    QoS 0
  smartvision/edge/camera-health  QoS 0
  smartvision/edge/status         QoS 1
  smartvision/system/health       QoS 0 (heartbeat) / QoS 1 (Last Will)

The client will keep retrying to reconnect in the background — the rest of
the service must NOT block on MQTT availability.
"""

from __future__ import annotations

import json
import logging
import socket
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from pydantic import ValidationError

log = logging.getLogger("iad.mqtt_client")

# paho-mqtt is an optional hard-dependency listed in requirements.txt.
try:
    import paho.mqtt.client as mqtt  # type: ignore[import-untyped]

    _PAHO_AVAILABLE = True
except ImportError:  # pragma: no cover
    _PAHO_AVAILABLE = False
    log.warning("paho-mqtt not installed — MQTT publishing disabled.")

try:
    from app.mqtt.topics import (  # noqa: E402
        EDGE_COMMAND_SUBSCRIPTIONS,
        EdgeTopics,
        SystemTopics,
    )
    from app.mqtt.schemas import (  # noqa: E402
        BaseEvent,
        CameraCommand,
        ConfigUpdateCommand,
        ModelUpdateCommand,
        RestartCommand,
    )
except ImportError:
    from mqtt.topics import (  # type: ignore[no-redef]
        EDGE_COMMAND_SUBSCRIPTIONS,
        EdgeTopics,
        SystemTopics,
    )
    from mqtt.schemas import (  # type: ignore[no-redef]
        BaseEvent,
        CameraCommand,
        ConfigUpdateCommand,
        ModelUpdateCommand,
        RestartCommand,
    )

# ---------------------------------------------------------------------------
# Type alias for message handlers
# ---------------------------------------------------------------------------
MessageHandler = Callable[[str, Dict[str, Any]], None]

# ---------------------------------------------------------------------------
# Command-topic → Pydantic model mapping for automatic validation
# ---------------------------------------------------------------------------
_COMMAND_SCHEMAS: Dict[str, Any] = {}  # populated after imports


def _build_command_schemas() -> Dict[str, Any]:
    try:
        from app.mqtt.topics import CommandTopics  # noqa: PLC0415
    except ImportError:
        from mqtt.topics import CommandTopics  # type: ignore[no-redef]  # noqa: PLC0415

    return {
        CommandTopics.CONFIG_UPDATE: ConfigUpdateCommand,
        CommandTopics.CAMERA: CameraCommand,
        CommandTopics.MODEL_UPDATE: ModelUpdateCommand,
        CommandTopics.RESTART: RestartCommand,
    }


class MQTTClient:
    """
    Production-ready paho-mqtt wrapper for the Edge-CV service.

    Parameters
    ----------
    host:       Broker hostname or IP.
    port:       Broker TCP port (default 1883).
    username:   MQTT username — read from MQTT_USER env-var.
    password:   MQTT password — read from MQTT_PASSWORD env-var (never logged).
    client_id:  MQTT client identifier string.
    keepalive:  Connection keepalive in seconds (default 60).
    site_id:    Logical site identifier used in message envelopes.
    status_callback: Callback to get the current health status of the device.
    """

    def __init__(
        self,
        host: str = "mosquitto",
        port: int = 1883,
        username: Optional[str] = None,
        password: Optional[str] = None,
        client_id: str = "edge-cv-service",
        keepalive: int = 60,
        site_id: Optional[str] = None,
        device_id: Optional[str] = None,
        status_callback: Optional[Callable[[], str]] = None,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._client_id = client_id
        self._keepalive = keepalive
        self._site_id = site_id
        self._device_id: str = device_id
        self._status_callback = status_callback

        self._connected: bool = False
        self._lock = threading.Lock()
        self._client: Any = None  #Optional[ mqtt.Client]

        # Handler registry: topic → list of callables
        self._handlers: Dict[str, List[MessageHandler]] = defaultdict(list)

        # Heartbeat thread
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._stop_heartbeat = threading.Event()

        # Build command schemas after imports are settled
        global _COMMAND_SCHEMAS
        if not _COMMAND_SCHEMAS:
            _COMMAND_SCHEMAS = _build_command_schemas()

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #

    def connect(self) -> bool:
        """
        Attempt a non-blocking connection to the MQTT broker.

        Returns True when the initial CONNACK is received within 5 s.
        The service must continue to operate even if this returns False —
        paho will keep reconnecting in the background with exponential back-off.
        """
        if not _PAHO_AVAILABLE:
            log.warning("MQTT unavailable — paho-mqtt not installed.")
            return False

        try:
            self._client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self._client_id,
                clean_session=True,
            )

            if self._username:
                self._client.username_pw_set(self._username, self._password)

            # ── Last Will ────────────────────────────────────────────────
            last_will = json.dumps(
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "deviceId": self._device_id,
                    "siteId": self._site_id,
                    "event": "service_offline",
                    "payload": {"status": "offline", "serviceName": "edge-cv"},
                }
            )
            self._client.will_set(
                SystemTopics.HEALTH,
                payload=last_will,
                qos=1,
                retain=True,
            )

            # ── Exponential back-off reconnect (paho native) ─────────────
            # min_delay=1s, max_delay=120s — doubles on each failure
            self._client.reconnect_delay_set(min_delay=1, max_delay=120)

            # ── Callbacks ────────────────────────────────────────────────
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message

            self._client.connect(self._host, self._port, keepalive=self._keepalive)
            self._client.loop_start()

            # Wait up to 5 s for CONNACK
            deadline = time.monotonic() + 5.0
            while time.monotonic() < deadline:
                if self.is_connected:
                    return True
                time.sleep(0.1)

            log.warning(
                "MQTT: broker did not respond within 5 s — "
                "will keep retrying in background."
            )
            return False

        except Exception as exc:
            log.warning(
                "MQTT: connection failed — %s. Service continues without MQTT.", exc
            )
            return False

    def disconnect(self) -> None:
        """Gracefully stop the loop, publish offline status, and disconnect."""
        self._stop_heartbeat.set()
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=5)

        if self._client is not None:
            try:
                # Graceful offline announcement (not the Last Will)
                self._publish_raw(
                    SystemTopics.HEALTH,
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "deviceId": self._device_id,
                        "siteId": self._site_id,
                        "event": "service_offline",
                        "payload": {
                            "status": "offline",
                            "serviceName": "edge-cv",
                        },
                    },
                    qos=1,
                    retain=True,
                )
                self._client.loop_stop()
                self._client.disconnect()
            except Exception as exc:  # pragma: no cover
                log.debug("MQTT disconnect raised: %s", exc)

        with self._lock:
            self._connected = False

        log.info("MQTT: disconnected from broker.")

    # ------------------------------------------------------------------ #
    # Handler registration (subscribe API)
    # ------------------------------------------------------------------ #

    def register_handler(self, topic: str, handler: MessageHandler) -> None:
        """
        Register a callable to be invoked whenever a message is received
        on *topic*. Multiple handlers can be registered for the same topic.

        Parameters
        ----------
        topic:   Exact MQTT topic string to match (wildcards not yet supported).
        handler: Callable(topic: str, payload: dict) — must not block.
        """
        self._handlers[topic].append(handler)
        log.debug("MQTT: registered handler for topic [%s]", topic)

        # If already connected, subscribe immediately
        if self.is_connected and self._client is not None:
            self._client.subscribe(topic, qos=1)

    # ------------------------------------------------------------------ #
    # Publish helpers (typed per topic)
    # ------------------------------------------------------------------ #

    def publish(
        self, topic: str, payload: Dict[str, Any], qos: int = 0, retain: bool = False
    ) -> bool:
        """
        Serialise *payload* to JSON and publish to *topic*.

        Returns True when the message was queued successfully.
        """
        if not self.is_connected or self._client is None:
            log.debug("MQTT not connected — skipping publish to [%s]", topic)
            return False
        return self._publish_raw(topic, payload, qos=qos, retain=retain)

    def publish_detections(
        self,
        person_count: int,
        inference_msec: float,
        processing_msec: float,
        detections: List[Dict[str, Any]],
    ) -> bool:
        """Publish a detection event — QoS 1."""
        return self.publish(
            EdgeTopics.DETECTIONS,
            self._envelope(
                "person_detected",
                {
                    "personCount": person_count,
                    "inferenceMsec": round(inference_msec, 2),
                    "processingMsec": round(processing_msec, 2),
                    "detections": detections,
                },
            ),
            qos=1,
        )

    def publish_tracking(
        self, active_count: int, track_ids: List[int], fps: float
    ) -> bool:
        """Publish tracking update — QoS 1."""
        return self.publish(
            EdgeTopics.TRACKING,
            self._envelope(
                "tracking_update",
                {
                    "activeCount": active_count,
                    "trackIds": track_ids,
                    "fps": round(fps, 2),
                },
            ),
            qos=1,
        )

    def publish_demographics(
        self, person_count: int, demographics: List[Dict[str, Any]]
    ) -> bool:
        """Publish demographics (age estimation) — QoS 1."""
        return self.publish(
            EdgeTopics.DEMOGRAPHICS,
            self._envelope(
                "demographics_update",
                {"personCount": person_count, "demographics": demographics},
            ),
            qos=1,
        )

    def publish_crowd_density(
        self, count: int, density: str, zone_id: Optional[str] = None
    ) -> bool:
        """Publish crowd density aggregate — QoS 0."""
        payload: Dict[str, Any] = {"count": count, "density": density}
        if zone_id:
            payload["zoneId"] = zone_id
        return self.publish(
            EdgeTopics.CROWD_DENSITY,
            self._envelope("crowd_density", payload),
            qos=0,
        )

    def publish_performance(
        self,
        fps: float,
        inference_msec: float,
        processing_msec: float,
        cpu_percent: Optional[float] = None,
        memory_bytes: Optional[int] = None,
    ) -> bool:
        """Publish performance telemetry — QoS 0."""
        payload: Dict[str, Any] = {
            "fps": round(fps, 2),
            "inferenceMsec": round(inference_msec, 2),
            "processingMsec": round(processing_msec, 2),
        }
        if cpu_percent is not None:
            payload["cpuPercent"] = round(cpu_percent, 1)
        if memory_bytes is not None:
            payload["memoryBytes"] = memory_bytes
        return self.publish(
            EdgeTopics.PERFORMANCE,
            self._envelope("performance_update", payload),
            qos=0,
        )

    def publish_camera_health(
        self,
        online: bool,
        source: str,
        resolution: Optional[str] = None,
        fps: Optional[float] = None,
    ) -> bool:
        """Publish camera health status — QoS 0."""
        payload: Dict[str, Any] = {"online": online, "source": source}
        if resolution:
            payload["resolution"] = resolution
        if fps is not None:
            payload["fps"] = round(fps, 2)
        return self.publish(
            EdgeTopics.CAMERA_HEALTH,
            self._envelope("camera_health", payload),
            qos=0,
        )

    def publish_health(
        self,
        service_id: str,
        status: str,
        metrics: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Publish a system health heartbeat — QoS 0."""
        payload: Dict[str, Any] = {
            "status": status,
            "serviceName": "edge-cv",
            "uptime": time.monotonic(),
        }
        if metrics:
            payload["metrics"] = metrics
        return self.publish(
            SystemTopics.HEALTH,
            self._envelope("heartbeat", payload),
            qos=0,
        )

    # Legacy compatibility shims (keep existing callers working)
    def publish_audience_event(self, event: Dict[str, Any]) -> bool:
        """Legacy shim — route to publish_detections if possible."""
        return self.publish(EdgeTopics.DETECTIONS, event, qos=1)

    def publish_audience_aggregate(self, aggregate: Dict[str, Any]) -> bool:
        """Legacy shim — route to publish_crowd_density if possible."""
        return self.publish(EdgeTopics.CROWD_DENSITY, aggregate, qos=0)

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #

    @property
    def is_connected(self) -> bool:
        """Thread-safe read of the current connection state."""
        with self._lock:
            return self._connected

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _publish_raw(
        self, topic: str, payload: Dict[str, Any], qos: int = 0, retain: bool = False
    ) -> bool:
        try:
            raw = json.dumps(payload, default=str)
            result = self._client.publish(topic, raw, qos=qos, retain=retain)
            if result.rc == 0:
                log.debug("MQTT published to [%s] QoS=%d", topic, qos)
                return True
            log.warning("MQTT publish failed on [%s]: rc=%d", topic, result.rc)
            return False
        except Exception as exc:  # pragma: no cover
            log.warning("MQTT publish error on [%s]: %s", topic, exc)
            return False

    def _envelope(self, event: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "deviceId": self._device_id,
            "siteId": self._site_id,
            "deviceType": "EDGE_CAMERA",
            "event": event,
            "payload": data,
        }

    def _start_heartbeat(self) -> None:
        """Start the 30-second heartbeat thread."""
        self._stop_heartbeat.clear()
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, daemon=True, name="mqtt-heartbeat"
        )
        self._heartbeat_thread.start()

    def _heartbeat_loop(self) -> None:
        import psutil  # local import — optional dep

        while not self._stop_heartbeat.wait(30):
            try:
                mem = psutil.Process().memory_info().rss
                cpu = psutil.cpu_percent(interval=None)
                
                status = self._status_callback() if self._status_callback else "healthy"
                
                self.publish_health(
                    service_id=self._device_id,
                    status=status,
                    metrics={"cpuPercent": cpu, "memoryBytes": mem},
                )
            except Exception as exc:  # pragma: no cover
                log.debug("Heartbeat publish failed: %s", exc)

    # ------------------------------------------------------------------ #
    # paho callbacks
    # ------------------------------------------------------------------ #

    def _on_connect(
        self,
        client: Any,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any,
    ) -> None:
        rc_value = reason_code.value if hasattr(reason_code, "value") else reason_code
        if rc_value == 0:
            log.info("MQTT: connected to %s:%s", self._host, self._port)
            with self._lock:
                self._connected = True

            # Subscribe to all command topics
            for topic in EDGE_COMMAND_SUBSCRIPTIONS:
                client.subscribe(topic, qos=1)
                log.info("MQTT: subscribed to [%s]", topic)

            # Re-subscribe any registered user handlers
            for topic in self._handlers:
                if topic not in EDGE_COMMAND_SUBSCRIPTIONS:
                    client.subscribe(topic, qos=1)
                    log.info("MQTT: re-subscribed to [%s]", topic)

            # Announce online
            self._publish_raw(
                SystemTopics.HEALTH,
                self._envelope(
                    "service_online",
                    {"status": "online", "serviceName": "edge-cv"},
                ),
                qos=1,
                retain=True,
            )

            # Start heartbeat thread
            self._start_heartbeat()

        else:
            log.warning(
                "MQTT: connection refused — reason code %s", reason_code
            )
            with self._lock:
                self._connected = False

    def _on_disconnect(
        self,
        client: Any,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any,
    ) -> None:
        log.warning(
            "MQTT: disconnected (reason: %s) — paho will reconnect with backoff.",
            reason_code,
        )
        with self._lock:
            self._connected = False
        # Stop heartbeat — will restart on next connect
        self._stop_heartbeat.set()

    def _on_message(
        self,
        client: Any,
        userdata: Any,
        message: Any,
    ) -> None:
        topic: str = message.topic

        # ── Parse JSON ──────────────────────────────────────────────────
        try:
            raw: Dict[str, Any] = json.loads(message.payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            log.warning("MQTT [%s]: malformed payload — %s", topic, exc)
            return

        # ── Validate envelope ────────────────────────────────────────────
        try:
            BaseEvent.model_validate(raw)
        except ValidationError as exc:
            log.warning(
                "MQTT [%s]: invalid envelope — %s", topic, exc.error_count()
            )
            return

        log.debug("MQTT [%s]: received event '%s'", topic, raw.get("event", "?"))

        # ── Validate command payload if applicable ───────────────────────
        schema_cls = _COMMAND_SCHEMAS.get(topic)
        if schema_cls and raw.get("payload"):
            try:
                schema_cls.model_validate(raw["payload"])
            except ValidationError as exc:
                log.warning(
                    "MQTT [%s]: invalid command payload — %s",
                    topic,
                    exc.error_count(),
                )
                return

        # ── Dispatch to handlers ─────────────────────────────────────────
        for handler in self._handlers.get(topic, []):
            try:
                handler(topic, raw)
            except Exception as exc:  # pragma: no cover
                log.error("MQTT handler error on [%s]: %s", topic, exc)
