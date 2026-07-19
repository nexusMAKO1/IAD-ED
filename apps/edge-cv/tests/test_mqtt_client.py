"""
test_mqtt_client.py — Unit Tests for Edge-CV MQTTClient
Express Display SmartVision — T-021

All tests run without a real MQTT broker.
paho-mqtt is mocked so tests are hermetic and CI-friendly.
"""

from __future__ import annotations

from typing import Dict, Optional


import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers to build valid message objects
# ---------------------------------------------------------------------------


def _make_message(topic: str, payload: dict) -> MagicMock:
    msg = MagicMock()
    msg.topic = topic
    msg.payload = json.dumps(payload).encode("utf-8")
    return msg


def _valid_envelope(event: str = "test", extra_payload: Optional[Dict] = None) -> dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "deviceId": "camera01",
        "siteId": "express-display",
        "event": event,
        "payload": extra_payload or {},
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_paho():
    """Return a mock paho.mqtt.client module and mock client instance."""
    mock_client_instance = MagicMock()
    mock_client_instance.publish.return_value = MagicMock(rc=0)
    mock_client_instance.subscribe.return_value = (0, 1)
    mock_client_instance.unsubscribe.return_value = (0, 1)

    mock_mqtt_module = MagicMock()
    mock_mqtt_module.Client.return_value = mock_client_instance
    mock_mqtt_module.CallbackAPIVersion.VERSION2 = "v2"

    return mock_mqtt_module, mock_client_instance


@pytest.fixture
def client(mock_paho):
    """Return a configured MQTTClient with paho mocked."""
    mock_mqtt_module, mock_client_instance = mock_paho

    with patch.dict(
        "sys.modules", {"paho": MagicMock(), "paho.mqtt": MagicMock(), "paho.mqtt.client": mock_mqtt_module}
    ):
        # Re-import with mock in place
        import importlib
        import apps.edge_cv.app.services.mqtt_client as _mod  # noqa: PLC0415 — test import
        importlib.reload(_mod)

        # Patch _PAHO_AVAILABLE
        _mod._PAHO_AVAILABLE = True  # type: ignore[attr-defined]
        _mod.mqtt = mock_mqtt_module  # type: ignore[attr-defined]

        from apps.edge_cv.app.services.mqtt_client import MQTTClient  # type: ignore

        c = MQTTClient(
            host="localhost",
            port=1883,
            username="test",
            password="pass",
            client_id="test-edge-cv",
        )
        c._client = mock_client_instance
        # Simulate connected state
        with c._lock:
            c._connected = True

        return c


# ---------------------------------------------------------------------------
# Because the above fixture has complex import patching we use a simpler
# approach: directly test with sys.modules patching at module level.
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_command_schemas():
    """Ensure _COMMAND_SCHEMAS is rebuilt for each test."""
    import apps.edge_cv.app.services.mqtt_client as mod  # type: ignore

    mod._COMMAND_SCHEMAS = {}  # type: ignore[attr-defined]
    yield


# ---------------------------------------------------------------------------
# We'll use a simpler fixture that patches paho at import time
# ---------------------------------------------------------------------------


def make_client_with_mocks():
    """Create an MQTTClient where paho is already mocked at instance level."""
    # Direct import — paho is installed so we can test the class directly
    import sys
    import os

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    from app.services.mqtt_client import MQTTClient

    c = MQTTClient(
        host="localhost",
        port=1883,
        username="user",
        password="pass",
        client_id="test-id",
        keepalive=30,
        site_id="test-site",
    )

    # Inject mock paho client
    mock_paho_client = MagicMock()
    mock_paho_client.publish.return_value = MagicMock(rc=0)
    mock_paho_client.subscribe.return_value = (0, 1)
    c._client = mock_paho_client

    with c._lock:
        c._connected = True

    return c, mock_paho_client


# ---------------------------------------------------------------------------
# Tests — Connection state
# ---------------------------------------------------------------------------


