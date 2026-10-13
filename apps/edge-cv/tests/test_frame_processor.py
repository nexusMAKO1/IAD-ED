"""
test_frame_processor.py — Unit tests for the modular FrameProcessor pipeline.
"""

from unittest.mock import MagicMock
import numpy as np
import pytest

from app.detector import DetectionResult, Detection
from app.tracking.bytetrack import TrackedPerson
from app.pipeline.frame_processor import FrameProcessor, ProcessedFrameResult


def test_frame_processor_execution():
    # Mock detector
    mock_detector = MagicMock()
    mock_detector.detect.return_value = DetectionResult(
        detections=[
            Detection(x1=10, y1=10, x2=100, y2=200, confidence=0.95, class_id=0, label="person")
        ],
        inference_ms=12.5,
    )

    # Mock tracker
    mock_tracker = MagicMock()
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=1, bbox=[10, 10, 100, 200], confidence=0.95, class_name="person")
    ]

    # Mock age estimator
    mock_age_estimator = MagicMock()
    mock_age_estimator.estimate.return_value = [
        {"age": 28.0, "age_group": "young_adult", "confidence": 0.88}
    ]

    # Mock gender estimator
    mock_gender_estimator = MagicMock()
    mock_gender_estimator.estimate.return_value = [
        {"gender": "female", "gender_confidence": 0.92}
    ]

    processor = FrameProcessor(
        detector=mock_detector,
        tracker=mock_tracker,
        age_estimator=mock_age_estimator,
        gender_estimator=mock_gender_estimator,
    )

    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = processor.process_frame(dummy_frame)

    assert isinstance(res, ProcessedFrameResult)
    assert res.person_count == 1
    assert res.inference_ms == 12.5
    assert len(res.detections) == 1
    det = res.detections[0]
    assert det["track_id"] == 1
    assert det["age_group"] == "young_adult"
    assert det["gender"] == "female"
    assert res.density == "low"


def test_frame_processor_density_thresholds():
    mock_detector = MagicMock()
    mock_detector.detect.return_value = DetectionResult(detections=[], inference_ms=5.0)

    mock_tracker = MagicMock()
    
    processor = FrameProcessor(detector=mock_detector, tracker=mock_tracker)

    # Low
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=i, bbox=[0, 0, 10, 10], confidence=0.9, class_name="person")
        for i in range(3)
    ]
    assert processor.process_frame(np.zeros((100, 100, 3), dtype=np.uint8)).density == "low"

    # Medium
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=i, bbox=[0, 0, 10, 10], confidence=0.9, class_name="person")
        for i in range(6)
    ]
    assert processor.process_frame(np.zeros((100, 100, 3), dtype=np.uint8)).density == "medium"

    # High
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=i, bbox=[0, 0, 10, 10], confidence=0.9, class_name="person")
        for i in range(12)
    ]
    assert processor.process_frame(np.zeros((100, 100, 3), dtype=np.uint8)).density == "high"

    # Critical
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=i, bbox=[0, 0, 10, 10], confidence=0.9, class_name="person")
        for i in range(25)
    ]
    assert processor.process_frame(np.zeros((100, 100, 3), dtype=np.uint8)).density == "critical"
