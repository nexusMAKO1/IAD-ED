import math
import threading
import logging
from datetime import datetime, UTC
from typing import Dict, List, Optional

from app.core.config import settings
from app.schemas.queue import AnomalyAlert
from app.core.mqtt_client import mqtt_client

logger = logging.getLogger(__name__)


class AnomalyDetector:
    def __init__(self):
        # Sliding window of wait times per service type
        self.history: Dict[str, List[float]] = {}

        # Recent anomalies list for the API
        self.recent_anomalies: List[AnomalyAlert] = []

        # Concurrency guard — protects history and recent_anomalies across
        # BackgroundTasks threadpool workers (Item 6).
        self._lock = threading.Lock()

    def check_anomaly(self, service_type: str, wait_time: float) -> Optional[AnomalyAlert]:
        """
        Calculates the z-score for the given wait_time against the sliding window
        for the given service_type.  If it exceeds ANOMALY_Z_THRESHOLD, creates an
        AnomalyAlert **unconditionally** (no cooldown, no budget, no suppression)
        and publishes to both MQTT topics independently.
        
        Note on rolling-window self-limiting behavior:
        Identical repeated outlier values naturally do not flood the alert stream because
        each insertion shifts the window's mean and inflates the standard deviation before
        the next value is scored. This automatically drops the z-score below the threshold 
        after the first few outliers, naturally limiting alert volume without explicit suppression.
        """
        with self._lock:
            # --- Append to per-service_type window ---
            if service_type not in self.history:
                self.history[service_type] = []

            history = self.history[service_type]

            history.append(wait_time)
            if len(history) > settings.ANOMALY_WINDOW_SIZE:
                history.pop(0)

            # Require minimum samples for z-score to be meaningful
            if len(history) < settings.ANOMALY_MIN_SAMPLES:
                return None

            # --- Compute z-score ---
            mean = sum(history) / len(history)
            variance = sum((x - mean) ** 2 for x in history) / len(history)
            std_dev = math.sqrt(variance)

            if std_dev == 0:
                std_dev = 1.0  # Prevent division by zero if all values are identical

            z_score = (wait_time - mean) / std_dev

            # --- Determine severity ---
            severity = None
            threshold_crossed = 0.0
            recommended_action = ""

            if z_score >= settings.ANOMALY_Z_FATAL:
                severity = "fatal"
                threshold_crossed = settings.ANOMALY_Z_FATAL
                recommended_action = settings.RECOMMENDED_ACTION_FATAL
            elif z_score >= settings.ANOMALY_Z_CRITICAL:
                severity = "critical"
                threshold_crossed = settings.ANOMALY_Z_CRITICAL
                recommended_action = settings.RECOMMENDED_ACTION_CRITICAL
            elif z_score >= settings.ANOMALY_Z_THRESHOLD:
                severity = "warning"
                threshold_crossed = settings.ANOMALY_Z_THRESHOLD
                recommended_action = settings.RECOMMENDED_ACTION_WARNING

            if severity is None:
                return None

            # --- Create alert unconditionally ---
            alert = AnomalyAlert(
                service_type=service_type,
                timestamp=datetime.now(UTC),
                z_score=round(z_score, 2),
                threshold_crossed=threshold_crossed,
                severity=severity,
                recommended_action=recommended_action,
            )

            # Track in recent anomalies
            self.recent_anomalies.insert(0, alert)
            if len(self.recent_anomalies) > settings.ANOMALY_RECENT_ALERTS_MAXLEN:
                self.recent_anomalies.pop()

        # --- Publish to MQTT — outside the lock, each independently wrapped ---
        try:
            mqtt_client.publish_dashboard_alert(alert)
        except Exception:
            logger.exception("publish_dashboard_alert_failed", extra={"alert_id": alert.alert_id})

        try:
            mqtt_client.publish_anomaly(alert)
        except Exception:
            logger.exception("publish_anomaly_failed", extra={"alert_id": alert.alert_id})

        return alert

    def get_recent_anomalies(self) -> List[AnomalyAlert]:
        with self._lock:
            return list(self.recent_anomalies)


# Global instance
anomaly_detector = AnomalyDetector()
