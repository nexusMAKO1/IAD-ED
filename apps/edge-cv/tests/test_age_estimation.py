"""
test_age_estimation.py — Unit Tests for Age Estimation Module
IAD & SmartQueue AI — Express Display SmartVision (T-010)
"""

import cv2
import numpy as np
import pytest

from app.demographics.age_estimation import (
    AgeEstimator,
    InvalidInputError,
)


@pytest.fixture
def dummy_frame():
    """Create a simple 480x640 dummy BGR image with a human face mock block."""
    frame = np.ones((480, 640, 3), dtype=np.uint8) * 255
    # Draw a mock head/face area
    cv2.rectangle(frame, (280, 100), (360, 200), (128, 128, 128), -1)
    return frame


@pytest.fixture
def estimator():
    """Create an AgeEstimator instance in fallback/mock mode."""
    return AgeEstimator()


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_empty_detections(estimator, dummy_frame):
    """Test that empty detections return an empty list of estimations."""
    results = estimator.estimate(dummy_frame, [])
    assert results == []


def test_one_face(estimator, dummy_frame):
    """Test estimation for a single face bounding box."""
    detections = [
        {"bbox": [200, 100, 400, 400], "confidence": 0.95}
    ]
    results = estimator.estimate(dummy_frame, detections)
    
    assert len(results) == 1
    assert "bbox" in results[0]
    assert results[0]["bbox"] == [200, 100, 400, 400]
    assert "age" in results[0]
    assert "age_group" in results[0]
    assert "confidence" in results[0]
    assert isinstance(results[0]["age"], int)
    assert results[0]["age_group"] in estimator.age_groups


def test_multiple_faces(estimator, dummy_frame):
    """Test estimation for multiple face bounding boxes."""
    detections = [
        {"bbox": [50, 50, 150, 200], "confidence": 0.90},
        {"bbox": [300, 100, 450, 350], "confidence": 0.88},
    ]
    results = estimator.estimate(dummy_frame, detections)
    
    assert len(results) == 2
    for res, det in zip(results, detections):
        assert res["bbox"] == det["bbox"]
        assert isinstance(res["age"], int)
        assert res["age_group"] in estimator.age_groups
        assert 0.0 <= res["confidence"] <= 1.0


def test_invalid_bbox(estimator, dummy_frame):
    """Test behavior with various invalid bounding box structures."""
    # Bbox coordinates out of order
    with pytest.raises(InvalidInputError):
        estimator.estimate(dummy_frame, [{"bbox": [300, 300, 100, 100], "confidence": 0.95}])

    # Bbox containing negative or wrong count of coordinates
    with pytest.raises(InvalidInputError):
        estimator.estimate(dummy_frame, [{"bbox": [10, 20], "confidence": 0.95}])

    # Missing bbox key
    with pytest.raises(InvalidInputError):
        estimator.estimate(dummy_frame, [{"confidence": 0.95}])


def test_invalid_frame(estimator):
    """Test behavior when frame is empty or invalid."""
    detections = [{"bbox": [100, 100, 200, 200], "confidence": 0.95}]
    
    # None frame
    with pytest.raises(InvalidInputError):
        estimator.estimate(None, detections)

    # Empty frame (size 0)
    empty_frame = np.empty((0, 0, 3), dtype=np.uint8)
    with pytest.raises(InvalidInputError):
        estimator.estimate(empty_frame, detections)


def test_custom_age_groups():
    """Test that custom age groups are mapped correctly."""
    custom_groups = {
        "toddler": (0, 3),
        "kid": (4, 12),
        "teenager": (13, 19),
        "midage": (20, 50),
        "elderly": (51, 100),
    }
    est = AgeEstimator(age_groups=custom_groups)
    
    assert est.get_age_group(2) == "toddler"
    assert est.get_age_group(10) == "kid"
    assert est.get_age_group(16) == "teenager"
    assert est.get_age_group(35) == "midage"
    assert est.get_age_group(75) == "elderly"
    assert est.get_age_group(150) == "unknown"


def test_face_extraction_clipping(estimator, dummy_frame):
    """Test that face ROI clipping handles out-of-bound coords correctly."""
    # Box goes beyond image width (640) and height (480)
    out_of_bounds_bbox = [100, 100, 800, 600]
    
    # Extracting should not throw out of bounds exception
    crop = estimator.extract_face_roi(dummy_frame, out_of_bounds_bbox)
    assert crop is not None
    assert crop.size > 0
    # Expected height should be clipped: max height is 480, width is 640.
    # face_y2 = min(y2, y1 + 0.35 * box_height) = min(480, 100 + 0.35 * 380) = 233
    # face_x2 = min(640, 800 - 70) = 640
    assert crop.shape[0] == 133  # 233 - 100
    assert crop.shape[1] == 432  # 586 - 154
