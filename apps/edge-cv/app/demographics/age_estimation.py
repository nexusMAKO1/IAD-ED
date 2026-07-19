"""
age_estimation.py — Age Estimation Module
IAD & SmartQueue AI — Express Display SmartVision (T-010)

Provides a production-ready age estimation module that takes an OpenCV frame
and person detections, extracts facial regions, runs batch inference using
ONNX Runtime (or a robust mock/heuristic fallback if no model is loaded),
and maps the predicted ages to configurable age groups.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

# Set up logging
log = logging.getLogger("iad.demographics.age")

# Safe import of ONNX Runtime
try:
    import onnxruntime as ort  # type: ignore[import-untyped]

    HAS_ONNXRUNTIME = True
except ImportError:
    HAS_ONNXRUNTIME = False
    log.warning(
        "onnxruntime is not installed. AgeEstimator will run in mock/heuristic fallback mode."
    )


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------


class AgeEstimationError(Exception):
    """Base exception for all age estimation errors."""

    pass


class InvalidInputError(AgeEstimationError):
    """Raised when input frame, detections, or bounding boxes are invalid."""

    pass


class ModelNotLoadedError(AgeEstimationError):
    """Raised when inference is attempted but no model is loaded and fallback is disabled."""

    pass


class InferenceError(AgeEstimationError):
    """Raised when ONNX Runtime inference fails."""

    pass


# ---------------------------------------------------------------------------
# Age Estimator Class
# ---------------------------------------------------------------------------


class AgeEstimator:
    """
    Age Estimator that extracts faces from person bboxes and predicts their age.

    Supports ONNX model inference and falls back to a deterministic heuristic
    prediction if no model path is specified or ONNX Runtime is unavailable.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "cpu",
        batch_size: int = 4,
        input_size: Tuple[int, int] = (224, 224),
        age_groups: Optional[Dict[str, Tuple[int, int]]] = None,
    ) -> None:
        """
        Initialize the Age Estimator.

        Parameters
        ----------
        model_path : str, optional
            Path to the ONNX model file. If None, reads from env var AGE_MODEL_PATH.
        device : str
            Execution device: 'cpu', 'cuda', 'gpu'. Reads from env var AGE_DEVICE if set.
        batch_size : int
            Max batch size for ONNX inference. Reads from env var AGE_BATCH_SIZE if set.
        input_size : Tuple[int, int]
            Required input size (width, height) for the ONNX model.
        age_groups : Dict[str, Tuple[int, int]], optional
            Configurable age group limits. If None, uses default groups.
        """
        # Load settings from environment variables with parameter fallbacks
        self.model_path = model_path or os.getenv("AGE_MODEL_PATH")
        self.device = os.getenv("AGE_DEVICE", device).lower()

        try:
            self.batch_size = int(os.getenv("AGE_BATCH_SIZE", str(batch_size)))
        except ValueError:
            self.batch_size = batch_size

        self.input_size = input_size

        # Default age groups (Limits are inclusive).
        # Buckets follow the Express Display SmartVision spec:
        #   0-12   -> child
        #   13-17  -> teen
        #   18-25  -> young_adult
        #   26-40  -> adult
        #   41-60  -> middle_aged
        #   61+    -> senior
        self.age_groups = age_groups or {
            "child":       (0,   12),
            "teen":        (13,  17),
            "young_adult": (18,  25),
            "adult":       (26,  40),
            "middle_aged": (41,  60),
            "senior":      (61, 150),
        }

        # Human-readable display labels for each internal group key.
        # Used by the visualisation layer — never exposes raw ages.
        self._display_labels: Dict[str, str] = {
            "child":       "Child",
            "teen":        "Teen",
            "young_adult": "Young Adult",
            "adult":       "Adult",
            "middle_aged": "Middle-aged",
            "senior":      "Senior",
            "unknown":     "Unknown",
        }

        self.session: Optional[Any] = None
        self.input_name: Optional[str] = None

        # Load the model if path is provided
        if self.model_path:
            self.load_model(self.model_path)

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
        if not model_path:
            raise InvalidInputError("Model path cannot be empty.")

        log.info("Loading Age Estimation ONNX model from: %s", model_path)

        if not HAS_ONNXRUNTIME:
            log.warning("ONNX Runtime is not available. Model cannot be loaded.")
            self.session = None
            return

        if not os.path.exists(model_path):
            log.error("ONNX model file not found at: %s", model_path)
            raise FileNotFoundError(f"ONNX model file not found: {model_path}")

        try:
            # Set providers based on device setting
            providers = ["CPUExecutionProvider"]
            if self.device in ("cuda", "gpu"):
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]

            self.session = ort.InferenceSession(model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            log.info("Age Estimation model loaded successfully on %s.", self.device)
        except Exception as exc:
            log.error("Failed to load ONNX model: %s", exc)
            self.session = None
            raise AgeEstimationError(f"Failed to load ONNX model: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Core Pipeline
    # ------------------------------------------------------------------ #

    def extract_face_roi(
        self, frame: cv2.typing.MatLike, bbox: List[int]
    ) -> cv2.typing.MatLike:
        """
        Safely extract the facial region of interest (ROI) from a person bounding box.

        Since a person detector returns the whole body, the face is typically
        located in the upper portion of the bounding box. This helper crops
        the upper 30% of the bounding box, while ensuring bounds checks.

        Parameters
        ----------
        frame : np.ndarray
            Original OpenCV BGR image.
        bbox : List[int]
            Bounding box coordinates [x1, y1, x2, y2].

        Returns
        -------
        np.ndarray
            Cropped facial ROI image.
        """
        if frame is None or frame.size == 0:
            raise InvalidInputError("Frame is empty or invalid.")

        h, w = frame.shape[:2]

        if len(bbox) != 4:
            raise InvalidInputError(
                f"Bounding box must contain exactly 4 coordinates, got {bbox}"
            )

        x1, y1, x2, y2 = bbox

        # Coordinates sanity checks
        if x1 >= x2 or y1 >= y2:
            raise InvalidInputError(f"Invalid bounding box coordinate ordering: {bbox}")

        # Clip values to frame boundaries
        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(0, min(x2, w))
        y2 = max(0, min(y2, h))

        box_width = x2 - x1
        box_height = y2 - y1

        # Fallback if box is too small
        if box_width <= 0 or box_height <= 0:
            raise InvalidInputError(f"Bounding box size is zero or negative: {bbox}")

        # Estimate face region: top 35% of the person's body height
        # and centered horizontally (width reduced slightly to focus on face)
        face_y1 = y1
        face_y2 = min(y2, int(y1 + 0.35 * box_height))

        # Center horizontally: keep middle 80% of width
        x_padding = int(0.10 * box_width)
        face_x1 = max(x1, x1 + x_padding)
        face_x2 = min(x2, x2 - x_padding)

        # Fallback to full bbox if face crop becomes invalid
        if (face_x2 - face_x1) <= 0 or (face_y2 - face_y1) <= 0:
            face_x1, face_y1, face_x2, face_y2 = x1, y1, x2, y2

        # Perform OpenCV crop
        crop = frame[face_y1:face_y2, face_x1:face_x2]
        return crop

    def preprocess(self, face_img: cv2.typing.MatLike) -> np.ndarray:
        """
        Resize and normalize face ROI for model input.

        Parameters
        ----------
        face_img : np.ndarray
            BGR image crop.

        Returns
        -------
        np.ndarray
            Preprocessed image tensor with shape (1, 3, H, W) and type float32.
        """
        # Resize to model input size
        resized = cv2.resize(face_img, self.input_size, interpolation=cv2.INTER_LINEAR)

        # Convert BGR to RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

        # Normalization: scale to [0, 1]
        normalized = rgb.astype(np.float32) / 255.0

        # Channel transposition: HWC to CHW
        transposed = np.transpose(normalized, (2, 0, 1))

        # Add batch dimension: (1, 3, H, W)
        return np.expand_dims(transposed, axis=0)

    def predict_batch(
        self, faces: List[cv2.typing.MatLike]
    ) -> List[Tuple[float, float]]:
        """
        Predict age for a batch of pre-cropped face images.

        Parameters
        ----------
        faces : List[np.ndarray]
            List of face crop images.

        Returns
        -------
        List[Tuple[float, float]]
            List of (predicted_age, confidence) tuples.
        """
        if not faces:
            return []

        # If session is loaded, run actual ONNX inference
        if self.session is not None and self.input_name is not None:
            t0 = time.perf_counter()
            results: List[Tuple[float, float]] = []

            try:
                # Process in batches
                for i in range(0, len(faces), self.batch_size):
                    batch_faces = faces[i : i + self.batch_size]
                    tensors = [self.preprocess(face) for face in batch_faces]

                    # Concat into a single batch tensor: (N, 3, H, W)
                    batch_tensor = np.concatenate(tensors, axis=0)

                    # Run ONNX inference session
                    outputs = self.session.run(None, {self.input_name: batch_tensor})

                    # Assume model returns a tensor of predictions
                    # e.g., shape (N, 1) representing age or (N, num_classes) logits
                    predictions = outputs[0]

                    for pred in predictions:
                        if len(pred.shape) == 0 or pred.shape[0] == 1:
                            # Regression output
                            age = float(pred[0] if len(pred.shape) > 0 else pred)
                            conf = 0.95  # Confidence rating for regression
                        else:
                            # Classification output: logits over age bins or classes
                            # Softmax classification
                            exp_logits = np.exp(pred - np.max(pred))
                            probs = exp_logits / np.sum(exp_logits)
                            age = float(
                                np.argmax(probs)
                            )  # or expected value sum(probs * bin_values)
                            conf = float(np.max(probs))

                        results.append((age, conf))

                latency = (time.perf_counter() - t0) * 1000.0
                log.info(
                    "Batch inference completed: %d faces processed in %.2f ms",
                    len(faces),
                    latency,
                )
                return results

            except Exception as exc:
                log.error("ONNX inference failed: %s", exc)
                raise InferenceError(f"ONNX inference failed: {exc}") from exc

        # Fallback: Heuristic deterministic prediction based on image crop properties
        results = []
        for face in faces:
            # Deterministic hash of crop to produce consistent mock values for unit testing
            avg_color = float(np.mean(face))

            # Predict age deterministically in [5, 80] range using average color value
            mock_age = 5 + int(avg_color % 76)
            mock_conf = 0.6 + (avg_color % 40) / 100.0
            results.append((float(mock_age), float(mock_conf)))

        return results

    def get_age_group(self, age: float) -> str:
        """
        Map a numerical age to a configured age group key.

        Parameters
        ----------
        age : float
            Numerical age.

        Returns
        -------
        str
            Internal age group key (e.g. 'adult', 'young_adult', 'unknown').
        """
        rounded_age = int(round(age))
        for group, (low, high) in self.age_groups.items():
            if low <= rounded_age <= high:
                return group
        return "unknown"

    def age_group_label(self, age: float) -> str:
        """
        Return a human-readable, privacy-friendly age group label.

        This is the value that should be displayed in the UI — it never
        exposes the exact numerical age.

        Parameters
        ----------
        age : float
            Numerical age as returned by the estimator.

        Returns
        -------
        str
            Display label, e.g. ``'Young Adult'``, ``'Senior'``, ``'Unknown'``.
        """
        key = self.get_age_group(age)
        return self._display_labels.get(key, "Unknown")

    def estimate(
        self,
        frame: cv2.typing.MatLike,
        detections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Perform age estimation on all detected persons in the frame.

        Parameters
        ----------
        frame : np.ndarray
            Original OpenCV BGR image.
        detections : List[Dict[str, Any]]
            Detections list, where each detection has "bbox" and "confidence".

        Returns
        -------
        List[Dict[str, Any]]
            List of dictionaries containing bbox, age, age_group, and estimation confidence.
        """
        if frame is None or frame.size == 0:
            raise InvalidInputError("Input frame is empty or invalid.")

        if not isinstance(detections, list):
            raise InvalidInputError("Detections must be a list of dictionaries.")

        if not detections:
            return []

        face_crops = []
        valid_indices = []

        # Extract faces from bounding boxes
        for idx, det in enumerate(detections):
            if not isinstance(det, dict) or "bbox" not in det:
                raise InvalidInputError(
                    f"Detection at index {idx} is missing 'bbox' key."
                )

            bbox = det["bbox"]
            crop = self.extract_face_roi(frame, bbox)
            face_crops.append(crop)
            valid_indices.append(idx)

        if not face_crops:
            return []

        # Run batch prediction
        predictions = self.predict_batch(face_crops)

        # Assemble results
        results = []
        for i, idx in enumerate(valid_indices):
            age, confidence = predictions[i]
            age_group = self.get_age_group(age)
            orig_det = detections[idx]

            results.append(
                {
                    "bbox": orig_det["bbox"],
                    "age": int(round(age)),
                    "age_group": age_group,
                    "confidence": round(confidence, 4),
                }
            )

        return results
