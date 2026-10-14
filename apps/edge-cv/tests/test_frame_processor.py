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


def test_frame_processor_track_mapping_with_skipped_and_reordered_crops():
    """
    Regression Test (Phase 4):
    Ensure demographics are strictly mapped by track_id and not by naive index zip.
    Verify:
      - Skipped crop on person 1 does not shift person 2's data onto person 1
      - Reordered results from estimators preserve correct track associations
    """
    mock_detector = MagicMock()
    mock_detector.detect.return_value = DetectionResult(detections=[], inference_ms=8.0)

    mock_tracker = MagicMock()
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=101, bbox=[10, 10, 50, 100], confidence=0.9, class_name="person"),
        TrackedPerson(track_id=102, bbox=[60, 10, 100, 100], confidence=0.85, class_name="person"),
        TrackedPerson(track_id=103, bbox=[120, 10, 180, 100], confidence=0.92, class_name="person"),
    ]

    mock_age_estimator = MagicMock()
    # Age estimator only returned results for track 103 and 101 (in reverse order, track 102 was skipped)
    mock_age_estimator.estimate.return_value = [
        {"track_id": 103, "bbox": [120, 10, 180, 100], "age": 65, "age_group": "senior", "confidence": 0.95},
        {"track_id": 101, "bbox": [10, 10, 50, 100], "age": 22, "age_group": "young_adult", "confidence": 0.88},
    ]

    mock_gender_estimator = MagicMock()
    # Gender estimator only processed track 102
    mock_gender_estimator.estimate.return_value = [
        {"track_id": 102, "bbox": [60, 10, 100, 100], "gender": "male", "gender_confidence": 0.99},
    ]

    processor = FrameProcessor(
        detector=mock_detector,
        tracker=mock_tracker,
        age_estimator=mock_age_estimator,
        gender_estimator=mock_gender_estimator,
    )

    res = processor.process_frame(np.zeros((200, 200, 3), dtype=np.uint8))
    assert res.person_count == 3
    dets = {d["track_id"]: d for d in res.detections}

    # Track 101 must receive its young_adult age and have no gender
    assert dets[101]["age_group"] == "young_adult"
    assert dets[101]["age"] == 22
    assert "gender" not in dets[101]

    # Track 102 had age skipped, but must receive male gender
    assert "age_group" not in dets[102]
    assert dets[102]["gender"] == "male"
    assert dets[102]["gender_confidence"] == 0.99

    # Track 103 must receive its senior age and have no gender
    assert dets[103]["age_group"] == "senior"
    assert dets[103]["age"] == 65
    assert "gender" not in dets[103]


def test_frame_processor_estimator_exceptions_do_not_break_tracks():
    """
    Ensure that unexpected exceptions in age or gender estimators do not crash
    the pipeline and preserve track detection records.
    """
    mock_detector = MagicMock()
    mock_detector.detect.return_value = DetectionResult(detections=[], inference_ms=5.0)

    mock_tracker = MagicMock()
    mock_tracker.update.return_value = [
        TrackedPerson(track_id=55, bbox=[0, 0, 40, 80], confidence=0.8, class_name="person")
    ]

    mock_age_estimator = MagicMock()
    mock_age_estimator.estimate.side_effect = RuntimeError("ONNX session crash")

    mock_gender_estimator = MagicMock()
    mock_gender_estimator.estimate.side_effect = ValueError("Corrupt crop image")

    processor = FrameProcessor(
        detector=mock_detector,
        tracker=mock_tracker,
        age_estimator=mock_age_estimator,
        gender_estimator=mock_gender_estimator,
    )

    res = processor.process_frame(np.zeros((100, 100, 3), dtype=np.uint8))
    assert res.person_count == 1
    assert len(res.detections) == 1
    det = res.detections[0]
    assert det["track_id"] == 55
    assert "age_group" not in det
    assert "gender" not in det

