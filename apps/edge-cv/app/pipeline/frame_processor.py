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
                {"bbox": p.bbox, "confidence": p.confidence} for p in tracked_people
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
                if i < len(age_results):
                    det_info["age"] = age_results[i].get("age")
                    det_info["age_group"] = age_results[i].get("age_group")
                    det_info["age_confidence"] = age_results[i].get("confidence")

                if i < len(gender_results):
                    det_info["gender"] = gender_results[i].get("gender")
                    det_info["gender_confidence"] = gender_results[i].get("gender_confidence")

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
