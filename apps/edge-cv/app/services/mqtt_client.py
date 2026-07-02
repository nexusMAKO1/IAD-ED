"""
mqtt_client.py — MQTT Client Wrapper
IAD & SmartQueue AI — Edge CV Service (T-009)

Wraps paho-mqtt 2.x with:
  - Non-blocking connection using a dedicated background thread
  - Graceful handling when the broker is unreachable at startup
  - Publish helpers for the standard IAD topics defined in T-001
  - Thread-safe connection-status flag queried by /health and /status

Topic conventions (from T-001-interface-contracts.md):
  iad/audience/events      QoS 1 — per-detection events
  iad/audience/aggregates  QoS 0 — periodic aggregations
  system/health            QoS 0 — heartbeat

The client will keep trying to reconnect in the background; the rest of
the service should not block on MQTT availability.
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("iad.mqtt_client")

# paho-mqtt is an optional hard-dependency listed in requirements.txt.
# Import lazily so the module can be loaded in environments where the
# package is not yet installed (e.g. lightweight unit-test containers).
try:
    import paho.mqtt.client as mqtt  # type: ignore[import-untyped]

    _PAHO_AVAILABLE = True
except ImportError:  # pragma: no cover
    _PAHO_AVAILABLE = False
    log.warning("paho-mqtt not installed — MQTT publishing disabled.")


# ---------------------------------------------------------------------------
# MQTT topic constants (T-001 contract)
# ---------------------------------------------------------------------------
TOPIC_AUDIENCE_EVENTS = "iad/audience/events"
TOPIC_AUDIENCE_AGGREGATES = "iad/audience/aggregates"
TOPIC_SYSTEM_HEALTH = "system/health"


class MQTTClient:
    """
    Paho-MQTT wrapper that connects asynchronously during lifespan startup.

    The client keeps a background network loop running in a daemon thread,
    so publish calls never block the FastAPI event loop.

    Parameters
    ----------
    host:      Broker hostname or IP.
    port:      Broker TCP port (default 1883).
    username:  Optional username for broker authentication.
    password:  Optional password (never logged).
    client_id: MQTT client identifier string.
    """

    def __init__(
        self,
        host: str,
        port: int = 1883,
        username: str = "",
        password: str = "",
        client_id: str = "edge-cv-service",
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._client_id = client_id

        self._connected: bool = False
        self._lock = threading.Lock()
        self._client: Any = None  # mqtt.Client | None

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #

    def connect(self) -> bool:
        """
        Attempt a synchronous connection (with a short timeout).

        Returns True when the broker is reachable, False otherwise.
        The service must continue to operate even when this returns False.
        """
        if not _PAHO_AVAILABLE:
            log.warning("MQTT unavailable — paho-mqtt not installed.")
            return False

        try:
            # paho-mqtt 2.x requires the CallbackAPIVersion enum
            self._client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self._client_id,
                clean_session=True,
            )

            if self._username:
                self._client.username_pw_set(self._username, self._password)

            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect

            # Attempt connection with a 5-second socket timeout
            self._client.connect(self._host, self._port, keepalive=60)

            # Start the threaded loop — does not block
            self._client.loop_start()

            # Give the broker up to 3 seconds to ACK the CONNECT packet
            import time

            deadline = time.monotonic() + 3.0
            while time.monotonic() < deadline:
                if self.is_connected:
                    return True
                time.sleep(0.1)

            log.warning(
                "MQTT: broker did not respond within 3 seconds — "
                "will keep retrying in background."
            )
            return False

        except Exception as exc:
            log.warning(
                "MQTT: connection failed — %s. Service continues without MQTT.", exc
            )
            return False

    def disconnect(self) -> None:
        """Gracefully stop the loop and disconnect from the broker."""
        if self._client is not None:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception as exc:  # pragma: no cover
                log.debug("MQTT disconnect raised: %s", exc)
        with self._lock:
            self._connected = False

    # ------------------------------------------------------------------ #
    # Publish helpers
    # ------------------------------------------------------------------ #

    def publish(self, topic: str, payload: dict[str, Any], qos: int = 0) -> bool:
        """
        Serialise *payload* to JSON and publish to *topic*.

        Parameters
        ----------
        topic:   MQTT topic string.
        payload: Python dict — will be JSON-serialised.
        qos:     Quality of Service level (0, 1, or 2).

        Returns
        -------
        bool  True when the message was queued successfully.
        """
        if not self.is_connected or self._client is None:
            log.debug("MQTT not connected — skipping publish to %s", topic)
            return False

        try:
            raw = json.dumps(payload, default=str)
            result = self._client.publish(topic, raw, qos=qos)
            return result.rc == 0
        except Exception as exc:  # pragma: no cover
            log.warning("MQTT publish error on %s: %s", topic, exc)
            return False

    def publish_health(
        self,
        service_id: str,
        status: str,
        metrics: dict[str, Any] | None = None,
    ) -> bool:
        """
        Publish a system/health heartbeat (T-001 §2.6).

        Parameters
        ----------
        service_id: Unique identifier (e.g. hostname).
        status:     'healthy' | 'degraded' | 'unhealthy'
        metrics:    Optional dict of numeric metrics (cpu_usage_percent, fps…)
        """
        payload: dict[str, Any] = {
            "service_name": "edge-cv",
            "service_id": service_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": status,
        }
        if metrics:
            payload["metrics"] = metrics

        return self.publish(TOPIC_SYSTEM_HEALTH, payload, qos=0)

    def publish_audience_event(self, event: dict[str, Any]) -> bool:
        """Publish a raw audience detection event (T-001 §2.1, QoS 1)."""
        return self.publish(TOPIC_AUDIENCE_EVENTS, event, qos=1)

    def publish_audience_aggregate(self, aggregate: dict[str, Any]) -> bool:
        """Publish an audience aggregate (T-001 §2.2, QoS 0)."""
        return self.publish(TOPIC_AUDIENCE_AGGREGATES, aggregate, qos=0)

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #

    @property
    def is_connected(self) -> bool:
        """Thread-safe read of the current connection state."""
        with self._lock:
            return self._connected

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
        """Called by paho when the connection is established."""
        if reason_code == 0 or (
            hasattr(reason_code, "value") and reason_code.value == 0
        ):
            log.info("MQTT: connected to %s:%s", self._host, self._port)
            with self._lock:
                self._connected = True
        else:
            log.warning("MQTT: connection refused — reason code %s", reason_code)
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
        """Called by paho when the connection is lost."""
        log.warning("MQTT: disconnected (reason: %s) — will reconnect.", reason_code)
        with self._lock:
            self._connected = False
