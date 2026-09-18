"""
gender_estimation.py — Gender Estimation Module
IAD & SmartQueue AI — Express Display SmartVision (T-011)

Provides a production-ready gender classification module that takes an OpenCV frame
and person detections, extracts facial regions, runs batch inference using
the ONNX Runtime (GoogleNet gender model), and outputs male, female, or unknown.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

# Set up logging
log = logging.getLogger("iad.demographics.gender")

# Safe import of ONNX Runtime
try:
    import onnxruntime as ort  # type: ignore[import-untyped]

    HAS_ONNXRUNTIME = True
except ImportError:
    HAS_ONNXRUNTIME = False
    log.warning(
        "onnxruntime is not installed. GenderEstimator will run in fallback (unknown) mode."
    )


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------


class GenderEstimationError(Exception):
    """Base exception for all gender estimation errors."""
    pass


class InvalidInputError(GenderEstimationError):
    """Raised when input frame, detections, or bounding boxes are invalid."""
    pass


class InferenceError(GenderEstimationError):
    """Raised when ONNX Runtime inference fails."""
    pass


# ---------------------------------------------------------------------------
# Gender Estimator Class
# ---------------------------------------------------------------------------


class GenderEstimator:
    """
    Gender Estimator that extracts faces from person bboxes and predicts their gender.

    Supports ONNX model inference and falls back gracefully to "unknown" if the
    model is unavailable, the face crop is invalid, or the confidence is below
    the configured threshold.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "cpu",
        batch_size: int = 4,
        input_size: Tuple[int, int] = (224, 224),
        confidence_threshold: float = 0.70,
    ) -> None:
        """
        Initialize the Gender Estimator.

        Parameters
        ----------
        model_path : str, optional
            Path to the ONNX model file. If None, reads from env var GENDER_MODEL_PATH.
        device : str
            Execution device: 'cpu', 'cuda', 'gpu'.
        batch_size : int
            Max batch size for ONNX inference.
        input_size : Tuple[int, int]
            Required input size (width, height) for the ONNX model.
        confidence_threshold : float
            Minimum confidence required to return male/female instead of unknown.
        """
        self.model_path = model_path or os.getenv("GENDER_MODEL_PATH", "models/gender_googlenet.onnx")
        self.device = os.getenv("AGE_DEVICE", device).lower()  # Reuse existing device setting pattern
        self.batch_size = batch_size
        self.input_size = input_size
        
        try:
            self.confidence_threshold = float(os.getenv("GENDER_CONFIDENCE_THRESHOLD", str(confidence_threshold)))
        except ValueError:
            self.confidence_threshold = confidence_threshold

        self.session: Optional[Any] = None
        self.input_name: Optional[str] = None

        # GoogleNet Gender Model specific mapping (0: Male, 1: Female)
        self.class_labels = ["male", "female"]

        # Load the model if it exists
        if self.model_path and os.path.exists(self.model_path) and HAS_ONNXRUNTIME:
            self.load_model(self.model_path)
        else:
            log.warning("Gender model not found or ONNX missing at %s. Returning unknown.", self.model_path)

    # ------------------------------------------------------------------ #
    # Model Lifecycle
    # ------------------------------------------------------------------ #

    def load_model(self, model_path: str) -> None:
        """
        Load the ONNX model into memory.

        Parameters
        ----------
        model_path : str
            Path to the ONNX model file.
        """
        log.info("Loading Gender Classification ONNX model from: %s", model_path)

        try:
            providers = ["CPUExecutionProvider"]
            if self.device in ("cuda", "gpu"):
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

            self.session = ort.InferenceSession(model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            log.info("Gender Classification model loaded successfully on %s.", self.device)
        except Exception as exc:
            log.error("Failed to load Gender ONNX model: %s", exc)
            self.session = None

    # ------------------------------------------------------------------ #
    # Core Pipeline
    # ------------------------------------------------------------------ #

    def extract_face_roi(
        self, frame: cv2.typing.MatLike, bbox: List[int]
    ) -> cv2.typing.MatLike:
        """
        Safely extract the facial region of interest (ROI) from a person bounding box.
        
        Uses the same 35% height / centered approach as the AgeEstimator.
        """
        if frame is None or frame.size == 0:
            raise InvalidInputError("Frame is empty or invalid.")

        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox

        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(0, min(x2, w))
        y2 = max(0, min(y2, h))

        box_width = x2 - x1
        box_height = y2 - y1

        if box_width <= 0 or box_height <= 0:
            raise InvalidInputError(f"Bounding box size is zero or negative: {bbox}")

        face_y1 = y1
        face_y2 = min(y2, int(y1 + 0.35 * box_height))
        x_padding = int(0.10 * box_width)
        face_x1 = max(x1, x1 + x_padding)
        face_x2 = min(x2, x2 - x_padding)

        if (face_x2 - face_x1) <= 0 or (face_y2 - face_y1) <= 0:
            face_x1, face_y1, face_x2, face_y2 = x1, y1, x2, y2

        crop = frame[face_y1:face_y2, face_x1:face_x2]
        return crop

    def preprocess(self, face_img: cv2.typing.MatLike) -> np.ndarray:
        """
        Resize and normalize face ROI for model input.
        Returns tensor of shape (1, 3, 224, 224)
        """
        resized = cv2.resize(face_img, self.input_size, interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        # Normalize to [0, 1]
        normalized = rgb.astype(np.float32) / 255.0
        # HWC to CHW
        transposed = np.transpose(normalized, (2, 0, 1))
        return np.expand_dims(transposed, axis=0)

    def softmax(self, logits: np.ndarray) -> np.ndarray:
        """Compute softmax values for each set of scores in logits."""
        e_x = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        return e_x / e_x.sum(axis=-1, keepdims=True)

    def predict_batch(
        self, faces: List[cv2.typing.MatLike]
    ) -> List[Tuple[str, float]]:
        """
        Predict gender for a batch of pre-cropped face images.
        Returns a list of (gender_class, confidence).
        """
        if not faces:
            return []

        # If session is unavailable, return unknown safely
        if self.session is None or self.input_name is None:
            return [("unknown", 0.0) for _ in faces]

        t0 = time.perf_counter()
        results: List[Tuple[str, float]] = []

        try:
            for i in range(0, len(faces), self.batch_size):
                batch_faces = faces[i : i + self.batch_size]
                tensors = [self.preprocess(face) for face in batch_faces]
                batch_tensor = np.concatenate(tensors, axis=0)

                outputs = self.session.run(None, {self.input_name: batch_tensor})
                logits = outputs[0]  # shape (N, 2)
                
                probs = self.softmax(logits)

                for prob in probs:
                    class_idx = int(np.argmax(prob))
                    confidence = float(prob[class_idx])
                    
                    if confidence >= self.confidence_threshold:
                        pred_class = self.class_labels[class_idx]
                    else:
                        pred_class = "unknown"
                        
                    results.append((pred_class, confidence))

            latency = (time.perf_counter() - t0) * 1000.0
            log.debug("Gender batch inference: %d faces in %.2f ms", len(faces), latency)
            return results

        except Exception as exc:
            log.error("Gender ONNX inference failed: %s", exc)
            # Fallback on failure
            return [("unknown", 0.0) for _ in faces]

    def estimate(
        self,
        frame: cv2.typing.MatLike,
        detections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Perform gender classification on all detected persons in the frame.
        """
        if not detections:
            return []

        if frame is None or frame.size == 0:
            log.error("GenderEstimator: Input frame is empty.")
            return []

        face_crops = []
        valid_indices = []

        for idx, det in enumerate(detections):
            if not isinstance(det, dict) or "bbox" not in det:
                log.warning("GenderEstimator: Invalid detection at index %d", idx)
                continue

            try:
                crop = self.extract_face_roi(frame, det["bbox"])
                face_crops.append(crop)
                valid_indices.append(idx)
            except InvalidInputError:
                # If extraction fails (e.g. invalid bounds), we skip this face
                # The prediction pipeline won't process it, leaving it unmerged
                continue

        if not face_crops:
            return []

        predictions = self.predict_batch(face_crops)

        results = []
        for i, idx in enumerate(valid_indices):
            gender_class, confidence = predictions[i]
            results.append(
                {
                    "bbox": detections[idx]["bbox"],
                    "gender": gender_class,
                    "gender_confidence": round(confidence, 4),
                }
            )

        return results
