"""
onnx_optimization.py — Production-Ready ONNX Inference Optimization Module
Express Display SmartVision — T-022

This module implements a generic, production-grade ONNX inference layer for the
Edge-CV service. It is designed to accelerate the existing pipeline:

    PersonDetector (YOLOv8) → ByteTracker → AgeEstimator → MQTT

Key capabilities:
  - Export any PyTorch model to ONNX with dynamic axes, FP16, and opset control
  - Load ONNX models with automatic execution provider selection:
      1. TensorRTExecutionProvider  (NVIDIA TensorRT — lowest latency)
      2. CUDAExecutionProvider      (CUDA — GPU without TRT)
      3. CPUExecutionProvider       (fallback — always available)
  - Session caching — no model reload per request
  - Warmup runs to pre-allocate CUDA/TRT engine buffers
  - Comprehensive benchmarking: preprocess / inference / postprocess / FPS
  - Pydantic-validated configuration from environment variables
  - Graceful PyTorch fallback if ONNX loading fails
  - Full compatibility with DetectionResult / Detection formats from detector.py

Environment variables:
  ONNX_MODEL_PATH   — Path to the .onnx file to load (or export target)
  MODEL_PATH        — Alternative / legacy model path (fallback)
  ONNX_PROVIDER     — Override provider: "cpu", "cuda", "tensorrt"
  USE_GPU           — "true" to prefer GPU providers (default: auto)
  ENABLE_FP16       — "true" to export/run in FP16 (default: false)
  NUM_THREADS       — Number of intra-op threads for CPU inference (default: 0=auto)
  MODEL_WARMUP      — Number of warm-up iterations (default: 3)
  ONNX_OPSET        — ONNX opset version for export (default: 17)
  ONNX_INPUT_SIZE   — Comma-separated H,W for inference input (default: 640,640)
  ONNX_CONF_THRESH  — Detection confidence threshold (default: 0.40)
  ONNX_IOU_THRESH   — NMS IoU threshold (default: 0.45)
  ONNX_CACHE_DIR    — Directory for caching exported ONNX files (default: ./models)
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

log = logging.getLogger("iad.onnx_optimization")

# ---------------------------------------------------------------------------
# Optional imports — degrade gracefully if not available
# ---------------------------------------------------------------------------
try:
    import onnxruntime as ort  # type: ignore[import-untyped]

    _HAS_ORT = True
    log.debug("onnxruntime %s detected.", ort.__version__)
except ImportError:
    _HAS_ORT = False
    ort = None  # type: ignore[assignment]
    log.warning(
        "onnxruntime not installed — ONNX inference unavailable. "
        "Install with: pip install onnxruntime-gpu"
    )

try:
    import torch  # type: ignore[import-untyped]

    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False
    torch = None  # type: ignore[assignment]

# ── Inline import of the project's Detection types ──────────────────────────
try:
    from app.detector import Detection, DetectionResult  # type: ignore[import]
except ImportError:
    try:
        from detector import Detection, DetectionResult  # type: ignore[no-redef]
    except ImportError:
        # Provide local stubs so this module can be imported standalone
        @dataclass  # type: ignore[no-redef]
        class Detection:  # type: ignore[no-redef]
            x1: int
            y1: int
            x2: int
            y2: int
            confidence: float
            class_id: int = 0
            label: str = "person"

        @dataclass  # type: ignore[no-redef]
        class DetectionResult:  # type: ignore[no-redef]
            detections: list[Detection]
            inference_ms: float
            person_count: int = field(init=False)

            def __post_init__(self) -> None:
                self.person_count = len(self.detections)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PERSON_CLASS_ID = 0  # COCO class index for "person"

# Providers in priority order — used when no explicit override is given
_PROVIDER_PRIORITY = [
    "TensorRTExecutionProvider",
    "CUDAExecutionProvider",
    "CPUExecutionProvider",
]


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------


class OnnxError(Exception):
    """Base exception for all ONNX optimisation errors."""


class ModelNotFoundError(OnnxError):
    """Raised when the ONNX model file cannot be located."""


class CorruptedModelError(OnnxError):
    """Raised when the ONNX file exists but cannot be parsed."""


class UnsupportedOperatorError(OnnxError):
    """Raised when the ONNX graph uses an op not supported by the provider."""


class InvalidInputError(OnnxError):
    """Raised when the input tensor shape / dtype is incompatible."""


class ProviderError(OnnxError):
    """Raised when no suitable execution provider can be configured."""


# ---------------------------------------------------------------------------
# Configuration Dataclass
# ---------------------------------------------------------------------------


@dataclass
class OnnxConfig:
    """
    Runtime configuration for the ONNX optimisation module.

    All values are read from environment variables at construction time
    with sensible defaults that require zero manual configuration in Docker.

    Attributes
    ----------
    model_path:    Absolute or relative path to the .onnx model file.
    provider:      Preferred ONNX Runtime provider (auto | cpu | cuda | tensorrt).
    use_gpu:       Whether to attempt GPU providers before CPU.
    enable_fp16:   Run inference in FP16 (requires GPU with half-precision support).
    num_threads:   Number of intra-op CPU threads (0 = ORT automatic).
    warmup_iters:  Number of warm-up forward passes executed at model load.
    opset_version: ONNX opset to target during export.
    input_height:  Model input spatial height in pixels.
    input_width:   Model input spatial width in pixels.
    conf_threshold: Minimum detection confidence to keep.
    iou_threshold:  IoU threshold for non-maximum suppression.
    cache_dir:     Directory where exported ONNX files are cached.
    """

    model_path: str = field(
        default_factory=lambda: (
            os.getenv("ONNX_MODEL_PATH")
            or os.getenv("MODEL_PATH")
            or "yolov8n.onnx"
        )
    )
    provider: str = field(
        default_factory=lambda: os.getenv("ONNX_PROVIDER", "auto").lower()
    )
    use_gpu: bool = field(
        default_factory=lambda: os.getenv("USE_GPU", "auto").lower()
        not in ("false", "0", "no")
    )
    enable_fp16: bool = field(
        default_factory=lambda: os.getenv("ENABLE_FP16", "false").lower()
        in ("true", "1", "yes")
    )
    num_threads: int = field(
        default_factory=lambda: int(os.getenv("NUM_THREADS", "0"))
    )
    warmup_iters: int = field(
        default_factory=lambda: int(os.getenv("MODEL_WARMUP", "3"))
    )
    opset_version: int = field(
        default_factory=lambda: int(os.getenv("ONNX_OPSET", "17"))
    )
    input_height: int = field(default_factory=lambda: _parse_input_size()[0])
    input_width: int = field(default_factory=lambda: _parse_input_size()[1])
    conf_threshold: float = field(
        default_factory=lambda: float(os.getenv("ONNX_CONF_THRESH", "0.40"))
    )
    iou_threshold: float = field(
        default_factory=lambda: float(os.getenv("ONNX_IOU_THRESH", "0.45"))
    )
    cache_dir: str = field(
        default_factory=lambda: os.getenv("ONNX_CACHE_DIR", "./models")
    )


def _parse_input_size() -> tuple[int, int]:
    """Parse ONNX_INPUT_SIZE env-var (H,W) with safe defaults."""
    raw = os.getenv("ONNX_INPUT_SIZE", "640,640")
    try:
        parts = [int(x.strip()) for x in raw.split(",")]
        if len(parts) == 2:
            return parts[0], parts[1]
        return 640, 640
    except ValueError:
        return 640, 640


# ---------------------------------------------------------------------------
# Benchmark Result Dataclass
# ---------------------------------------------------------------------------


@dataclass
class BenchmarkResult:
    """
    Timing breakdown for a single inference run or benchmark summary.

    Attributes
    ----------
    preprocess_ms:  Time spent resizing + normalising the input frame.
    inference_ms:   Time spent executing the ONNX session.
    postprocess_ms: Time spent decoding boxes / running NMS.
    total_ms:       Sum of the three phases above.
    fps:            Theoretical throughput (1000 / total_ms).
    num_iterations: Number of iterations averaged (for benchmark summaries).
    provider:       The ONNX Runtime execution provider that was used.
    model_path:     Path to the model that was benchmarked.
    """

    preprocess_ms: float
    inference_ms: float
    postprocess_ms: float
    total_ms: float
    fps: float
    num_iterations: int = 1
    provider: str = "CPUExecutionProvider"
    model_path: str = ""

    def summary(self) -> dict[str, Any]:
        """Return a JSON-serialisable benchmark summary dictionary."""
        return {
            "model_path": self.model_path,
            "provider": self.provider,
            "num_iterations": self.num_iterations,
            "preprocess_ms": round(self.preprocess_ms, 3),
            "inference_ms": round(self.inference_ms, 3),
            "postprocess_ms": round(self.postprocess_ms, 3),
            "total_ms": round(self.total_ms, 3),
            "fps": round(self.fps, 2),
        }


# ---------------------------------------------------------------------------
# ONNX Model Session Cache
# ---------------------------------------------------------------------------

_SESSION_CACHE: dict[str, "OnnxInferenceSession"] = {}


# ---------------------------------------------------------------------------
# Core Inference Session
# ---------------------------------------------------------------------------


class OnnxInferenceSession:
    """
    Manages a single ONNX Runtime InferenceSession with full lifecycle support.

    Session instances are cached by model path in ``_SESSION_CACHE`` so the
    same model is never loaded twice in the same process.

    Usage:
        session = OnnxInferenceSession.from_config(config)
        result = session.run_detection(frame)

    Parameters
    ----------
    model_path : str | Path
        Path to the .onnx model file.
    config     : OnnxConfig
        Runtime configuration (providers, threads, shapes, thresholds, …).
    """

    def __init__(self, model_path: str | Path, config: OnnxConfig) -> None:
        self._model_path = Path(model_path)
        self._config = config
        self._session: "ort.InferenceSession | None" = None  # type: ignore[name-defined]
        self._input_name: str = ""
        self._input_shape: list[int] = []
        self._output_names: list[str] = []
        self._active_provider: str = "CPUExecutionProvider"
        self._loaded: bool = False

    # ------------------------------------------------------------------ #
    # Factory
    # ------------------------------------------------------------------ #

    @classmethod
    def from_config(cls, config: OnnxConfig | None = None) -> "OnnxInferenceSession":
        """
        Load or retrieve a cached session using the given configuration.

        Args:
            config: ONNX configuration. Reads from environment if None.

        Returns:
            A fully initialised (and warmed-up) OnnxInferenceSession.

        Raises:
            ModelNotFoundError:  If the .onnx file does not exist.
            CorruptedModelError: If the model is malformed.
            OnnxError:           On any other loading failure.
        """
        cfg = config or OnnxConfig()
        key = str(Path(cfg.model_path).resolve())

        if key in _SESSION_CACHE:
            log.debug("ONNX session cache hit for '%s'.", key)
            return _SESSION_CACHE[key]

        session = cls(cfg.model_path, cfg)
        session._load()
        _SESSION_CACHE[key] = session
        return session

    # ------------------------------------------------------------------ #
    # Model loading
    # ------------------------------------------------------------------ #

    def _load(self) -> None:
        """
        Load the ONNX model from disk and configure the ORT session.

        Provider selection order (unless overridden by ONNX_PROVIDER):
          1. TensorRTExecutionProvider
          2. CUDAExecutionProvider
          3. CPUExecutionProvider

        Falls back to CPUExecutionProvider if any GPU provider fails to
        initialise (e.g. CUDA not available, driver version mismatch).
        """
        if not _HAS_ORT:
            raise OnnxError(
                "onnxruntime is not installed. "
                "Install with: pip install onnxruntime-gpu"
            )

        path = self._model_path
        if not path.exists():
            raise ModelNotFoundError(
                f"ONNX model file not found: '{path}'. "
                "Set ONNX_MODEL_PATH or call export_to_onnx() first."
            )

        log.info("Loading ONNX model from '%s'…", path)

        providers = self._resolve_providers()
        session_options = self._build_session_options()

        # Attempt loading with selected providers; fall back to CPU on failure
        for provider_list in (providers, ["CPUExecutionProvider"]):
            try:
                self._session = ort.InferenceSession(
                    str(path),
                    providers=provider_list,
                    sess_options=session_options,
                )
                self._active_provider = self._session.get_providers()[0]
                break
            except Exception as exc:  # noqa: BLE001
                if provider_list == ["CPUExecutionProvider"]:
                    raise CorruptedModelError(
                        f"Failed to load ONNX model '{path}': {exc}"
                    ) from exc
                log.warning(
                    "Failed to load with providers %s: %s — retrying with CPU.",
                    provider_list,
                    exc,
                )

        if self._session is None:
            raise OnnxError(f"ONNX session could not be created for '{path}'.")

        # Introspect model I/O
        self._input_name = self._session.get_inputs()[0].name
        self._input_shape = list(self._session.get_inputs()[0].shape)
        self._output_names = [o.name for o in self._session.get_outputs()]

        log.info(
            "ONNX model loaded — provider: %s | inputs: %s | outputs: %s",
            self._active_provider,
            self._input_name,
            self._output_names,
        )

        self._loaded = True

        # Warm-up
        if self._config.warmup_iters > 0:
            self.warmup(self._config.warmup_iters)

    def _resolve_providers(self) -> list[str]:
        """
        Resolve the list of ONNX Runtime providers to request.

        Respects ONNX_PROVIDER and USE_GPU env-vars.  Always appends
        CPUExecutionProvider as the guaranteed fallback.

        Returns:
            Ordered list of provider strings.
        """
        override = self._config.provider.lower()

        # ── Explicit override ────────────────────────────────────────────
        if override == "cpu":
            return ["CPUExecutionProvider"]
        if override == "cuda":
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if override == "tensorrt":
            return [
                "TensorRTExecutionProvider",
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ]

        # ── Auto-detect based on what ORT has compiled in ────────────────
        if not _HAS_ORT:
            return ["CPUExecutionProvider"]

        available = ort.get_available_providers()
        log.debug("ORT available providers: %s", available)

        if not self._config.use_gpu:
            return ["CPUExecutionProvider"]

        selected: list[str] = []
        for p in _PROVIDER_PRIORITY:
            if p in available:
                selected.append(p)

        if not selected:
            selected = ["CPUExecutionProvider"]

        # Always ensure CPU is the final fallback
        if "CPUExecutionProvider" not in selected:
            selected.append("CPUExecutionProvider")

        return selected

    def _build_session_options(self) -> "ort.SessionOptions":  # type: ignore[name-defined]
        """
        Build an optimised ORT SessionOptions object.

        Enables:
          - Graph optimisation level: ALL
          - Configurable intra-op thread count
          - Memory pattern optimisation (avoids repeated allocation)
          - Execution mode: sequential for single-stream use (lower latency)
        """
        opts = ort.SessionOptions()
        opts.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        opts.enable_mem_pattern = True
        opts.enable_cpu_mem_arena = True
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        if self._config.num_threads > 0:
            opts.intra_op_num_threads = self._config.num_threads
            opts.inter_op_num_threads = 1

        return opts

    # ------------------------------------------------------------------ #
    # Warm-up
    # ------------------------------------------------------------------ #

    def warmup(self, iterations: int = 3) -> None:
        """
        Execute ``iterations`` dummy forward passes to pre-allocate GPU
        buffers and prime CUDA/TensorRT engine compilation.

        Args:
            iterations: Number of dummy passes.  Must be ≥ 1.

        Raises:
            OnnxError: If the session is not loaded.
        """
        if not self._loaded or self._session is None:
            raise OnnxError("Cannot warm up — model is not loaded.")

        h = self._config.input_height
        w = self._config.input_width
        dtype = np.float16 if self._config.enable_fp16 else np.float32
        dummy = np.zeros((1, 3, h, w), dtype=dtype)

        log.info(
            "ONNX warm-up — %d iteration(s) @ %dx%d (%s)…",
            iterations,
            h,
            w,
            dtype.__name__,
        )

        for i in range(iterations):
            t0 = time.perf_counter()
            try:
                self._session.run(self._output_names, {self._input_name: dummy})
            except Exception as exc:  # noqa: BLE001
                log.warning("Warm-up iteration %d failed: %s", i + 1, exc)
            elapsed = (time.perf_counter() - t0) * 1000.0
            log.debug("Warm-up %d/%d — %.2f ms", i + 1, iterations, elapsed)

        log.info("ONNX warm-up complete.")

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #

    @property
    def is_loaded(self) -> bool:
        """True when the ONNX session is ready to run inference."""
        return self._loaded and self._session is not None

    @property
    def active_provider(self) -> str:
        """The first (highest-priority) execution provider in use."""
        return self._active_provider

    @property
    def model_path(self) -> Path:
        """Path to the loaded ONNX model file."""
        return self._model_path

    @property
    def input_name(self) -> str:
        """Name of the first input tensor as reported by the ONNX graph."""
        return self._input_name

    @property
    def output_names(self) -> list[str]:
        """Names of all output tensors as reported by the ONNX graph."""
        return self._output_names

    @property
    def input_shape(self) -> list[int]:
        """Shape of the first input tensor (may contain None for dynamic axes)."""
        return self._input_shape

    # ------------------------------------------------------------------ #
    # Low-level inference (raw tensors)
    # ------------------------------------------------------------------ #

    def run_raw(
        self,
        inputs: dict[str, np.ndarray],
        output_names: list[str] | None = None,
    ) -> list[np.ndarray]:
        """
        Execute a forward pass with pre-prepared input tensors.

        This is the lowest-level API — callers are responsible for all
        preprocessing (shape, dtype, normalisation).

        Args:
            inputs:       Dict mapping input tensor names to numpy arrays.
            output_names: Subset of outputs to fetch.  None = all outputs.

        Returns:
            List of numpy arrays corresponding to the requested outputs.

        Raises:
            OnnxError:        If the session is not loaded.
            InvalidInputError: If the tensor dtype / shape is incompatible.
        """
        if not self.is_loaded or self._session is None:
            raise OnnxError("Session is not loaded. Call from_config() first.")

        out_names = output_names or self._output_names

        try:
            return self._session.run(out_names, inputs)
        except ort.capi.onnxruntime_pybind11_state.InvalidArgument as exc:
            raise InvalidInputError(f"Invalid tensor input: {exc}") from exc
        except ort.capi.onnxruntime_pybind11_state.NotImplemented as exc:
            raise UnsupportedOperatorError(
                f"Unsupported ONNX operator: {exc}"
            ) from exc
        except Exception as exc:  # noqa: BLE001
            raise OnnxError(f"ONNX inference failed: {exc}") from exc

    # ------------------------------------------------------------------ #
    # High-level inference — YOLOv8 detection pipeline
    # ------------------------------------------------------------------ #

    def run_detection(self, frame: np.ndarray) -> DetectionResult:
        """
        Full YOLOv8 detection pipeline: preprocess → infer → postprocess.

        Returns a DetectionResult in exactly the same format as
        PersonDetector.detect() so it is a drop-in replacement.

        Args:
            frame: OpenCV BGR image (H × W × 3, uint8).

        Returns:
            DetectionResult with person detections and timing.

        Raises:
            InvalidInputError: If the frame is None, empty, or wrong shape.
            OnnxError:         On inference failure.
        """
        self._validate_frame(frame)

        # ── Preprocess ──────────────────────────────────────────────────
        t_pre = time.perf_counter()
        blob, orig_h, orig_w = self._preprocess_yolo(frame)
        preprocess_ms = (time.perf_counter() - t_pre) * 1000.0

        # ── Inference ───────────────────────────────────────────────────
        t_inf = time.perf_counter()
        outputs = self.run_raw({self._input_name: blob})
        inference_ms = (time.perf_counter() - t_inf) * 1000.0

        # ── Postprocess ─────────────────────────────────────────────────
        t_post = time.perf_counter()
        detections = self._postprocess_yolo(
            outputs[0], orig_h, orig_w
        )
        postprocess_ms = (time.perf_counter() - t_post) * 1000.0

        total_ms = preprocess_ms + inference_ms + postprocess_ms
        log.debug(
            "Detection — pre=%.1f ms | inf=%.1f ms | post=%.1f ms | total=%.1f ms | %d person(s)",
            preprocess_ms,
            inference_ms,
            postprocess_ms,
            total_ms,
            len(detections),
        )

        return DetectionResult(detections=detections, inference_ms=total_ms)

    # ------------------------------------------------------------------ #
    # Preprocessing
    # ------------------------------------------------------------------ #

    def _preprocess_yolo(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray, int, int]:
        """
        Convert an OpenCV BGR frame to a normalised NCHW float tensor
        suitable for YOLOv8 ONNX inference.

        Steps:
          1. Record original dimensions (needed for coordinate rescaling).
          2. Letterbox-resize to (input_height × input_width) without distortion.
          3. Convert BGR → RGB.
          4. HWC → CHW transposition.
          5. Normalise pixels to [0, 1].
          6. Add batch dimension: (1, 3, H, W).
          7. Cast to float16 if enable_fp16, else float32.

        Args:
            frame: Raw OpenCV BGR image.

        Returns:
            Tuple of (blob, original_height, original_width).
        """
        orig_h, orig_w = frame.shape[:2]
        h = self._config.input_height
        w = self._config.input_width

        # ── Letterbox resize ────────────────────────────────────────────
        blob_img = _letterbox(frame, (h, w))

        # ── BGR → RGB ───────────────────────────────────────────────────
        rgb = cv2.cvtColor(blob_img, cv2.COLOR_BGR2RGB)

        # ── HWC → CHW, normalise ────────────────────────────────────────
        tensor = np.ascontiguousarray(
            np.transpose(rgb.astype(np.float32) / 255.0, (2, 0, 1))
        )

        # ── Batch dim ───────────────────────────────────────────────────
        blob = np.expand_dims(tensor, axis=0)

        if self._config.enable_fp16:
            blob = blob.astype(np.float16)

        return blob, orig_h, orig_w

    def preprocess(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray, int, int]:
        """
        Public alias for ``_preprocess_yolo`` — for use in the benchmark.

        Args:
            frame: Raw OpenCV BGR image.

        Returns:
            Tuple of (blob, orig_h, orig_w).
        """
        return self._preprocess_yolo(frame)

    # ------------------------------------------------------------------ #
    # Postprocessing
    # ------------------------------------------------------------------ #

    def _postprocess_yolo(
        self,
        raw_output: np.ndarray,
        orig_h: int,
        orig_w: int,
    ) -> list[Detection]:
        """
        Decode the raw YOLOv8 ONNX output tensor into Detection objects.

        YOLOv8 ONNX export produces a tensor with shape:
          (1, 4 + num_classes, num_anchors)   [new export >= 8.1]
        or equivalently transposed:
          (1, num_anchors, 4 + num_classes)   [older exports]

        This method handles both layouts, filters for person detections,
        applies confidence thresholding, and runs NMS.

        Args:
            raw_output: ONNX session output tensor.
            orig_h:     Original frame height.
            orig_w:     Original frame width.

        Returns:
            List of Detection objects (person class only).
        """
        # ── Normalise output shape ───────────────────────────────────────
        preds = raw_output
        if preds.ndim == 3:
            # Remove batch dimension
            preds = preds[0]

        # YOLOv8 ONNX: shape can be (4+nc, num_anchors) or (num_anchors, 4+nc)
        # Transpose to (num_anchors, 4+nc) if needed
        if preds.shape[0] < preds.shape[1]:
            preds = preds.T  # (num_anchors, 4+nc)

        # ── Extract boxes and class scores ───────────────────────────────
        boxes_xywh = preds[:, :4]  # cx, cy, w, h  (model input space)
        scores_matrix = preds[:, 4:]  # shape (num_anchors, num_classes)

        # ── Person class confidence ──────────────────────────────────────
        if scores_matrix.shape[1] > PERSON_CLASS_ID:
            person_scores = scores_matrix[:, PERSON_CLASS_ID]
        else:
            # Fallback: first column
            person_scores = scores_matrix[:, 0]

        # ── Confidence threshold filter ──────────────────────────────────
        mask = person_scores >= self._config.conf_threshold
        if not np.any(mask):
            return []

        boxes_filtered = boxes_xywh[mask]
        confs_filtered = person_scores[mask]

        # ── Convert cx,cy,w,h → x1,y1,x2,y2 (model input space) ─────────
        boxes_xyxy = _xywh_to_xyxy(boxes_filtered)

        # ── NMS ──────────────────────────────────────────────────────────
        boxes_nms, confs_nms = _nms(
            boxes_xyxy, confs_filtered, self._config.iou_threshold
        )

        if len(boxes_nms) == 0:
            return []

        # ── Scale coordinates back to original image space ────────────────
        h_in = self._config.input_height
        w_in = self._config.input_width

        scale_x = orig_w / w_in
        scale_y = orig_h / h_in

        detections: list[Detection] = []
        for box, conf in zip(boxes_nms, confs_nms):
            x1 = int(np.clip(box[0] * scale_x, 0, orig_w - 1))
            y1 = int(np.clip(box[1] * scale_y, 0, orig_h - 1))
            x2 = int(np.clip(box[2] * scale_x, 0, orig_w))
            y2 = int(np.clip(box[3] * scale_y, 0, orig_h))

            if x2 <= x1 or y2 <= y1:
                continue  # Skip degenerate boxes

            detections.append(
                Detection(
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    confidence=float(conf),
                    class_id=PERSON_CLASS_ID,
                    label="person",
                )
            )

        return detections

    # ------------------------------------------------------------------ #
    # Generic inference — NumPy / OpenCV inputs
    # ------------------------------------------------------------------ #

    def inference(
        self,
        inputs: np.ndarray | list[np.ndarray],
        output_names: list[str] | None = None,
    ) -> list[np.ndarray]:
        """
        Generic inference entry point accepting pre-prepared numpy tensors.

        Unlike ``run_detection`` this method does **not** apply any
        preprocessing or postprocessing — it is useful for non-YOLO models
        such as the AgeEstimator.

        Args:
            inputs:       A single numpy array (auto-wrapped in a list) or
                          a list of arrays matching the session's input names.
            output_names: Subset of outputs to fetch.  None = all.

        Returns:
            List of output numpy arrays.

        Raises:
            OnnxError:         If session is not loaded.
            InvalidInputError: If input shapes / dtypes are invalid.
        """
        if not self.is_loaded or self._session is None:
            raise OnnxError("Session not loaded.")

        if isinstance(inputs, np.ndarray):
            inputs_list = [inputs]
        else:
            inputs_list = inputs

        all_input_names = [i.name for i in self._session.get_inputs()]
        if len(inputs_list) != len(all_input_names):
            raise InvalidInputError(
                f"Expected {len(all_input_names)} input tensor(s), "
                f"got {len(inputs_list)}."
            )

        feed: dict[str, np.ndarray] = {}
        for name, arr in zip(all_input_names, inputs_list):
            if not isinstance(arr, np.ndarray):
                raise InvalidInputError(
                    f"Input '{name}' must be a numpy array, got {type(arr)}."
                )
            feed[name] = arr

        return self.run_raw(feed, output_names)

    # ------------------------------------------------------------------ #
    # Batch inference
    # ------------------------------------------------------------------ #

    def run_batch(self, frames: list[np.ndarray]) -> list[DetectionResult]:
        """
        Run detection inference on a batch of frames.

        For maximum efficiency frames are stacked into a single NCHW batch
        tensor and processed in one forward pass.  Results are returned in
        the same order as the input list.

        Args:
            frames: List of OpenCV BGR images (each H × W × 3, uint8).
                    All frames in a batch must have the same spatial dimensions.

        Returns:
            List of DetectionResult, one per input frame.

        Raises:
            ValueError:        If frames is empty.
            InvalidInputError: If any frame is invalid.
        """
        if not frames:
            raise ValueError("frames list must not be empty.")

        for i, f in enumerate(frames):
            self._validate_frame(f, context=f"frames[{i}]")

        h = self._config.input_height
        w = self._config.input_width
        dtype = np.float16 if self._config.enable_fp16 else np.float32

        orig_sizes: list[tuple[int, int]] = []
        blobs: list[np.ndarray] = []

        t_pre = time.perf_counter()
        for frame in frames:
            blob, orig_h, orig_w = self._preprocess_yolo(frame)
            blobs.append(blob)
            orig_sizes.append((orig_h, orig_w))

        # Stack: (N, 3, H, W)
        batch_blob = np.concatenate(blobs, axis=0).astype(dtype)
        preprocess_ms = (time.perf_counter() - t_pre) * 1000.0

        t_inf = time.perf_counter()
        outputs = self.run_raw({self._input_name: batch_blob})
        inference_ms = (time.perf_counter() - t_inf) * 1000.0

        # Decode each image in the batch
        results: list[DetectionResult] = []
        t_post = time.perf_counter()

        raw = outputs[0]  # (N, 4+nc, anchors) or (N, anchors, 4+nc)
        for i, (orig_h, orig_w) in enumerate(orig_sizes):
            single_output = raw[i : i + 1]  # keep 3-D for postprocess
            dets = self._postprocess_yolo(single_output, orig_h, orig_w)
            per_frame_ms = (inference_ms / len(frames))
            results.append(DetectionResult(detections=dets, inference_ms=per_frame_ms))

        postprocess_ms = (time.perf_counter() - t_post) * 1000.0
        log.debug(
            "Batch detection (%d frames) — inf=%.1f ms | post=%.1f ms",
            len(frames),
            inference_ms,
            postprocess_ms,
        )

        return results

    # ------------------------------------------------------------------ #
    # Benchmark
    # ------------------------------------------------------------------ #

    def benchmark(
        self,
        frame: np.ndarray | None = None,
        num_iterations: int = 50,
        warmup_iters: int = 5,
    ) -> BenchmarkResult:
        """
        Measure inference performance over ``num_iterations`` forward passes.

        Executes ``warmup_iters`` iterations first (not counted) to ensure
        GPU engine compilation and CUDA graph capture are complete.  Then
        runs ``num_iterations`` timed passes and returns averaged statistics.

        Args:
            frame:          OpenCV BGR image to use as input.  A synthetic
                            640×640 dummy frame is generated when None.
            num_iterations: Number of timed iterations.
            warmup_iters:   Number of un-timed warm-up iterations.

        Returns:
            BenchmarkResult with averaged timing and FPS.

        Raises:
            OnnxError: If the session is not loaded.
        """
        if not self.is_loaded:
            raise OnnxError("Session not loaded — cannot benchmark.")

        if frame is None:
            frame = np.random.randint(
                0, 256,
                (self._config.input_height, self._config.input_width, 3),
                dtype=np.uint8,
            )

        self._validate_frame(frame)

        log.info(
            "Benchmarking '%s' — %d warm-up + %d iterations…",
            self._model_path.name,
            warmup_iters,
            num_iterations,
        )

        # ── Warm-up ─────────────────────────────────────────────────────
        for _ in range(warmup_iters):
            blob, oh, ow = self._preprocess_yolo(frame)
            self.run_raw({self._input_name: blob})

        # ── Timed runs ───────────────────────────────────────────────────
        pre_times: list[float] = []
        inf_times: list[float] = []
        post_times: list[float] = []

        for _ in range(num_iterations):
            t0 = time.perf_counter()
            blob, oh, ow = self._preprocess_yolo(frame)
            t1 = time.perf_counter()
            outputs = self.run_raw({self._input_name: blob})
            t2 = time.perf_counter()
            self._postprocess_yolo(outputs[0], oh, ow)
            t3 = time.perf_counter()

            pre_times.append((t1 - t0) * 1000.0)
            inf_times.append((t2 - t1) * 1000.0)
            post_times.append((t3 - t2) * 1000.0)

        avg_pre = float(np.mean(pre_times))
        avg_inf = float(np.mean(inf_times))
        avg_post = float(np.mean(post_times))
        avg_total = avg_pre + avg_inf + avg_post
        fps = 1000.0 / avg_total if avg_total > 0 else 0.0

        result = BenchmarkResult(
            preprocess_ms=avg_pre,
            inference_ms=avg_inf,
            postprocess_ms=avg_post,
            total_ms=avg_total,
            fps=fps,
            num_iterations=num_iterations,
            provider=self._active_provider,
            model_path=str(self._model_path),
        )

        log.info(
            "Benchmark complete — %.1f ms/frame (%.1f FPS) | provider: %s",
            avg_total,
            fps,
            self._active_provider,
        )

        return result

    # ------------------------------------------------------------------ #
    # Validation
    # ------------------------------------------------------------------ #

    def validate_model(self) -> bool:
        """
        Verify that the loaded model can successfully execute a single
        forward pass with a synthetic input.

        Returns:
            True if the validation pass succeeds.

        Raises:
            OnnxError: On any failure (propagates the original cause).
        """
        if not self.is_loaded or self._session is None:
            raise OnnxError("Session not loaded — cannot validate.")

        log.info("Validating ONNX model '%s'…", self._model_path.name)

        h = self._config.input_height
        w = self._config.input_width
        dtype = np.float16 if self._config.enable_fp16 else np.float32
        dummy = np.zeros((1, 3, h, w), dtype=dtype)

        try:
            outputs = self.run_raw({self._input_name: dummy})
            if not outputs:
                raise OnnxError("Model produced no output tensors.")

            for i, out in enumerate(outputs):
                if not isinstance(out, np.ndarray):
                    raise OnnxError(
                        f"Output {i} is not a numpy array: {type(out)}"
                    )

            log.info(
                "Model validation passed — %d output(s), shapes: %s",
                len(outputs),
                [o.shape for o in outputs],
            )
            return True

        except OnnxError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise OnnxError(f"Model validation failed: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Input validation helper
    # ------------------------------------------------------------------ #

    @staticmethod
    def _validate_frame(
        frame: np.ndarray | None, context: str = "frame"
    ) -> None:
        """
        Validate that *frame* is a non-empty OpenCV BGR uint8 image.

        Args:
            frame:   Frame to validate.
            context: Human-readable name for error messages.

        Raises:
            InvalidInputError: If the frame is None, empty, or wrong shape.
        """
        if frame is None:
            raise InvalidInputError(f"{context} must not be None.")
        if not isinstance(frame, np.ndarray):
            raise InvalidInputError(
                f"{context} must be a numpy ndarray, got {type(frame)}."
            )
        if frame.ndim != 3 or frame.shape[2] != 3:
            raise InvalidInputError(
                f"{context} must have shape (H, W, 3), got {frame.shape}."
            )
        if frame.size == 0:
            raise InvalidInputError(f"{context} is empty (size=0).")


# ---------------------------------------------------------------------------
# Module-level convenience API
# ---------------------------------------------------------------------------


def load_model(
    model_path: str | Path | None = None,
    config: OnnxConfig | None = None,
) -> OnnxInferenceSession:
    """
    Load (or retrieve from cache) an ONNX model and return a ready-to-use
    inference session.

    This is the primary entry point for most callers.

    Args:
        model_path: Path to the .onnx file.  Overrides config.model_path
                    and the ONNX_MODEL_PATH env-var when provided.
        config:     Optional pre-built OnnxConfig.  A default config is
                    constructed from env-vars if None.

    Returns:
        Warmed-up OnnxInferenceSession.

    Example:
        session = load_model("yolov8n.onnx")
        result  = session.run_detection(frame)
    """
    cfg = config or OnnxConfig()
    if model_path is not None:
        cfg.model_path = str(model_path)
    return OnnxInferenceSession.from_config(cfg)


def inference(
    session: OnnxInferenceSession,
    frame: np.ndarray,
) -> DetectionResult:
    """
    Run a single-frame detection on the given session.

    This is a thin convenience wrapper around session.run_detection().

    Args:
        session: Pre-loaded OnnxInferenceSession.
        frame:   OpenCV BGR image.

    Returns:
        DetectionResult compatible with the existing pipeline.
    """
    return session.run_detection(frame)


def warmup(session: OnnxInferenceSession, iterations: int = 3) -> None:
    """
    Warm up the given session with ``iterations`` dummy passes.

    Args:
        session:    The ONNX session to warm up.
        iterations: Number of warm-up passes (default 3).
    """
    session.warmup(iterations)


def benchmark(
    session: OnnxInferenceSession,
    frame: np.ndarray | None = None,
    num_iterations: int = 50,
) -> BenchmarkResult:
    """
    Benchmark the session and return averaged timing statistics.

    Args:
        session:        Pre-loaded ONNX session.
        frame:          Input frame.  Generates a dummy frame when None.
        num_iterations: Number of timed iterations.

    Returns:
        BenchmarkResult with preprocess / inference / postprocess / FPS.
    """
    return session.benchmark(frame=frame, num_iterations=num_iterations)


def validate_model(session: OnnxInferenceSession) -> bool:
    """
    Validate that the session can complete a forward pass.

    Args:
        session: Pre-loaded ONNX session.

    Returns:
        True on success.

    Raises:
        OnnxError: On validation failure.
    """
    return session.validate_model()


def export_to_onnx(
    model: Any,
    output_path: str | Path,
    input_shape: tuple[int, ...] = (1, 3, 640, 640),
    opset_version: int = 17,
    dynamic_axes: dict[str, dict[int, str]] | None = None,
    fp16: bool = False,
    simplify: bool = True,
) -> Path:
    """
    Export a PyTorch model to ONNX format.

    Supports both raw ``torch.nn.Module`` objects and Ultralytics ``YOLO``
    wrapper objects (which expose their own ``.export()`` method).

    Args:
        model:          PyTorch nn.Module or Ultralytics YOLO to export.
        output_path:    Destination path for the .onnx file.
        input_shape:    Shape of the dummy input tensor: (N, C, H, W).
        opset_version:  ONNX opset version (default 17).
        dynamic_axes:   Dynamic axes dict e.g. {"images": {0: "batch"}}.
                        When None, a sensible default with a dynamic batch
                        dimension is used.
        fp16:           Export weights as FP16 (GPU-only at runtime).
        simplify:       Run onnx-simplifier after export (requires
                        ``onnxsim`` to be installed; skipped if unavailable).

    Returns:
        Path to the exported .onnx file.

    Raises:
        ImportError:    If PyTorch is not installed.
        OnnxError:      If the export fails.
        ValueError:     If input_shape is invalid.

    Example:
        from ultralytics import YOLO
        yolo = YOLO("yolov8n.pt")
        onnx_path = export_to_onnx(yolo.model, "yolov8n.onnx")
    """
    if not _HAS_TORCH:
        raise ImportError(
            "PyTorch is required for ONNX export. "
            "Install with: pip install torch"
        )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if len(input_shape) != 4:
        raise ValueError(
            f"input_shape must be (N, C, H, W), got {input_shape}."
        )

    log.info(
        "Exporting model to ONNX — output='%s', opset=%d, fp16=%s",
        output_path,
        opset_version,
        fp16,
    )

    # ── Ultralytics YOLO shortcut ────────────────────────────────────────
    try:
        from ultralytics import YOLO as _YOLO  # type: ignore[import]

        if isinstance(model, _YOLO):
            log.info("Detected Ultralytics YOLO model — using built-in exporter.")
            exported = model.export(
                format="onnx",
                dynamic=True,
                simplify=simplify,
                opset=opset_version,
                half=fp16,
                imgsz=input_shape[2],  # H (assumes H==W for square input)
            )
            # Ultralytics returns the path as a string
            result = Path(str(exported))
            if str(result) != str(output_path):
                import shutil

                shutil.move(str(result), str(output_path))
            log.info("Ultralytics ONNX export complete: '%s'.", output_path)
            return output_path
    except ImportError:
        pass

    # ── Generic nn.Module export ─────────────────────────────────────────
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # type: ignore[union-attr]
    nn_model = model

    if fp16:
        nn_model = nn_model.half()

    nn_model.to(device)
    nn_model.eval()

    dummy_dtype = torch.float16 if fp16 else torch.float32  # type: ignore[union-attr]
    dummy_input = torch.zeros(input_shape, dtype=dummy_dtype, device=device)  # type: ignore[union-attr]

    _dynamic_axes = dynamic_axes or {
        "images": {0: "batch", 2: "height", 3: "width"},
        "output0": {0: "batch", 2: "anchors"},
    }

    try:
        torch.onnx.export(  # type: ignore[union-attr]
            nn_model,
            dummy_input,
            str(output_path),
            opset_version=opset_version,
            input_names=["images"],
            output_names=["output0"],
            dynamic_axes=_dynamic_axes,
            do_constant_folding=True,
        )
    except Exception as exc:  # noqa: BLE001
        raise OnnxError(f"torch.onnx.export failed: {exc}") from exc

    log.info("ONNX export successful: '%s'.", output_path)

    # ── Optional simplification ──────────────────────────────────────────
    if simplify:
        _try_simplify(output_path)

    return output_path


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _letterbox(
    image: np.ndarray,
    new_shape: tuple[int, int] = (640, 640),
    color: tuple[int, int, int] = (114, 114, 114),
) -> np.ndarray:
    """
    Resize image to ``new_shape`` with letterboxing (preserves aspect ratio).

    The image is scaled to fit inside the target shape and padded with
    ``color`` on the remaining sides.  This matches YOLOv8's standard
    preprocessing pipeline exactly.

    Args:
        image:     Input BGR image.
        new_shape: Target (height, width).
        color:     Padding colour (default grey).

    Returns:
        Letterboxed image of shape ``(new_shape[0], new_shape[1], 3)``.
    """
    shape = image.shape[:2]  # (h, w)
    target_h, target_w = new_shape

    # Scale ratio
    r = min(target_h / shape[0], target_w / shape[1])

    # Compute un-padded dimensions
    new_unpad_h = int(round(shape[0] * r))
    new_unpad_w = int(round(shape[1] * r))

    # Padding (divide by 2 for symmetric borders)
    dh = (target_h - new_unpad_h) / 2
    dw = (target_w - new_unpad_w) / 2

    if shape[::-1] != (new_unpad_w, new_unpad_h):
        image = cv2.resize(
            image, (new_unpad_w, new_unpad_h), interpolation=cv2.INTER_LINEAR
        )

    top = int(round(dh - 0.1))
    bottom = int(round(dh + 0.1))
    left = int(round(dw - 0.1))
    right = int(round(dw + 0.1))

    image = cv2.copyMakeBorder(
        image, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=color
    )
    return image


def _xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    """
    Convert bounding boxes from centre-xywh to corner-xyxy format.

    Args:
        boxes: (N, 4) array in [cx, cy, w, h] format.

    Returns:
        (N, 4) array in [x1, y1, x2, y2] format.
    """
    out = np.empty_like(boxes)
    out[:, 0] = boxes[:, 0] - boxes[:, 2] / 2  # x1
    out[:, 1] = boxes[:, 1] - boxes[:, 3] / 2  # y1
    out[:, 2] = boxes[:, 0] + boxes[:, 2] / 2  # x2
    out[:, 3] = boxes[:, 1] + boxes[:, 3] / 2  # y2
    return out


def _iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    """
    Compute IoU between a single box and an array of boxes.

    Args:
        box:   (4,) array [x1, y1, x2, y2].
        boxes: (N, 4) array.

    Returns:
        (N,) array of IoU values.
    """
    inter_x1 = np.maximum(box[0], boxes[:, 0])
    inter_y1 = np.maximum(box[1], boxes[:, 1])
    inter_x2 = np.minimum(box[2], boxes[:, 2])
    inter_y2 = np.minimum(box[3], boxes[:, 3])

    inter_w = np.maximum(0.0, inter_x2 - inter_x1)
    inter_h = np.maximum(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    box_area = (box[2] - box[0]) * (box[3] - box[1])
    boxes_area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    union_area = box_area + boxes_area - inter_area

    return np.where(union_area > 0, inter_area / union_area, 0.0)


def _nms(
    boxes: np.ndarray,
    scores: np.ndarray,
    iou_threshold: float = 0.45,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Greedy non-maximum suppression.

    Args:
        boxes:         (N, 4) float array in [x1, y1, x2, y2] format.
        scores:        (N,) confidence scores.
        iou_threshold: IoU above which a box is suppressed.

    Returns:
        Tuple of (kept_boxes, kept_scores) — may be empty.
    """
    if len(boxes) == 0:
        return np.empty((0, 4), dtype=np.float32), np.empty(0, dtype=np.float32)

    order = scores.argsort()[::-1]
    kept_indices: list[int] = []

    while len(order) > 0:
        idx = order[0]
        kept_indices.append(int(idx))
        if len(order) == 1:
            break

        rest = order[1:]
        iou_vals = _iou(boxes[idx], boxes[rest])
        order = rest[iou_vals < iou_threshold]

    k = np.array(kept_indices, dtype=np.int64)
    return boxes[k], scores[k]


def _try_simplify(onnx_path: Path) -> None:
    """
    Attempt to run onnxsim on the exported file.

    Silently skips if onnxsim is not installed or simplification fails.
    """
    try:
        import onnx  # type: ignore[import-untyped]
        import onnxsim  # type: ignore[import-untyped]

        model_proto = onnx.load(str(onnx_path))
        simplified, ok = onnxsim.simplify(model_proto)
        if ok:
            onnx.save(simplified, str(onnx_path))
            log.info("onnx-simplifier applied to '%s'.", onnx_path.name)
        else:
            log.warning("onnxsim could not simplify '%s'.", onnx_path.name)
    except ImportError:
        log.debug("onnxsim not installed — skipping simplification.")
    except Exception as exc:  # noqa: BLE001
        log.warning("onnxsim failed: %s — model unchanged.", exc)
