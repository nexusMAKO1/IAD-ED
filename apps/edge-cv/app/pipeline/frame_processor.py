"""
frame_processor.py — Modular Edge-CV frame processing pipeline.
IAD & SmartQueue AI — Express Display SmartVision

Encapsulates:
  Detection (YOLO) -> Tracking (ByteTrack) -> Demographics (Age & Gender) -> Analytics Formatting
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from app.detector import DetectionResult, PersonDetector
from app.tracking.bytetrack import ByteTracker, TrackedPerson
from app.demographics.age_estimation import AgeEstimator
from app.demographics.gender_estimation import GenderEstimator

log = logging.getLogger("iad.edge-cv.pipeline")


@dataclass
class ProcessedFrameResult:
    """Structured output of a processed video frame."""
    person_count: int
    inference_ms: float
    processing_ms: float
    detections: List[Dict[str, Any]] = field(default_factory=list)
    tracked_people: List[TrackedPerson] = field(default_factory=list)
    density: str = "low"


class FrameProcessor:
    """
    Coordinates detection, tracking, and demographic estimation for video frames.
    """

    def __init__(
        self,
        detector: PersonDetector,
        tracker: Optional[ByteTracker] = None,
        age_estimator: Optional[AgeEstimator] = None,
        gender_estimator: Optional[GenderEstimator] = None,
    ) -> None:
        self.detector = detector
        self.tracker = tracker if tracker is not None else ByteTracker()
        self.age_estimator = age_estimator if age_estimator is not None else AgeEstimator()
        self.gender_estimator = gender_estimator

    def process_frame(self, frame: np.ndarray) -> ProcessedFrameResult:
        """
        Execute full CV pipeline on a BGR frame:
          1. YOLO person detection
          2. Multi-object tracking (ByteTrack)
          3. Age estimation per tracked subject
          4. Gender estimation per tracked subject
          5. Crowd density categorization
        """
        t_start = time.perf_counter()

        # 1. Detection
        result: DetectionResult = self.detector.detect(frame)
        inference_ms = result.inference_ms

        # 2. Tracking
        tracked_people: List[TrackedPerson] = []
        if self.tracker is not None:
            raw_input = [
                {"bbox": [d.x1, d.y1, d.x2, d.y2], "confidence": d.confidence}
                for d in result.detections
            ]
            h, w = frame.shape[:2]
            try:
                tracked_people = self.tracker.update(raw_input, frame_h=h, frame_w=w)
            except Exception as exc:
                log.warning("Tracking update failed: %s", exc)
                tracked_people = []

        person_count = len(tracked_people)

        # 3. Demographics
        detections_list: List[Dict[str, Any]] = []
        if tracked_people:
            raw_detections = [
                {"track_id": p.track_id, "bbox": p.bbox, "confidence": p.confidence}
                for p in tracked_people
            ]

            age_results = []
            if self.age_estimator is not None:
                try:
                    age_results = self.age_estimator.estimate(frame, raw_detections)
                except Exception as exc:
                    log.warning("Age estimation failed: %s", exc)

            gender_results = []
            if self.gender_estimator is not None:
                try:
                    gender_results = self.gender_estimator.estimate(frame, raw_detections)
                except Exception as exc:
                    log.warning("Gender estimation failed: %s", exc)

            # Build explicit lookup tables by track_id and by normalized bbox
            age_by_track: Dict[Any, Dict[str, Any]] = {}
            age_by_bbox: Dict[str, Dict[str, Any]] = {}
            for r in (age_results or []):
                if isinstance(r, dict):
                    if "track_id" in r and r["track_id"] is not None:
                        age_by_track[r["track_id"]] = r
                    if "bbox" in r and isinstance(r["bbox"], (list, tuple)):
                        key = ",".join(str(round(float(c), 1)) for c in r["bbox"])
                        age_by_bbox[key] = r

            gender_by_track: Dict[Any, Dict[str, Any]] = {}
            gender_by_bbox: Dict[str, Dict[str, Any]] = {}
            for r in (gender_results or []):
                if isinstance(r, dict):
                    if "track_id" in r and r["track_id"] is not None:
                        gender_by_track[r["track_id"]] = r
                    if "bbox" in r and isinstance(r["bbox"], (list, tuple)):
                        key = ",".join(str(round(float(c), 1)) for c in r["bbox"])
                        gender_by_bbox[key] = r

            has_explicit_age = bool(age_by_track or age_by_bbox)
            has_explicit_gender = bool(gender_by_track or gender_by_bbox)

            for i, p in enumerate(tracked_people):
                det_info: Dict[str, Any] = {
                    "track_id": p.track_id,
                    "x1": p.bbox[0],
                    "y1": p.bbox[1],
                    "x2": p.bbox[2],
                    "y2": p.bbox[3],
                    "confidence": round(p.confidence, 4),
                    "class_id": 0,
                    "label": p.class_name,
                }

                bbox_key = ",".join(str(round(float(c), 1)) for c in p.bbox)

                # Match age by track_id first, then bbox; fallback to 1:1 positional only if mock omitted keys
                age_data = age_by_track.get(p.track_id) or age_by_bbox.get(bbox_key)
                if not age_data and not has_explicit_age and i < len(age_results):
                    age_data = age_results[i]

                if age_data:
                    det_info["age"] = age_data.get("age")
                    det_info["age_group"] = age_data.get("age_group")
                    det_info["age_confidence"] = age_data.get("confidence")

                # Match gender by track_id first, then bbox; fallback to 1:1 positional only if mock omitted keys
                gender_data = gender_by_track.get(p.track_id) or gender_by_bbox.get(bbox_key)
                if not gender_data and not has_explicit_gender and i < len(gender_results):
                    gender_data = gender_results[i]

                if gender_data:
                    det_info["gender"] = gender_data.get("gender")
                    det_info["gender_confidence"] = gender_data.get("gender_confidence")

                detections_list.append(det_info)

        # 4. Crowd density categorization
        if person_count >= 20:
            density = "critical"
        elif person_count >= 10:
            density = "high"
        elif person_count >= 5:
            density = "medium"
        else:
            density = "low"

        processing_ms = (time.perf_counter() - t_start) * 1000.0

        return ProcessedFrameResult(
            person_count=person_count,
            inference_ms=inference_ms,
            processing_ms=processing_ms,
            detections=detections_list,
            tracked_people=tracked_people,
            density=density,
        )
