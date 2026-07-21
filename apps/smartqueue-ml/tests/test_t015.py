import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import threading

from app.main import app
from app.schemas.prediction import PredictionResponse
from app.services.anomaly import AnomalyDetector
from app.core.config import settings

client = TestClient(app)

@patch("app.routers.predict.anomaly_detector.check_anomaly")
@patch("app.routers.predict.mqtt_client.publish_prediction")
@patch("app.routers.predict.predictor.predict_wait_time")
def test_predict_side_effects_independent(mock_predict, mock_publish, mock_anomaly):
    """
    Test that a failure in the anomaly check does not affect prediction publishing,
    and a failure in prediction publishing does not affect the anomaly check.
    Both should be called despite failures in the other.
    """
    import asyncio
    
    # Setup mock response
    mock_resp = PredictionResponse(
        predicted_wait_time_seconds=120,
        congestion_level="low",
        confidence_interval_percentage=85.0,
        factors={},
        is_fallback=False,
        timestamp="2020-01-01T00:00:00Z"
    )
    
    async def mock_predict_coro(*args, **kwargs):
        return mock_resp
    
    mock_predict.side_effect = mock_predict_coro

    # Case 1: Anomaly check fails, prediction publish should still run
    mock_anomaly.side_effect = Exception("Anomaly check failed!")
    mock_publish.side_effect = None
    
    response = client.get("/api/v1/queue/predict?service_type=retrait&queue_length=1")
    assert response.status_code == 200
    
    # Assert both were called
    mock_publish.assert_called_once()
    mock_anomaly.assert_called_once()

    # Reset mocks
    mock_publish.reset_mock()
    mock_anomaly.reset_mock()
    
    # Case 2: Prediction publish fails, anomaly check should still run
    mock_publish.side_effect = Exception("Publish failed!")
    mock_anomaly.side_effect = None
    
    response = client.get("/api/v1/queue/predict?service_type=retrait&queue_length=1")
    assert response.status_code == 200
    
    # Assert both were called
    mock_publish.assert_called_once()
    mock_anomaly.assert_called_once()

    # Reset mocks
    mock_publish.reset_mock()
    mock_anomaly.reset_mock()

    # Case 3: Both fail, endpoint should still return 200
    mock_publish.side_effect = Exception("Publish failed!")
    mock_anomaly.side_effect = Exception("Anomaly failed!")
    
    response = client.get("/api/v1/queue/predict?service_type=retrait&queue_length=1")
    assert response.status_code == 200
    
    # Assert both were called
    mock_publish.assert_called_once()
    mock_anomaly.assert_called_once()


@pytest.fixture
def clean_anomaly_detector():
    return AnomalyDetector()

@patch("app.services.anomaly.mqtt_client")
def test_per_service_type_window_separation(mock_mqtt, clean_anomaly_detector):
    """1. Per-service_type window separation"""
    for _ in range(10):
        clean_anomaly_detector.check_anomaly("retrait", 60.0)
    
    alert = clean_anomaly_detector.check_anomaly("retrait", 100.0)
    assert alert is not None
    assert alert.service_type == "retrait"
    
    for _ in range(10):
        clean_anomaly_detector.check_anomaly("reclamation", 200.0)
    
    alert2 = clean_anomaly_detector.check_anomaly("reclamation", 100.0)
    assert alert2 is None

@patch("app.services.anomaly.mqtt_client")
def test_min_samples_gating(mock_mqtt, clean_anomaly_detector):
    """2. Min-samples gating"""
    for i in range(settings.ANOMALY_MIN_SAMPLES - 1):
        alert = clean_anomaly_detector.check_anomaly("test_service", 1000.0)
        assert alert is None

@patch("app.services.anomaly.mqtt_client")
def test_unconditional_publish_no_suppression(mock_mqtt, clean_anomaly_detector):
    """3. Unconditional publish / no suppression"""
    service_types = ["retrait", "depot", "info"]
    for st in service_types:
        for _ in range(10):
            clean_anomaly_detector.check_anomaly(st, 60.0)
        clean_anomaly_detector.check_anomaly(st, 100.0)
        
    clean_anomaly_detector.check_anomaly("retrait", 10000.0)
    
    recent = clean_anomaly_detector.get_recent_anomalies()
    assert len(recent) == 4
    assert mock_mqtt.publish_dashboard_alert.call_count == 4
    assert mock_mqtt.publish_anomaly.call_count == 4

def test_ack_endpoint_200_path():
    """4. Ack endpoint 200 path"""
    from app.services.anomaly import anomaly_detector
    from app.schemas.queue import AnomalyAlert
    from datetime import datetime, UTC
    alert = AnomalyAlert(
        service_type="test",
        timestamp=datetime.now(UTC),
        z_score=5.0,
        threshold_crossed=3.0,
        severity="fatal",
        recommended_action="Test"
    )
    anomaly_detector.recent_anomalies.insert(0, alert)
    
    response = client.post(
        f"/api/v1/alerts/{alert.alert_id}/ack",
        headers={"X-Operator-Id": "test-user"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "ack_id" in data
    assert data["alert_id"] == alert.alert_id
    assert data["acknowledged_by"] == "test-user"
    assert "acknowledged_at" in data
    assert data["channel"] == "dashboard"
    
    anomaly_detector.recent_anomalies.remove(alert)

def test_ack_endpoint_404_path():
    """5. Ack endpoint 404 path"""
    response = client.post(
        "/api/v1/alerts/nonexistent-id/ack",
        headers={"X-Operator-Id": "test-user"}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

@patch("app.services.anomaly.mqtt_client")
def test_concurrency(mock_mqtt, clean_anomaly_detector):
    """6. Concurrency"""
    threads = []
    
    def worker():
        clean_anomaly_detector.check_anomaly("concurrent_service", 50.0)
        
    for _ in range(20):
        t = threading.Thread(target=worker)
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    history = clean_anomaly_detector.history.get("concurrent_service", [])
    assert len(history) == 20
