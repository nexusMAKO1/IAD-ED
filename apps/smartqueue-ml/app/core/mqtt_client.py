import json
import logging
import threading
from datetime import datetime, UTC
from typing import Any

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion
from app.core.config import settings

logger = logging.getLogger(__name__)


class MQTTClient:
    """Fail-open MQTT client for background publishing."""

    def __init__(self):
        # Using CallbackAPIVersion.VERSION2 as required by paho-mqtt 2.0.0
        self.client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self._connected = False
        self._health_timer: threading.Timer | None = None

    # ------------------------------------------------------------------
    # Connection callbacks
    # ------------------------------------------------------------------

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            logger.info("MQTT Connected successfully")
            self._connected = True
        else:
            logger.error(f"MQTT Connection failed with code {reason_code}")

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        logger.warning(f"MQTT Disconnected: {reason_code}")
        self._connected = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self):
        if settings.MQTT_USER and settings.MQTT_PASSWORD:
            self.client.username_pw_set(settings.MQTT_USER, settings.MQTT_PASSWORD)

        try:
            # connect_async doesn't block if broker is unavailable,
            # and loop_start will keep trying to reconnect.
            self.client.connect_async(settings.MQTT_HOST, settings.MQTT_PORT, 60)
            self.client.loop_start()
            logger.info(f"MQTT client started, connecting to {settings.MQTT_HOST}:{settings.MQTT_PORT}")
        except Exception as e:
            logger.error(f"Failed to start MQTT client: {e}")

        # Start health heartbeat daemon
        self._schedule_health_heartbeat()

    def stop(self):
        # Cancel health heartbeat
        if self._health_timer is not None:
            self._health_timer.cancel()
            self._health_timer = None

        try:
            self.client.loop_stop()
            self.client.disconnect()
            logger.info("MQTT client stopped")
        except Exception as e:
            logger.error(f"Error stopping MQTT client: {e}")

    # ------------------------------------------------------------------
    # Connection state
    # ------------------------------------------------------------------

    @property
    def connected(self) -> bool:
        return self._connected

    def is_mqtt_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Generic publish (internal)
    # ------------------------------------------------------------------

    def _publish(self, topic: str, payload: Any, qos: int = 1, retain: bool = False) -> bool:
        """Publish a message. Fail-open (returns False on error, never raises)."""
        if not self._connected:
            logger.debug(f"MQTT not connected, dropping message for {topic}")
            return False

        try:
            if hasattr(payload, "model_dump_json"):
                payload_str = payload.model_dump_json()
            elif isinstance(payload, dict):
                payload_str = json.dumps(payload)
            else:
                payload_str = str(payload)

            self.client.publish(topic, payload_str, qos=qos, retain=retain)
            return True
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")
            return False

    # ------------------------------------------------------------------
    # Dedicated publish methods — topic/QoS defined once here, not at
    # call sites.  Each is fail-open and never raises.
    # ------------------------------------------------------------------

    def publish_prediction(self, payload: Any) -> bool:
        """Publish a prediction payload to smartqueue/predictions."""
        return self._publish(
            settings.MQTT_TOPIC_PREDICTIONS,
            payload,
            qos=1,
        )

    def publish_anomaly(self, payload: Any) -> bool:
        """Publish an anomaly alert to the general event feed (alerts/anomalies)."""
        return self._publish(
            settings.MQTT_TOPIC_ANOMALIES,
            payload,
            qos=1,
        )

    def publish_dashboard_alert(self, payload: Any) -> bool:
        """Publish an anomaly alert to the SLA-bearing dashboard topic (alerts/dashboard)."""
        return self._publish(
            settings.MQTT_TOPIC_DASHBOARD_ALERT,
            payload,
            qos=settings.DASHBOARD_ALERT_QOS,
        )

    def publish_health(self) -> bool:
        """Publish a retained health heartbeat to system/health."""
        payload = {
            "service": "smartqueue-ml",
            "status": "running",
            "mqtt_connected": self._connected,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        return self._publish(
            settings.MQTT_TOPIC_HEALTH,
            payload,
            qos=1,
            retain=True,
        )

    # ------------------------------------------------------------------
    # Health heartbeat daemon (Item 8)
    # ------------------------------------------------------------------

    def _schedule_health_heartbeat(self):
        """Schedule the next health heartbeat on a daemon timer."""
        self._health_timer = threading.Timer(
            settings.MQTT_HEALTH_INTERVAL_SECONDS,
            self._health_heartbeat_tick,
        )
        self._health_timer.daemon = True
        self._health_timer.start()

    def _health_heartbeat_tick(self):
        """Fire one heartbeat, then re-schedule."""
        try:
            self.publish_health()
        except Exception as e:
            logger.error(f"Health heartbeat failed: {e}")
        # Re-schedule
        self._schedule_health_heartbeat()


# Global instance to be used throughout the app
mqtt_client = MQTTClient()
