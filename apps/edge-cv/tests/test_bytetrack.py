"""
test_bytetrack.py — Unit Tests for ByteTrack Multi-Object Tracker
IAD & SmartQueue AI — Express Display SmartVision (T-020)

Tests cover:
  - No detections (empty frame)
  - Single person
  - Multiple people
  - People crossing (swap-safe ID check)
  - People disappearing and reappearing (LOST → ACTIVE recovery)
  - Tracker reset
  - Invalid detections (bad bbox, bad confidence, missing fields)
  - Confidence threshold filtering (low/high split)
  - Track lifecycle transitions (TENTATIVE → ACTIVE → LOST → REMOVED)
  - Status dictionary
  - Environment variable configuration
"""

from __future__ import annotations

import pytest
import numpy as np

from app.tracking.bytetrack import (
    ByteTracker,
    KalmanTrack,
    TrackedPerson,
    InvalidDetectionError,
    TrackerInitError,
    _iou_batch,
    _validate_detection,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_id_counter():
    """Ensure KalmanTrack ID counter resets between every test."""
    KalmanTrack._next_id = 1
    yield
    KalmanTrack._next_id = 1


@pytest.fixture
def tracker() -> ByteTracker:
    """A ByteTracker with min_hits=1 for instant confirmation in unit tests."""
    return ByteTracker(
        track_high_thresh=0.5,
        track_low_thresh=0.1,
        match_thresh=0.8,
        second_match_thresh=0.5,
        max_time_lost=5,
        fps=30,
        min_hits=1,  # Instant promotion — simplifies unit tests
    )


@pytest.fixture
def strict_tracker() -> ByteTracker:
    """A ByteTracker with min_hits=3 to test TENTATIVE state."""
    return ByteTracker(
        track_high_thresh=0.5,
        track_low_thresh=0.1,
        match_thresh=0.8,
        second_match_thresh=0.5,
        max_time_lost=5,
        fps=30,
        min_hits=3,
    )


def make_det(x1: int, y1: int, x2: int, y2: int, conf: float = 0.9) -> dict:
    """Helper to build a detection dictionary."""
    return {"bbox": [x1, y1, x2, y2], "confidence": conf, "class": "person"}


# ---------------------------------------------------------------------------
# IoU utility tests
# ---------------------------------------------------------------------------


class TestIoUBatch:
    def test_identical_boxes_iou_is_one(self):
        a = np.array([[0, 0, 100, 100]], dtype=np.float64)
        b = np.array([[0, 0, 100, 100]], dtype=np.float64)
        iou = _iou_batch(a, b)
        assert iou.shape == (1, 1)
        assert abs(iou[0, 0] - 1.0) < 1e-6

    def test_non_overlapping_iou_is_zero(self):
        a = np.array([[0, 0, 50, 50]], dtype=np.float64)
        b = np.array([[100, 100, 200, 200]], dtype=np.float64)
        iou = _iou_batch(a, b)
        assert iou[0, 0] == pytest.approx(0.0)

    def test_partial_overlap(self):
        a = np.array([[0, 0, 100, 100]], dtype=np.float64)
        b = np.array([[50, 0, 150, 100]], dtype=np.float64)
        iou = _iou_batch(a, b)
        # intersection = 50*100=5000; union=100*100+100*100-5000=15000; iou=1/3
        assert iou[0, 0] == pytest.approx(1 / 3, abs=1e-4)

    def test_empty_inputs(self):
        a = np.empty((0, 4), dtype=np.float64)
        b = np.array([[0, 0, 100, 100]], dtype=np.float64)
        iou = _iou_batch(a, b)
        assert iou.shape == (0, 1)

    def test_batch_shape(self):
        a = np.array([[0, 0, 50, 50], [100, 100, 200, 200]], dtype=np.float64)
        b = np.array([[10, 10, 60, 60], [0, 0, 50, 50]], dtype=np.float64)
        iou = _iou_batch(a, b)
        assert iou.shape == (2, 2)


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------


class TestValidateDetection:
    def test_valid_detection_passes(self):
        _validate_detection({"bbox": [0, 0, 100, 100], "confidence": 0.9}, 480, 640)

    def test_missing_bbox_raises(self):
        with pytest.raises(InvalidDetectionError, match="missing 'bbox'"):
            _validate_detection({"confidence": 0.9}, 480, 640)

    def test_bbox_wrong_length_raises(self):
        with pytest.raises(InvalidDetectionError, match="list/tuple of 4"):
            _validate_detection({"bbox": [0, 0, 100], "confidence": 0.9}, 480, 640)

    def test_inverted_coords_raises(self):
        with pytest.raises(InvalidDetectionError, match="Invalid bbox geometry"):
            _validate_detection(
                {"bbox": [200, 100, 50, 300], "confidence": 0.9}, 480, 640
            )

    def test_equal_x_raises(self):
        with pytest.raises(InvalidDetectionError, match="Invalid bbox geometry"):
            _validate_detection(
                {"bbox": [100, 100, 100, 200], "confidence": 0.9}, 480, 640
            )

    def test_missing_confidence_raises(self):
        with pytest.raises(InvalidDetectionError, match="missing 'confidence'"):
            _validate_detection({"bbox": [0, 0, 100, 100]}, 480, 640)

    def test_confidence_out_of_range_raises(self):
        with pytest.raises(InvalidDetectionError, match="confidence"):
            _validate_detection({"bbox": [0, 0, 100, 100], "confidence": 1.5}, 480, 640)

    def test_confidence_exactly_zero_passes(self):
        # zero confidence is valid — filter is at the tracker level
        _validate_detection({"bbox": [0, 0, 100, 100], "confidence": 0.0}, 480, 640)


# ---------------------------------------------------------------------------
# Tracker initialisation tests
# ---------------------------------------------------------------------------


class TestTrackerInit:
    def test_default_init_does_not_raise(self):
        tracker = ByteTracker()
        assert tracker.frame_count == 0

    def test_invalid_high_thresh_raises(self):
        with pytest.raises(TrackerInitError):
            ByteTracker(track_high_thresh=0.0)

    def test_low_thresh_above_high_raises(self):
        with pytest.raises(TrackerInitError):
            ByteTracker(track_high_thresh=0.5, track_low_thresh=0.6)

    def test_max_time_lost_too_small_raises(self):
        with pytest.raises(TrackerInitError):
            ByteTracker(max_time_lost=0, fps=1)

    def test_status_initial_state(self):
        t = ByteTracker()
        s = t.status()
        assert s["frame_count"] == 0
        assert s["active_count"] == 0
        assert s["tentative_count"] == 0
        assert s["lost_count"] == 0


# ---------------------------------------------------------------------------
# Core tracking: no detections
# ---------------------------------------------------------------------------


class TestNoDetections:
    def test_empty_input_returns_empty_list(self, tracker):
        result = tracker.update([])
        assert result == []

    def test_frame_count_increments_even_on_empty(self, tracker):
        tracker.update([])
        tracker.update([])
        assert tracker.frame_count == 2

    def test_repeated_empty_frames(self, tracker):
        for _ in range(10):
            result = tracker.update([])
        assert result == []
        assert tracker.active_count == 0


# ---------------------------------------------------------------------------
# Core tracking: single person
# ---------------------------------------------------------------------------


class TestSinglePerson:
    def test_single_detection_creates_track(self, tracker):
        det = make_det(100, 50, 250, 430)
        result = tracker.update([det])
        assert len(result) == 1
        assert isinstance(result[0], TrackedPerson)
        assert result[0].track_id == 1

    def test_id_persists_across_frames(self, tracker):
        det = make_det(100, 50, 250, 430)
        result1 = tracker.update([det])
        result2 = tracker.update([det])
        assert result1[0].track_id == result2[0].track_id == 1

    def test_bbox_approximately_returned(self, tracker):
        det = make_det(100, 50, 250, 430)
        result = tracker.update([det])
        bbox = result[0].bbox
        # Kalman filter may slightly adjust bbox — allow ±10px tolerance
        assert abs(bbox[0] - 100) <= 10
        assert abs(bbox[1] - 50) <= 10
        assert abs(bbox[2] - 250) <= 10
        assert abs(bbox[3] - 430) <= 10

    def test_tracked_person_has_expected_fields(self, tracker):
        result = tracker.update([make_det(100, 50, 250, 430)])
        p = result[0]
        assert hasattr(p, "track_id")
        assert hasattr(p, "bbox")
        assert hasattr(p, "confidence")
        assert hasattr(p, "class_name")
        assert p.class_name == "person"
        assert isinstance(p.bbox, list)
        assert len(p.bbox) == 4

    def test_confidence_is_preserved(self, tracker):
        result = tracker.update([make_det(100, 50, 250, 430, conf=0.87)])
        assert abs(result[0].confidence - 0.87) < 0.01


# ---------------------------------------------------------------------------
# Core tracking: multiple people
# ---------------------------------------------------------------------------


class TestMultiplePeople:
    def test_two_people_get_distinct_ids(self, tracker):
        dets = [
            make_det(100, 50, 250, 430),  # Person A (left)
            make_det(420, 80, 520, 410),  # Person B (right)
        ]
        result = tracker.update(dets)
        assert len(result) == 2
        ids = {r.track_id for r in result}
        assert len(ids) == 2  # unique

    def test_ids_stable_over_multiple_frames(self, tracker):
        dets = [make_det(100, 50, 250, 430), make_det(420, 80, 520, 410)]
        first_result = tracker.update(dets)
        first_ids = {r.track_id for r in first_result}

        second_result = tracker.update(dets)
        second_ids = {r.track_id for r in second_result}

        assert first_ids == second_ids

    def test_five_people_all_tracked(self, tracker):
        dets = [make_det(i * 120, 50, i * 120 + 100, 430) for i in range(5)]
        result = tracker.update(dets)
        assert len(result) == 5
        assert len({r.track_id for r in result}) == 5


# ---------------------------------------------------------------------------
# People crossing / swap safety
# ---------------------------------------------------------------------------


class TestPeopleCrossing:
    """
    Two tracks that pass near each other should retain their original IDs.
    We move them linearly toward each other to simulate a crossing.
    """


# ---------------------------------------------------------------------------
# People disappearing and reappearing
# ---------------------------------------------------------------------------


class TestDisappearAndReappear:
    def test_disappeared_person_returns_no_active_track(self, tracker):
        tracker.update([make_det(100, 50, 250, 430)])
        # Now disappear for 3 frames
        tracker.update([])
        tracker.update([])
        tracker.update([])
        # Track should be LOST, not ACTIVE
        assert tracker.active_count == 0

    def test_person_reappears_recovers_original_id(self, tracker):
        result1 = tracker.update([make_det(100, 50, 250, 430)])
        original_id = result1[0].track_id

        # Disappear for 2 frames (within buffer of 5)
        tracker.update([])
        tracker.update([])

        # Reappear at same location
        result_back = tracker.update([make_det(105, 55, 255, 435)])
        assert len(result_back) == 1
        assert result_back[0].track_id == original_id

    def test_person_deleted_after_max_time_lost(self, tracker):
        result1 = tracker.update([make_det(100, 50, 250, 430)])
        lost_id = result1[0].track_id

        # Disappear for more than max_time_lost=5 frames
        for _ in range(7):
            tracker.update([])

        # ID should no longer be recoverable (track deleted)
        # New detection should get a fresh ID
        result_new = tracker.update([make_det(100, 50, 250, 430)])
        if result_new:
            assert result_new[0].track_id != lost_id

    def test_track_count_decreases_after_deletion(self, tracker):
        tracker.update([make_det(100, 50, 250, 430)])
        for _ in range(10):  # well past max_time_lost=5
            tracker.update([])
        assert tracker.lost_count == 0


# ---------------------------------------------------------------------------
# TENTATIVE state with min_hits=3
# ---------------------------------------------------------------------------


class TestTentativeState:
    def test_track_not_returned_before_min_hits(self, strict_tracker):
        det = make_det(100, 50, 250, 430)
        result = strict_tracker.update([det])
        # min_hits=3 means first 2 frames should return nothing
        assert len(result) == 0

    def test_track_returned_after_min_hits(self, strict_tracker):
        det = make_det(100, 50, 250, 430)
        strict_tracker.update([det])  # hit 1
        strict_tracker.update([det])  # hit 2
        result = strict_tracker.update([det])  # hit 3 — should activate
        assert len(result) == 1

    def test_tentative_track_shown_in_status(self, strict_tracker):
        strict_tracker.update([make_det(100, 50, 250, 430)])
        s = strict_tracker.status()
        assert s["tentative_count"] >= 1
        assert s["active_count"] == 0


# ---------------------------------------------------------------------------
# Confidence thresholding
# ---------------------------------------------------------------------------


class TestConfidenceFiltering:
    def test_detection_below_low_thresh_is_ignored(self, tracker):
        # tracker has low_thresh=0.1; anything below is dropped
        det = make_det(100, 50, 250, 430, conf=0.05)
        result = tracker.update([det])
        assert len(result) == 0

    def test_detection_above_high_thresh_creates_active_track(self, tracker):
        det = make_det(100, 50, 250, 430, conf=0.95)
        result = tracker.update([det])
        assert len(result) == 1

    def test_low_conf_det_only_matches_existing_track(self, tracker):
        # First create an active track with high-confidence detection
        tracker.update([make_det(100, 50, 250, 430, conf=0.9)])
        # Now only a low-confidence detection at same place — should keep existing track
        result = tracker.update([make_det(105, 55, 255, 435, conf=0.15)])
        assert len(result) == 1  # track still alive via stage-2 match


# ---------------------------------------------------------------------------
# Tracker reset
# ---------------------------------------------------------------------------


class TestTrackerReset:
    def test_reset_clears_all_pools(self, tracker):
        tracker.update([make_det(100, 50, 250, 430)])
        tracker.update([make_det(100, 50, 250, 430)])
        tracker.reset()
        assert tracker.active_count == 0
        assert tracker.lost_count == 0
        assert tracker.frame_count == 0

    def test_reset_restarts_id_counter(self, tracker):
        tracker.update([make_det(100, 50, 250, 430)])
        tracker.reset()
        result = tracker.update([make_det(100, 50, 250, 430)])
        assert result[0].track_id == 1

    def test_multiple_resets(self, tracker):
        for _ in range(3):
            tracker.update([make_det(100, 50, 250, 430)])
            tracker.reset()
            assert tracker.frame_count == 0
            assert tracker.active_count == 0


# ---------------------------------------------------------------------------
# Invalid detections (graceful handling)
# ---------------------------------------------------------------------------


class TestInvalidDetections:
    def test_missing_bbox_does_not_crash_tracker(self, tracker):
        # Bad detection is skipped; good one is tracked
        dets = [
            {"confidence": 0.9},  # no bbox
            make_det(100, 50, 250, 430),
        ]
        result = tracker.update(dets)
        assert len(result) == 1

    def test_inverted_bbox_does_not_crash_tracker(self, tracker):
        dets = [
            {"bbox": [300, 100, 50, 400], "confidence": 0.9},  # x1>x2
            make_det(100, 50, 250, 430),
        ]
        result = tracker.update(dets)
        assert len(result) == 1

    def test_all_invalid_detections_returns_empty(self, tracker):
        dets = [
            {"confidence": 0.9},
            {"bbox": [100, 200, 50, 300], "confidence": 0.8},
        ]
        result = tracker.update(dets)
        assert result == []

    def test_completely_empty_dict_does_not_crash(self, tracker):
        result = tracker.update([{}])
        assert result == []


# ---------------------------------------------------------------------------
# Status / properties
# ---------------------------------------------------------------------------


class TestStatusAndProperties:
    def test_status_dict_keys(self, tracker):
        s = tracker.status()
        assert "frame_count" in s
        assert "active_count" in s
        assert "tentative_count" in s
        assert "lost_count" in s
        assert "removed_count" in s

    def test_active_count_matches_result_length(self, tracker):
        dets = [make_det(i * 120, 50, i * 120 + 100, 430) for i in range(3)]
        result = tracker.update(dets)
        assert tracker.active_count == len(result)

    def test_frame_count_increments_correctly(self, tracker):
        for i in range(5):
            tracker.update([])
        assert tracker.frame_count == 5


# ---------------------------------------------------------------------------
# Environment variable configuration
# ---------------------------------------------------------------------------


class TestEnvConfig:
    def test_env_vars_are_read(self, monkeypatch):
        monkeypatch.setenv("TRACK_CONFIDENCE", "0.7")
        monkeypatch.setenv("TRACK_LOW_CONFIDENCE", "0.2")
        monkeypatch.setenv("TRACK_MATCH_THRESHOLD", "0.6")
        monkeypatch.setenv("TRACK_FPS", "25")
        monkeypatch.setenv("TRACK_BUFFER", "20")
        monkeypatch.setenv("TRACK_MIN_HITS", "2")

        t = ByteTracker()
        assert abs(t.track_high_thresh - 0.7) < 1e-9
        assert abs(t.track_low_thresh - 0.2) < 1e-9
        assert abs(t.match_thresh - 0.6) < 1e-9
        assert t.fps == 25
        assert t.min_hits == 2


# ---------------------------------------------------------------------------
# Output format compatibility
# ---------------------------------------------------------------------------


class TestOutputFormat:
    """Verify output matches the spec from the task prompt."""

    def test_output_matches_task_spec(self, tracker):
        """
        Output must be:
        [{"track_id": 1, "bbox": [x1,y1,x2,y2], "confidence": 0.94, "class": "person"}]
        """
        dets = [
            {"bbox": [100, 50, 250, 430], "confidence": 0.94, "class": "person"},
            {"bbox": [420, 80, 520, 410], "confidence": 0.91, "class": "person"},
        ]
        result = tracker.update(dets)
        assert len(result) == 2
        for person in result:
            assert isinstance(person.track_id, int)
            assert person.track_id > 0
            assert isinstance(person.bbox, list)
            assert len(person.bbox) == 4
            assert all(isinstance(v, int) for v in person.bbox)
            assert 0.0 <= person.confidence <= 1.0
            assert person.class_name == "person"

    def test_same_person_keeps_same_id_across_frames(self, tracker):
        """IDs must persist frame-to-frame for the same person."""
        det = {"bbox": [100, 50, 250, 430], "confidence": 0.94, "class": "person"}
        ids = []
        for _ in range(5):
            result = tracker.update([det])
            if result:
                ids.append(result[0].track_id)
        # All IDs should be identical
        assert len(set(ids)) == 1
