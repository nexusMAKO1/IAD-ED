"""
detector.py — YOLOv8n Person Detection Wrapper
IAD & SmartQueue AI — Edge CV Service

Wraps Ultralytics YOLOv8 to provide a clean, typed detection API.
Only the "person" class (COCO class index 0) is returned.
"""

from __future__ import annotations

from typing import List


import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import cv2

# Ultralytics import — downloaded on first run if model not present
from ultralytics import YOLO


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class Detection:
    """Single person detection result."""

    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float
    class_id: int = 0
    label: str = "person"


@dataclass
class DetectionResult:
    """Batch result for a single inference run."""

    detections: List[Detection]
    inference_ms: float
    person_count: int = field(init=False)

    def __post_init__(self) -> None:
        self.person_count = len(self.detections)


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

PERSON_CLASS_ID = 0  # COCO class index for "person"


class PersonDetector:
    """
    YOLOv8n person-only detector.

    Args:
        model_path: Path to a .pt or .onnx model file.
                    Defaults to "yolov8n.pt" which Ultralytics auto-downloads.
        confidence: Minimum confidence threshold (0.0–1.0).
        device:     Inference device: "cpu", "cuda", "mps", or empty string
                    for auto-detection.
        half:       Use FP16 half-precision (GPU only, reduces latency).
    """

    def __init__(
        self,
        model_path: str | Path = "yolov8n.pt",
        confidence: float = 0.40,
        device: str = "",
        half: bool = False,
    ) -> None:
        if not (0.0 < confidence <= 1.0):
            raise ValueError(f"confidence must be in (0.0, 1.0], got {confidence}")

        self.confidence = confidence
        self.half = half

        # Determine device
        if device:
            self.device = device
        else:
            import torch

            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"

        # Load model
        self.model = YOLO(str(model_path))
        self.model.to(self.device)

        # Warm-up pass to pre-allocate GPU buffers / JIT traces
        self._warmup()

    # ------------------------------------------------------------------
    # Warm-up
    # ------------------------------------------------------------------

    def _warmup(self) -> None:
        """Run one dummy inference to warm up model and CUDA kernels."""
        dummy = np.zeros((480, 640, 3), dtype=np.uint8)
        self.model.predict(
            source=dummy,
            classes=[PERSON_CLASS_ID],
            conf=self.confidence,
            half=self.half and self.device != "cpu",
            verbose=False,
        )

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def detect(self, frame: cv2.typing.MatLike) -> DetectionResult:
        """
        Run YOLOv8n inference on a single BGR frame.

        Args:
            frame: OpenCV BGR image (HxWx3, uint8).

        Returns:
            DetectionResult with all person detections and timing info.
        """
        t0 = time.perf_counter()

        results = self.model.predict(
            source=frame,
            classes=[PERSON_CLASS_ID],
            conf=self.confidence,
            half=self.half and self.device != "cpu",
            verbose=False,
            stream=False,
        )

        inference_ms = (time.perf_counter() - t0) * 1000.0

        detections: List[Detection] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                conf = float(box.conf[0].cpu().numpy())
                detections.append(
                    Detection(
                        x1=int(x1),
                        y1=int(y1),
                        x2=int(x2),
                        y2=int(y2),
                        confidence=conf,
                    )
                )

        return DetectionResult(detections=detections, inference_ms=inference_ms)

    # ------------------------------------------------------------------
    # ONNX export (bonus)
    # ------------------------------------------------------------------

    def export_onnx(self, output_path: str = "yolov8n_person.onnx") -> Path:
        """
        Export the loaded model to ONNX format for edge deployment.
        Only exports person class. The resulting model must be further
        filtered to class 0 in post-processing.
        """
        exported = self.model.export(format="onnx", dynamic=True, simplify=True)
        return Path(str(exported))
