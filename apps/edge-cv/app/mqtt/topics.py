"""
topics.py — MQTT Topic Constants (Edge-CV)
Express Display SmartVision — T-021

Mirrors the Backend's mqtt.topics.ts so that both services
always agree on the topic hierarchy. Never hardcode topic strings
in any other module — always import from here.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Root prefix
# ---------------------------------------------------------------------------
_ROOT = "smartvision"


# ---------------------------------------------------------------------------
# Edge-CV publishes to these topics
# ---------------------------------------------------------------------------
class EdgeTopics:
    DETECTIONS = f"{_ROOT}/edge/detections"
    TRACKING = f"{_ROOT}/edge/tracking"
    DEMOGRAPHICS = f"{_ROOT}/edge/demographics"
    CROWD_DENSITY = f"{_ROOT}/edge/crowd-density"
    PERFORMANCE = f"{_ROOT}/edge/performance"
    CAMERA_HEALTH = f"{_ROOT}/edge/camera-health"
    STATUS = f"{_ROOT}/edge/status"


# ---------------------------------------------------------------------------
# Edge-CV subscribes to these command topics
# ---------------------------------------------------------------------------
class CommandTopics:
    CONFIG_UPDATE = f"{_ROOT}/commands/config-update"
    CAMERA = f"{_ROOT}/commands/camera"
    MODEL_UPDATE = f"{_ROOT}/commands/model-update"
    RESTART = f"{_ROOT}/commands/restart"


# ---------------------------------------------------------------------------
# System-wide
# ---------------------------------------------------------------------------
class SystemTopics:
    HEALTH = f"{_ROOT}/system/health"
    LOGS = f"{_ROOT}/system/logs"


# Convenience aliases
TOPIC_DETECTIONS = EdgeTopics.DETECTIONS
TOPIC_TRACKING = EdgeTopics.TRACKING
TOPIC_DEMOGRAPHICS = EdgeTopics.DEMOGRAPHICS
TOPIC_CROWD_DENSITY = EdgeTopics.CROWD_DENSITY
TOPIC_PERFORMANCE = EdgeTopics.PERFORMANCE
TOPIC_CAMERA_HEALTH = EdgeTopics.CAMERA_HEALTH
TOPIC_STATUS = EdgeTopics.STATUS
TOPIC_SYSTEM_HEALTH = SystemTopics.HEALTH

# All topics to subscribe on startup
EDGE_COMMAND_SUBSCRIPTIONS: list[str] = [
    CommandTopics.CONFIG_UPDATE,
    CommandTopics.CAMERA,
    CommandTopics.MODEL_UPDATE,
    CommandTopics.RESTART,
]