class TestConnectionState:
    def test_is_connected_false_by_default(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        assert c.is_connected is False

    def test_is_connected_true_after_manual_set(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        with c._lock:
            c._connected = True
        assert c.is_connected is True

    def test_on_disconnect_sets_connected_false(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        with c._lock:
            c._connected = True

        c._stop_heartbeat = MagicMock()
        c._on_disconnect(None, None, None, 0, None)
        assert c.is_connected is False


# ---------------------------------------------------------------------------
# Tests — Publish
# ---------------------------------------------------------------------------


class TestPublish:
    def test_publish_returns_true_when_connected(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish("smartvision/test", {"key": "val"}, qos=1)
        assert result is True
        mock_paho.publish.assert_called_once()

    def test_publish_returns_false_when_disconnected(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        result = c.publish("some/topic", {"key": "val"})
        assert result is False

    def test_publish_detections(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish_detections(
            person_count=3,
            inference_msec=12.5,
            processing_msec=20.0,
            detections=[{"x1": 0, "y1": 0, "x2": 100, "y2": 200, "confidence": 0.9}],
        )
        assert result is True
        call_args = mock_paho.publish.call_args
        topic = call_args[0][0]
        assert topic == "smartvision/edge/detections"
        payload = json.loads(call_args[0][1])
        assert payload["payload"]["personCount"] == 3

    def test_publish_tracking(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish_tracking(active_count=2, track_ids=[1, 2], fps=30.0)
        assert result is True
        call_args = mock_paho.publish.call_args
        assert call_args[0][0] == "smartvision/edge/tracking"

    def test_publish_health_uses_qos_0(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_health("camera01", "healthy")
        call_args = mock_paho.publish.call_args
        assert call_args[1]["qos"] == 0

    def test_publish_performance(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish_performance(fps=25.0, inference_msec=8.0, processing_msec=15.0)
        assert result is True

    def test_publish_crowd_density(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish_crowd_density(count=10, density="high", zone_id="zone-a")
        assert result is True
        call_args = mock_paho.publish.call_args
        assert call_args[0][0] == "smartvision/edge/crowd-density"

    def test_publish_camera_health(self):
        c, mock_paho = make_client_with_mocks()
        result = c.publish_camera_health(online=True, source="rtsp://cam01")
        assert result is True

    def test_envelope_structure(self):
        c, mock_paho = make_client_with_mocks()
        c.publish("smartvision/test", {"foo": "bar"}, qos=0)
        raw = json.loads(mock_paho.publish.call_args[0][1])
        # publish sends payload directly, not an envelope — but helpers do
        assert "foo" in raw

    def test_detections_envelope_has_correct_fields(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_detections(1, 10.0, 15.0, [])
        raw = json.loads(mock_paho.publish.call_args[0][1])
        assert "timestamp" in raw
        assert "deviceId" in raw
        assert "siteId" in raw
        assert raw["event"] == "person_detected"
        assert "payload" in raw


# ---------------------------------------------------------------------------
# Tests — Subscribe / Handler dispatch
# ---------------------------------------------------------------------------


class TestSubscribeAndHandlers:
    def test_register_handler_stored(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        handler = Mock()
        c.register_handler("smartvision/commands/camera", handler)
        assert "smartvision/commands/camera" in c._handlers
        assert handler in c._handlers["smartvision/commands/camera"]

    def test_on_message_dispatches_valid_envelope(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        handler = Mock()
        topic = "smartvision/edge/detections"
        c.register_handler(topic, handler)
        c._client = MagicMock()

        msg = _make_message(topic, _valid_envelope("person_detected"))
        c._on_message(None, None, msg)

        handler.assert_called_once()
        call_args = handler.call_args[0]
        assert call_args[0] == topic

    def test_on_message_rejects_malformed_json(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        handler = Mock()
        c.register_handler("smartvision/edge/detections", handler)

        msg = MagicMock()
        msg.topic = "smartvision/edge/detections"
        msg.payload = b"not-valid-json{"

        c._on_message(None, None, msg)
        handler.assert_not_called()

    def test_on_message_rejects_invalid_envelope(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        handler = Mock()
        c.register_handler("smartvision/edge/detections", handler)

        # Missing required envelope fields
        bad = {"event": "test"}
        msg = _make_message("smartvision/edge/detections", bad)
        c._on_message(None, None, msg)

        handler.assert_not_called()

    def test_on_message_rejects_invalid_command_payload(self):
        from app.services.mqtt_client import MQTTClient, _build_command_schemas

        c = MQTTClient(host="localhost", port=1883)
        import apps.edge_cv.app.services.mqtt_client as mod  # type: ignore

        mod._COMMAND_SCHEMAS = _build_command_schemas()  # type: ignore[attr-defined]
        handler = Mock()
        topic = "smartvision/commands/config-update"
        c.register_handler(topic, handler)

        # confidence out of range
        envelope = _valid_envelope("config_update")
        envelope["payload"] = {"confidence": 99.0}
        msg = _make_message(topic, envelope)
        c._on_message(None, None, msg)

        handler.assert_not_called()


# ---------------------------------------------------------------------------
# Tests — Connection failure handling
# ---------------------------------------------------------------------------


class TestConnectionFailure:
    def test_connect_returns_false_when_paho_unavailable(self, monkeypatch):
        import apps.edge_cv.app.services.mqtt_client as mod  # type: ignore

        monkeypatch.setattr(mod, "_PAHO_AVAILABLE", False)
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        monkeypatch.setattr(c, "_PAHO_AVAILABLE", False, raising=False)

        # We patch at module level
        import app.services.mqtt_client as m  # type: ignore

        original = m._PAHO_AVAILABLE
        m._PAHO_AVAILABLE = False  # type: ignore[attr-defined]
        result = c.connect()
        m._PAHO_AVAILABLE = original  # type: ignore[attr-defined]
        assert result is False

    def test_publish_returns_false_when_not_connected(self):
        from app.services.mqtt_client import MQTTClient

        c = MQTTClient(host="localhost", port=1883)
        assert c.publish("some/topic", {}) is False


# ---------------------------------------------------------------------------
# Tests — Topic validation
# ---------------------------------------------------------------------------


class TestTopicConstants:
    def test_edge_topics_use_smartvision_prefix(self):
        from app.mqtt.topics import EdgeTopics

        for attr in vars(EdgeTopics):
            if not attr.startswith("_"):
                value = getattr(EdgeTopics, attr)
                assert value.startswith("smartvision/"), f"{attr} does not start with 'smartvision/'"

    def test_command_topics_use_smartvision_prefix(self):
        from app.mqtt.topics import CommandTopics

        for attr in vars(CommandTopics):
            if not attr.startswith("_"):
                value = getattr(CommandTopics, attr)
                assert value.startswith("smartvision/"), f"{attr} does not start with 'smartvision/'"

    def test_system_topics_use_smartvision_prefix(self):
        from app.mqtt.topics import SystemTopics

        for attr in vars(SystemTopics):
            if not attr.startswith("_"):
                value = getattr(SystemTopics, attr)
                assert value.startswith("smartvision/"), f"{attr} does not start with 'smartvision/'"

    def test_subscriptions_list_not_empty(self):
        from app.mqtt.topics import EDGE_COMMAND_SUBSCRIPTIONS

        assert len(EDGE_COMMAND_SUBSCRIPTIONS) > 0


# ---------------------------------------------------------------------------
# Tests — QoS level by topic
# ---------------------------------------------------------------------------


class TestQoSLevels:
    def test_detections_published_with_qos_1(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_detections(1, 10.0, 15.0, [])
        call_args = mock_paho.publish.call_args
        assert call_args[1]["qos"] == 1

    def test_performance_published_with_qos_0(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_performance(fps=30.0, inference_msec=10.0, processing_msec=15.0)
        call_args = mock_paho.publish.call_args
        assert call_args[1]["qos"] == 0

    def test_tracking_published_with_qos_1(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_tracking(active_count=2, track_ids=[1, 2], fps=25.0)
        call_args = mock_paho.publish.call_args
        assert call_args[1]["qos"] == 1

    def test_demographics_published_with_qos_1(self):
        c, mock_paho = make_client_with_mocks()
        c.publish_demographics(person_count=2, demographics=[])
        call_args = mock_paho.publish.call_args
        assert call_args[1]["qos"] == 1
