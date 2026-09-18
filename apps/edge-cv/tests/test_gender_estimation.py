import numpy as np
import pytest
from app.demographics.gender_estimation import GenderEstimator, InvalidInputError
import cv2

@pytest.fixture
def mock_gender_estimator(monkeypatch):
    import app.demographics.gender_estimation as gm
    monkeypatch.setattr(gm, "HAS_ONNXRUNTIME", False)
    
    estimator = gm.GenderEstimator(model_path="dummy.onnx", confidence_threshold=0.7)
    return estimator

def test_extract_face_roi(mock_gender_estimator):
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    bbox = [10, 20, 90, 100]
    crop = mock_gender_estimator.extract_face_roi(frame, bbox)

    assert crop.shape[0] == 28
    assert crop.shape[1] == 64

def test_extract_face_roi_out_of_bounds(mock_gender_estimator):
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    bbox = [-10, -20, 110, 120]
    crop = mock_gender_estimator.extract_face_roi(frame, bbox)
    
    assert crop.shape[0] == int(100 * 0.35)
    assert crop.shape[1] == int(100 - (100 * 0.20))

def test_extract_face_roi_invalid_input(mock_gender_estimator):
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    bbox = [10, 10, 10, 10]
    with pytest.raises(InvalidInputError):
        mock_gender_estimator.extract_face_roi(frame, bbox)

def test_fallback_behavior(mock_gender_estimator):
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    detections = [{"bbox": [0, 0, 50, 50]}]
    results = mock_gender_estimator.estimate(frame, detections)
    
    assert len(results) == 1
    assert results[0]["gender"] == "unknown"
    assert results[0]["gender_confidence"] == 0.0

def test_preprocess(mock_gender_estimator):
    face_img = np.zeros((50, 50, 3), dtype=np.uint8)
    tensor = mock_gender_estimator.preprocess(face_img)
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32

def test_softmax(mock_gender_estimator):
    logits = np.array([[2.0, 1.0], [0.1, 0.2]])
    probs = mock_gender_estimator.softmax(logits)
    assert probs.shape == (2, 2)
    assert np.isclose(np.sum(probs[0]), 1.0)
    assert probs[0][0] > probs[0][1]
