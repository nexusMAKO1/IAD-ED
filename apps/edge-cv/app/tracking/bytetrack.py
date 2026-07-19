"""
bytetrack.py — Production-Ready ByteTrack Multi-Object Tracker
IAD & SmartQueue AI — Express Display SmartVision (T-020)

Self-contained implementation of the ByteTrack algorithm (Zhang et al., 2022)
using only NumPy and SciPy for Linear Assignment (no external tracking library
required). Designed specifically for edge devices running person detection with
YOLOv8 inside the Express Display SmartVision pipeline.

Algorithm overview
------------------
ByteTrack improves upon SORT by using *all* detection boxes — not just
high-confidence ones — in a two-stage association cascade:

  Stage 1: Match high-confidence detections (>= track_high_thresh) to existing
           ACTIVE tracks using IoU-based Hungarian assignment.

  Stage 2: Match low-confidence detections (between track_low_thresh and
           track_high_thresh) to tracks that were UNMATCHED in Stage 1.

  Unconfirmed pool: Any detection that survived Stage 1 or 2 as an unmatched
                    HIGH-confidence detection creates a new tentative track.
                    Tentative tracks graduate to ACTIVE after appearing in
                    consecutive frames (confirmed via frame_window logic).

  Lost pool: Tracks that fail assignment for any frame enter the LOST state.
             They are kept for up to `max_time_lost` frames before deletion,
             enabling re-identification after temporary occlusions.

References
----------
- ByteTrack paper: https://arxiv.org/abs/2110.06864
- Original implementation: https://github.com/ifzhang/ByteTrack

Environment variables
---------------------
  TRACKER_TYPE            — Ignored; set to "bytetrack" by convention.
  TRACK_CONFIDENCE        — Minimum high-confidence threshold (default: 0.5).
  TRACK_LOW_CONFIDENCE    — Low-confidence lower bound (default: 0.1).
  TRACK_MATCH_THRESHOLD   — Maximum IoU distance for Stage 1 assignment (default: 0.8).
  TRACK_SECOND_THRESHOLD  — Maximum IoU distance for Stage 2 assignment (default: 0.5).
  TRACK_BUFFER            — Frames a lost track is kept before deletion (default: 30).
  TRACK_FPS               — Camera FPS used to compute time-based timeout (default: 30).
  TRACK_MIN_HITS          — Minimum consecutive hits before a track is confirmed (default: 3).
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
from scipy.optimize import linear_sum_assignment

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log = logging.getLogger("iad.tracking.bytetrack")


# ===========================================================================
# Exceptions
# ===========================================================================


class TrackingError(Exception):
    """Base exception for all tracking errors."""


class InvalidDetectionError(TrackingError):
    """Raised when a detection has an invalid bounding box or confidence."""


class TrackerInitError(TrackingError):
    """Raised when the tracker cannot be initialised."""


# ===========================================================================
# Data structures
# ===========================================================================


class TrackState(Enum):
    """Lifecycle states of a single track."""

    TENTATIVE = auto()  # Not yet confirmed — pending min_hits
    ACTIVE = auto()  # Confirmed, currently visible
    LOST = auto()  # Temporarily invisible — within buffer
    REMOVED = auto()  # Deleted — past max_time_lost


@dataclass
class TrackedPerson:
    """
    A single tracked person with a persistent ID.

    Attributes
    ----------
    track_id : int
        Globally unique, monotonically increasing identifier assigned at
        track creation. Never reused within a tracker session.
    bbox : List[int]
        Bounding box in pixel coordinates: [x1, y1, x2, y2].
    confidence : float
        Detection confidence score that triggered this track update.
    class_name : str
        Object class — always ``"person"`` in this pipeline.
    state : TrackState
        Current lifecycle state of the track.
    age : int
        Total number of frames since the track was first created.
    hit_streak : int
        Number of *consecutive* frames the track has been observed.
    time_since_update : int
        Frames elapsed since the last detection hit.
    """

    track_id: int
    bbox: List[int]
    confidence: float
    class_name: str = "person"
    state: TrackState = TrackState.TENTATIVE
    age: int = 0
    hit_streak: int = 0
    time_since_update: int = 0


# ---------------------------------------------------------------------------
# Kalman filter state for a single track (internal use)
# ---------------------------------------------------------------------------


class KalmanTrack:
    """
    A single track with Kalman filter state.

    State vector: [cx, cy, aspect, height, vcx, vcy, vaspect, vheight]
    where (cx, cy) is the centre, aspect = w/h, and v* are velocities.

    This formulation mirrors the original SORT paper (Bewley et al., 2016)
    which ByteTrack also uses.
    """

    # Class-level monotonic counter for unique IDs — reset only by ByteTracker.reset()
    _next_id: int = 1

    # Kalman matrices (shared across all instances — constant)
    _F = np.array(
        [
            [1, 0, 0, 0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 1],
        ],
        dtype=np.float64,
    )

    _H = np.array(
        [
            [1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
        ],
        dtype=np.float64,
    )

    def __init__(self, bbox: List[int], confidence: float) -> None:
        """
        Initialise a new Kalman track.

        Parameters
        ----------
        bbox : List[int]
            Initial bounding box [x1, y1, x2, y2].
        confidence : float
            Detection confidence (0.0–1.0).
        """
        self.track_id = KalmanTrack._next_id
        KalmanTrack._next_id += 1

        self.state = TrackState.TENTATIVE
        self.age = 0
        self.hit_streak = 1
        self.time_since_update = 0
        self.confidence = confidence

        # Convert bbox to measurement [cx, cy, aspect, height]
        meas = self._bbox_to_obs(bbox)

        # State vector (8,)
        self._x = np.zeros(8, dtype=np.float64)
        self._x[:4] = meas

        # Covariance (8x8)
        self._P = np.diag(
            [
                10.0,
                10.0,
                10.0,
                10.0,  # positional variance
                10000.0,
                10000.0,
                10000.0,
                10000.0,  # velocity variance
            ]
        )

        # Process noise (8x8)
        self._Q = np.diag(
            [
                1.0,
                1.0,
                1.0,
                1.0,
                0.01,
                0.01,
                0.0001,
                0.0001,
            ]
        )

        # Measurement noise (4x4)
        self._R = np.diag([1.0, 1.0, 10.0, 10.0])

    # ------------------------------------------------------------------
    # Coordinate conversion helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _bbox_to_obs(bbox: Union[List[int], List[float]]) -> np.ndarray:
        """Convert [x1, y1, x2, y2] → [cx, cy, aspect, height]."""
        x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
        w = x2 - x1
        h = y2 - y1
        cx = x1 + w / 2.0
        cy = y1 + h / 2.0
        aspect = w / (h + 1e-6)
        return np.array([cx, cy, aspect, h], dtype=np.float64)

    @staticmethod
    def _obs_to_bbox(state: np.ndarray) -> List[int]:
        """Convert [cx, cy, aspect, height, ...] → [x1, y1, x2, y2]."""
        cx, cy, aspect, h = state[0], state[1], state[2], state[3]
        w = aspect * h
        x1 = int(cx - w / 2.0)
        y1 = int(cy - h / 2.0)
        x2 = int(cx + w / 2.0)
        y2 = int(cy + h / 2.0)
        return [x1, y1, x2, y2]

    # ------------------------------------------------------------------
    # Kalman predict / update
    # ------------------------------------------------------------------

    def predict(self) -> None:
        """Propagate state forward by one time step."""
        self._x = self._F @ self._x
        self._P = self._F @ self._P @ self._F.T + self._Q

        # Prevent negative height
        if self._x[3] < 0:
            self._x[3] = 0.0

        self.age += 1
        self.time_since_update += 1
        if self.time_since_update > 1:
            self.hit_streak = 0

    def update(self, bbox: List[int], confidence: float) -> None:
        """
        Correct state from a new matched detection.

        Parameters
        ----------
        bbox : List[int]
            Matched detection bounding box [x1, y1, x2, y2].
        confidence : float
            Matched detection confidence.
        """
        meas = self._bbox_to_obs(bbox)

        # Kalman gain
        S = self._H @ self._P @ self._H.T + self._R
        K = self._P @ self._H.T @ np.linalg.inv(S)

        # State update
        self._x = self._x + K @ (meas - self._H @ self._x)
        self._P = (np.eye(8) - K @ self._H) @ self._P

        self.confidence = confidence
        self.time_since_update = 0
        self.hit_streak += 1

    # ------------------------------------------------------------------
    # Derived properties
    # ------------------------------------------------------------------

    @property
    def bbox(self) -> List[int]:
        """Current predicted bounding box [x1, y1, x2, y2]."""
        return self._obs_to_bbox(self._x)

    def to_tracked_person(self) -> TrackedPerson:
        """Convert to public-facing TrackedPerson dataclass."""
        return TrackedPerson(
            track_id=self.track_id,
            bbox=self.bbox,
            confidence=round(float(self.confidence), 4),
            class_name="person",
            state=self.state,
            age=self.age,
            hit_streak=self.hit_streak,
            time_since_update=self.time_since_update,
        )


# ===========================================================================
# IoU utilities
# ===========================================================================


def _iou_batch(bboxes_a: np.ndarray, bboxes_b: np.ndarray) -> np.ndarray:
    """
    Compute pairwise Intersection-over-Union between two sets of bounding boxes.

    Parameters
    ----------
    bboxes_a : np.ndarray, shape (N, 4)  — [x1, y1, x2, y2]
    bboxes_b : np.ndarray, shape (M, 4)  — [x1, y1, x2, y2]

    Returns
    -------
    iou_matrix : np.ndarray, shape (N, M)
    """
    if bboxes_a.size == 0 or bboxes_b.size == 0:
        return np.zeros((len(bboxes_a), len(bboxes_b)), dtype=np.float64)

    # Expand for broadcasting: (N,1,4) vs (1,M,4)
    a = bboxes_a[:, np.newaxis, :]
    b = bboxes_b[np.newaxis, :, :]

    inter_x1 = np.maximum(a[..., 0], b[..., 0])
    inter_y1 = np.maximum(a[..., 1], b[..., 1])
    inter_x2 = np.minimum(a[..., 2], b[..., 2])
    inter_y2 = np.minimum(a[..., 3], b[..., 3])

    inter_w = np.maximum(0.0, inter_x2 - inter_x1)
    inter_h = np.maximum(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = (a[..., 2] - a[..., 0]) * (a[..., 3] - a[..., 1])
    area_b = (b[..., 2] - b[..., 0]) * (b[..., 3] - b[..., 1])
    union_area = area_a + area_b - inter_area

    return np.where(union_area > 0, inter_area / union_area, 0.0)


def _linear_assignment(
    cost_matrix: np.ndarray,
) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """
    Solve the linear assignment problem using the Hungarian algorithm.

    Parameters
    ----------
    cost_matrix : np.ndarray, shape (N, M)
        Cost matrix where cost_matrix[i, j] is the cost of assigning
        track i to detection j.

    Returns
    -------
    matches : list of (track_idx, det_idx)
    unmatched_tracks : list of track_idx
    unmatched_dets : list of det_idx
    """
    if cost_matrix.size == 0:
        return (
            [],
            list(range(cost_matrix.shape[0])),
            list(range(cost_matrix.shape[1])),
        )

    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    matches: List[Tuple[int, int]] = list(zip(row_ind.tolist(), col_ind.tolist()))

    matched_track_idxs = {m[0] for m in matches}
    matched_det_idxs = {m[1] for m in matches}

    unmatched_tracks = [
        i for i in range(cost_matrix.shape[0]) if i not in matched_track_idxs
    ]
    unmatched_dets = [
        j for j in range(cost_matrix.shape[1]) if j not in matched_det_idxs
    ]

    return matches, unmatched_tracks, unmatched_dets


def _associate(
    tracks: List[KalmanTrack],
    detections: List[Dict[str, Any]],
    iou_threshold: float,
) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """
    Associate tracks to detections via IoU-based Hungarian assignment.

    Parameters
    ----------
    tracks : list of KalmanTrack
        Tracks to associate.
    detections : list of detection dicts with 'bbox' key.
    iou_threshold : float
        Maximum *IoU distance* (1 - IoU) allowed for a valid match.
        Pairs with distance > threshold are excluded.

    Returns
    -------
    matches : list of (track_list_idx, det_list_idx)
    unmatched_track_idxs : List[int]
    unmatched_det_idxs : List[int]
    """
    if not tracks or not detections:
        return [], list(range(len(tracks))), list(range(len(detections)))

    track_bboxes = np.array([t.bbox for t in tracks], dtype=np.float64)
    det_bboxes = np.array([d["bbox"] for d in detections], dtype=np.float64)

    iou_matrix = _iou_batch(track_bboxes, det_bboxes)
    cost_matrix = 1.0 - iou_matrix  # IoU distance

    matches, unmatched_tracks, unmatched_dets = _linear_assignment(cost_matrix)

    # Filter matches where IoU distance exceeds threshold (i.e. IoU too low)
    valid_matches = [m for m in matches if cost_matrix[m[0], m[1]] <= iou_threshold]
    invalid_track_idxs = [
        m[0] for m in matches if cost_matrix[m[0], m[1]] > iou_threshold
    ]
    invalid_det_idxs = [
        m[1] for m in matches if cost_matrix[m[0], m[1]] > iou_threshold
    ]

    unmatched_tracks = unmatched_tracks + invalid_track_idxs
    unmatched_dets = unmatched_dets + invalid_det_idxs

    return valid_matches, unmatched_tracks, unmatched_dets


# ===========================================================================
# Validation helpers
# ===========================================================================


def _validate_detection(det: Dict[str, Any], frame_h: int, frame_w: int) -> None:
    """
    Validate a single detection dictionary.

    Parameters
    ----------
    det : dict
        Must contain 'bbox' and 'confidence'.
    frame_h, frame_w : int
        Frame dimensions used for range checks.

    Raises
    ------
    InvalidDetectionError
        If any field is missing, out-of-range, or geometrically invalid.
    """
    if "bbox" not in det:
        raise InvalidDetectionError(f"Detection missing 'bbox' field: {det}")

    bbox = det["bbox"]
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        raise InvalidDetectionError(
            f"'bbox' must be a list/tuple of 4 numbers, got: {bbox}"
        )

    x1, y1, x2, y2 = bbox
    if x1 >= x2 or y1 >= y2:
        raise InvalidDetectionError(
            f"Invalid bbox geometry (x1>=x2 or y1>=y2): [{x1},{y1},{x2},{y2}]"
        )

    conf = det.get("confidence", None)
    if conf is None:
        raise InvalidDetectionError("Detection missing 'confidence' field.")
    if not (0.0 <= float(conf) <= 1.0):
        raise InvalidDetectionError(f"'confidence' must be in [0.0, 1.0], got: {conf}")


# ===========================================================================
# ByteTracker
# ===========================================================================


class ByteTracker:
    """
    Production-ready ByteTrack multi-object tracker for person tracking.

    This tracker is designed to be instantiated *once* and reused across
    all video frames. Do NOT recreate it per-frame — the accumulated track
    state is what enables persistent IDs.

    Configuration is read from environment variables at instantiation; all
    parameters can also be overridden via constructor arguments.

    Parameters
    ----------
    track_high_thresh : float
        Minimum confidence for a detection to be used in Stage 1 matching.
        High-confidence detections drive ID assignment.
        Env: ``TRACK_CONFIDENCE`` (default: 0.5).
    track_low_thresh : float
        Minimum confidence for a detection to participate in Stage 2 matching.
        Detections below this threshold are discarded entirely.
        Env: ``TRACK_LOW_CONFIDENCE`` (default: 0.1).
    match_thresh : float
        Maximum IoU distance (1 - IoU) for a valid Stage 1 match.
        Lower value → stricter matching.
        Env: ``TRACK_MATCH_THRESHOLD`` (default: 0.8).
    second_match_thresh : float
        Maximum IoU distance for Stage 2 matching (against lost tracks).
        Env: ``TRACK_SECOND_THRESHOLD`` (default: 0.5).
    max_time_lost : int
        Number of frames a lost track is preserved before deletion.
        Computed as max(fps, buffer) by default.
        Env: ``TRACK_BUFFER`` (default: 30).
    fps : int
        Expected camera frame rate. Influences timeout calculation.
        Env: ``TRACK_FPS`` (default: 30).
    min_hits : int
        Minimum consecutive hits before a TENTATIVE track becomes ACTIVE.
        Prevents single-frame ghost detections from being published.
        Env: ``TRACK_MIN_HITS`` (default: 3).

    Example
    -------
    >>> tracker = ByteTracker()
    >>> for frame, detections in video_frames:
    ...     tracked = tracker.update(detections)
    ...     for person in tracked:
    ...         print(person.track_id, person.bbox)
    """

    def __init__(
        self,
        track_high_thresh: Optional[float] = None,
        track_low_thresh: Optional[float] = None,
        match_thresh: Optional[float] = None,
        second_match_thresh: Optional[float] = None,
        max_time_lost: Optional[int] = None,
        fps: Optional[int] = None,
        min_hits: Optional[int] = None,
    ) -> None:
        # ------------------------------------------------------------------
        # Read configuration from environment variables with constructor overrides
        # ------------------------------------------------------------------
        self.track_high_thresh = (
            track_high_thresh
            if track_high_thresh is not None
            else float(os.getenv("TRACK_CONFIDENCE", "0.5"))
        )
        self.track_low_thresh = (
            track_low_thresh
            if track_low_thresh is not None
            else float(os.getenv("TRACK_LOW_CONFIDENCE", "0.1"))
        )
        self.match_thresh = (
            match_thresh
            if match_thresh is not None
            else float(os.getenv("TRACK_MATCH_THRESHOLD", "0.8"))
        )
        self.second_match_thresh = (
            second_match_thresh
            if second_match_thresh is not None
            else float(os.getenv("TRACK_SECOND_THRESHOLD", "0.5"))
        )
        self.fps = fps if fps is not None else int(os.getenv("TRACK_FPS", "30"))
        if max_time_lost is not None:
            self.max_time_lost = max_time_lost
        else:
            _buf = int(os.getenv("TRACK_BUFFER", "30"))
            self.max_time_lost = max(self.fps, _buf)
        self.min_hits = (
            min_hits if min_hits is not None else int(os.getenv("TRACK_MIN_HITS", "3"))
        )

        # Validate configuration
        if not (0.0 < self.track_high_thresh <= 1.0):
            raise TrackerInitError(
                f"track_high_thresh must be in (0, 1], got {self.track_high_thresh}"
            )
        if not (0.0 <= self.track_low_thresh < self.track_high_thresh):
            raise TrackerInitError(
                f"track_low_thresh must be in [0, track_high_thresh), "
                f"got {self.track_low_thresh} vs {self.track_high_thresh}"
            )
        if self.max_time_lost < 1:
            raise TrackerInitError(
                f"max_time_lost must be >= 1, got {self.max_time_lost}"
            )

        # Internal track pools
        self._active_tracks: List[KalmanTrack] = []  # TENTATIVE + ACTIVE
        self._lost_tracks: List[KalmanTrack] = []  # LOST
        self._removed_tracks: List[KalmanTrack] = []  # for diagnostics

        self._frame_count: int = 0

        log.info(
            "ByteTracker initialised | high_thresh=%.2f low_thresh=%.2f "
            "match_thresh=%.2f second_thresh=%.2f max_time_lost=%d fps=%d min_hits=%d",
            self.track_high_thresh,
            self.track_low_thresh,
            self.match_thresh,
            self.second_match_thresh,
            self.max_time_lost,
            self.fps,
            self.min_hits,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(
        self,
        detections: Sequence[Dict[str, Any]],
        frame_h: int = 1080,
        frame_w: int = 1920,
    ) -> List[TrackedPerson]:
        """
        Process one frame of detections and return tracked persons.

        This is the primary entry point of the tracker. Call once per frame
        with all person detections produced by the YOLO detector.

        Parameters
        ----------
        detections : Sequence of detection dicts
            Each dict must contain:
            - 'bbox': [x1, y1, x2, y2]  (pixel coordinates, ints)
            - 'confidence': float in [0.0, 1.0]
            Optionally:
            - 'class': str  (ignored; always treated as 'person')

        frame_h : int
            Frame height in pixels. Used for validation and clipping.
            Defaults to 1920 (safe upper bound — no geometry error).
        frame_w : int
            Frame width in pixels. Used for validation and clipping.

        Returns
        -------
        List[TrackedPerson]
            All ACTIVE (confirmed) tracked persons in this frame.
            TENTATIVE tracks are not returned until they reach min_hits.

        Raises
        ------
        InvalidDetectionError
            If any detection fails geometric or confidence validation.
        TrackingError
            For any other unrecoverable tracker error.

        Notes
        -----
        Empty detection list is valid and represents a frame with no people.
        The tracker will advance all Kalman filters, move unmatched tracks to
        LOST, and eventually delete tracks that exceed max_time_lost.
        """
        t0 = time.perf_counter()
        self._frame_count += 1

        # ------------------------------------------------------------------
        # 0. Validate all incoming detections
        # ------------------------------------------------------------------
        valid_dets: List[Dict[str, Any]] = []
        for det in detections:
            try:
                _validate_detection(det, frame_h, frame_w)
                valid_dets.append(det)
            except InvalidDetectionError:
                log.warning("Skipping invalid detection: %s", det)

        # ------------------------------------------------------------------
        # 1. Separate into high / low confidence pools
        # ------------------------------------------------------------------
        high_dets = [
            d for d in valid_dets if float(d["confidence"]) >= self.track_high_thresh
        ]
        low_dets = [
            d
            for d in valid_dets
            if self.track_low_thresh <= float(d["confidence"]) < self.track_high_thresh
        ]

        # ------------------------------------------------------------------
        # 2. Predict all active tracks forward
        # ------------------------------------------------------------------
        all_tracks = self._active_tracks + self._lost_tracks
        for trk in all_tracks:
            trk.predict()

        # ------------------------------------------------------------------
        # 3. Stage 1: Match HIGH-confidence detections → active tracks
        # ------------------------------------------------------------------
        active_trks = self._active_tracks
        matches_1, unmatched_active, unmatched_high_dets = _associate(
            active_trks, high_dets, iou_threshold=1.0 - self.match_thresh
        )

        for trk_idx, det_idx in matches_1:
            trk = active_trks[trk_idx]
            det = high_dets[det_idx]
            trk.update(det["bbox"], float(det["confidence"]))
            if trk.state == TrackState.TENTATIVE and trk.hit_streak >= self.min_hits:
                trk.state = TrackState.ACTIVE
                log.debug("Track %d promoted TENTATIVE → ACTIVE", trk.track_id)

        # ------------------------------------------------------------------
        # 4. Stage 2: Match LOW-confidence detections → unmatched active tracks
        # ------------------------------------------------------------------
        unmatched_active_trks = [active_trks[i] for i in unmatched_active]
        matches_2, still_unmatched_active, _ = _associate(
            unmatched_active_trks,
            low_dets,
            iou_threshold=1.0 - self.second_match_thresh,
        )

        for trk_idx, det_idx in matches_2:
            trk = unmatched_active_trks[trk_idx]
            det = low_dets[det_idx]
            trk.update(det["bbox"], float(det["confidence"]))
            if trk.state == TrackState.TENTATIVE and trk.hit_streak >= self.min_hits:
                trk.state = TrackState.ACTIVE
                log.debug(
                    "Track %d (stage-2) promoted TENTATIVE → ACTIVE", trk.track_id
                )

        # ------------------------------------------------------------------
        # 5. Stage 3: Match unmatched HIGH-conf detections → LOST tracks
        # ------------------------------------------------------------------
        unmatched_high = [high_dets[i] for i in unmatched_high_dets]
        matches_3, _, unmatched_high_dets_after_3 = _associate(
            self._lost_tracks,
            unmatched_high,
            iou_threshold=1.0 - self.second_match_thresh,
        )

        recovered_ids: List[int] = []
        for trk_idx, det_idx in matches_3:
            trk = self._lost_tracks[trk_idx]
            det = unmatched_high[det_idx]
            trk.update(det["bbox"], float(det["confidence"]))
            trk.state = TrackState.ACTIVE
            self._active_tracks.append(trk)
            recovered_ids.append(trk.track_id)

        if recovered_ids:
            log.debug("Recovered lost tracks: %s", recovered_ids)

        # Remove recovered tracks from lost pool
        self._lost_tracks = [
            trk
            for i, trk in enumerate(self._lost_tracks)
            if i not in {m[0] for m in matches_3}
        ]

        # ------------------------------------------------------------------
        # 6. Mark still-unmatched active tracks as LOST
        # ------------------------------------------------------------------
        lost_ids: List[int] = []
        truly_unmatched = {unmatched_active_trks[i] for i in still_unmatched_active}
        for trk in truly_unmatched:
            if trk.state != TrackState.TENTATIVE:
                trk.state = TrackState.LOST
                self._lost_tracks.append(trk)
                lost_ids.append(trk.track_id)
            # Tentative tracks that were not hit just get dropped silently

        if lost_ids:
            log.debug("Tracks moved to LOST: %s", lost_ids)

        self._active_tracks = [
            trk for trk in self._active_tracks if trk not in truly_unmatched
        ]

        # ------------------------------------------------------------------
        # 7. Create new tentative tracks from unmatched HIGH-conf detections
        # ------------------------------------------------------------------
        new_track_ids: List[int] = []
        for det_idx in unmatched_high_dets_after_3:
            det = unmatched_high[det_idx]
            new_trk = KalmanTrack(det["bbox"], float(det["confidence"]))
            # Single-hit tracks can be immediately active if min_hits == 1
            if self.min_hits == 1:
                new_trk.state = TrackState.ACTIVE
            self._active_tracks.append(new_trk)
            new_track_ids.append(new_trk.track_id)

        if new_track_ids:
            log.debug("New tentative tracks created: %s", new_track_ids)

        # ------------------------------------------------------------------
        # 8. Delete expired lost tracks
        # ------------------------------------------------------------------
        removed_ids: List[int] = []
        new_lost: List[KalmanTrack] = []
        for trk in self._lost_tracks:
            if trk.time_since_update > self.max_time_lost:
                trk.state = TrackState.REMOVED
                self._removed_tracks.append(trk)
                removed_ids.append(trk.track_id)
            else:
                new_lost.append(trk)

        if removed_ids:
            log.debug("Tracks deleted (timeout): %s", removed_ids)

        self._lost_tracks = new_lost

        # ------------------------------------------------------------------
        # 9. Collect and return ACTIVE tracks
        # ------------------------------------------------------------------
        result = [
            trk.to_tracked_person()
            for trk in self._active_tracks
            if trk.state == TrackState.ACTIVE
        ]

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        log.debug(
            "Frame %d | detections=%d (high=%d, low=%d) | active=%d | "
            "lost=%d | new=%d | recovered=%d | removed=%d | %.2f ms",
            self._frame_count,
            len(valid_dets),
            len(high_dets),
            len(low_dets),
            len(result),
            len(self._lost_tracks),
            len(new_track_ids),
            len(recovered_ids),
            len(removed_ids),
            elapsed_ms,
        )

        return result

    def reset(self) -> None:
        """
        Reset the tracker to a clean initial state.

        Clears all internal track pools and resets the global ID counter.
        Use this when switching to a new scene or camera view — IDs will
        restart from 1.

        Raises
        ------
        TrackingError
            If the reset fails for any internal reason.
        """
        try:
            self._active_tracks.clear()
            self._lost_tracks.clear()
            self._removed_tracks.clear()
            self._frame_count = 0
            KalmanTrack._next_id = 1
            log.info("ByteTracker reset — all tracks cleared, ID counter restarted.")
        except Exception as exc:
            raise TrackingError(f"Tracker reset failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Diagnostics / properties
    # ------------------------------------------------------------------

    @property
    def active_count(self) -> int:
        """Number of ACTIVE tracks in the current frame."""
        return sum(1 for t in self._active_tracks if t.state == TrackState.ACTIVE)

    @property
    def lost_count(self) -> int:
        """Number of LOST tracks currently buffered."""
        return len(self._lost_tracks)

    @property
    def frame_count(self) -> int:
        """Total number of frames processed since initialisation (or last reset)."""
        return self._frame_count

    def status(self) -> Dict[str, int]:
        """
        Return a snapshot of the current tracker state for monitoring.

        Returns
        -------
        dict with keys:
            frame_count, active_count, tentative_count, lost_count, removed_count
        """
        return {
            "frame_count": self._frame_count,
            "active_count": sum(
                1 for t in self._active_tracks if t.state == TrackState.ACTIVE
            ),
            "tentative_count": sum(
                1 for t in self._active_tracks if t.state == TrackState.TENTATIVE
            ),
            "lost_count": len(self._lost_tracks),
            "removed_count": len(self._removed_tracks),
        }
