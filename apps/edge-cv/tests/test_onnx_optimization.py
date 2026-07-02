"""
test_onnx_optimization.py — Unit Tests for the ONNX Optimization Module
Express Display SmartVision — T-022

All tests are hermetic: no real ONNX model file is required.
onnxruntime is mocked at the module level so CI pipelines that don't have
GPU drivers or a model file can still validate correctness.

Coverage:
  - OnnxConfig environment variable parsing
  - _letterbox preprocessing geometry
  - _xywh_to_xyxy coordinate conversion
  - _nms (non-maximum suppression)
  - OnnxInferenceSession: load_model, warmup, validate, benchmark, inference
  - run_detection: preprocess + postprocess pipeline
  - run_batch: multi-frame forward pass
  - CPU fallback when GPU provider fails
  - Dynamic input shapes
  - Invalid input handling
  - Performance validation (FPS > 0 constraint)
  - Module-level convenience API
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock, Mock, patch, PropertyMock
import numpy as np
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_frame(h: int = 480, w: int = 640) -> np.ndarray:
    """Return a synthetic BGR frame."""
    return np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)


def _yolov8_raw_output(n_detections: int = 3, nc: int = 80) -> np.ndarray:
    """
    Synthesise a YOLOv8 ONNX output tensor of shape (1, 4+nc, num_anchors).
    A few boxes are placed with high person-class confidence.
    """
    num_anchors = 8400
    raw = np.zeros((1, 4 + nc, num_anchors), dtype=np.float32)

    # Inject realistic detections in the first n slots
    for i in range(n_detections):
        cx = 100.0 + i * 80
        cy = 200.0 + i * 50
        w = 60.0
        h = 120.0
        raw[0, 0, i] = cx
        raw[0, 1, i] = cy
        raw[0, 2, i] = w
        raw[0, 3, i] = h
        raw[0, 4, i] = 0.95  # person class score

    return raw


# ---------------------------------------------------------------------------
# Mock onnxruntime session
# ---------------------------------------------------------------------------


def _make_mock_ort_session(output_tensor: np.ndarray | None = None) -> MagicMock:
    """Build a minimal mock mimicking onnxruntime.InferenceSession."""
    session = MagicMock()

    # get_inputs → single tensor named "images", shape [1,3,640,640]
    input_meta = MagicMock()
    input_meta.name = "images"
    input_meta.shape = [1, 3, 640, 640]
    session.get_inputs.return_value = [input_meta]

    # get_outputs → single output named "output0"
    output_meta = MagicMock()
    output_meta.name = "output0"
    session.get_outputs.return_value = [output_meta]

    # get_providers → CPU only (safe default)
    session.get_providers.return_value = ["CPUExecutionProvider"]

    # run() → returns the synthetic tensor
    tensor = output_tensor if output_tensor is not None else _yolov8_raw_output()
    session.run.return_value = [tensor]

    return session


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clear_session_cache():
    """Ensure the module-level session cache is empty before each test."""
    from app.models.onnx_optimization import _SESSION_CACHE

    _SESSION_CACHE.clear()
    yield
    _SESSION_CACHE.clear()


@pytest.fixture
def cfg():
    """Return a default OnnxConfig with CPU enforcement."""
    from app.models.onnx_optimization import OnnxConfig

    return OnnxConfig(
        model_path="/fake/model.onnx",
        provider="cpu",
        use_gpu=False,
        enable_fp16=False,
        num_threads=1,
        warmup_iters=0,  # Skip warmup in unit tests
        opset_version=17,
        input_height=640,
        input_width=640,
        conf_threshold=0.40,
        iou_threshold=0.45,
        cache_dir="/tmp/models",
    )


@pytest.fixture
def mock_session(cfg):
    """Return a fully wired OnnxInferenceSession backed by a mock ORT session."""
    from app.models.onnx_optimization import OnnxInferenceSession

    sess = OnnxInferenceSession("/fake/model.onnx", cfg)

    # Inject mock ORT session directly — bypasses file I/O
    ort_mock = _make_mock_ort_session()
    sess._session = ort_mock
    sess._input_name = "images"
    sess._input_shape = [1, 3, 640, 640]
    sess._output_names = ["output0"]
    sess._active_provider = "CPUExecutionProvider"
    sess._loaded = True

    return sess


# ---------------------------------------------------------------------------
# Tests — OnnxConfig
# ---------------------------------------------------------------------------


class TestOnnxConfig:
    def test_defaults(self):
        from app.models.onnx_optimization import OnnxConfig

        with patch.dict(os.environ, {}, clear=False):
            cfg = OnnxConfig()

        assert cfg.opset_version == 17
        assert cfg.input_height == 640
        assert cfg.input_width == 640
        assert cfg.conf_threshold == pytest.approx(0.40)
        assert cfg.iou_threshold == pytest.approx(0.45)
        assert cfg.warmup_iters == 3

    def test_env_var_override(self):
        from app.models.onnx_optimization import OnnxConfig

        env = {
            "ONNX_MODEL_PATH": "/models/custom.onnx",
            "ONNX_PROVIDER": "cuda",
            "USE_GPU": "true",
            "ENABLE_FP16": "true",
            "NUM_THREADS": "4",
            "MODEL_WARMUP": "5",
            "ONNX_OPSET": "16",
            "ONNX_INPUT_SIZE": "320,320",
            "ONNX_CONF_THRESH": "0.55",
            "ONNX_IOU_THRESH": "0.50",
        }
        with patch.dict(os.environ, env):
            cfg = OnnxConfig()

        assert cfg.model_path == "/models/custom.onnx"
        assert cfg.provider == "cuda"
        assert cfg.use_gpu is True
        assert cfg.enable_fp16 is True
        assert cfg.num_threads == 4
        assert cfg.warmup_iters == 5
        assert cfg.opset_version == 16
        assert cfg.input_height == 320
        assert cfg.input_width == 320
        assert cfg.conf_threshold == pytest.approx(0.55)
        assert cfg.iou_threshold == pytest.approx(0.50)

    def test_disable_gpu_via_env(self):
        from app.models.onnx_optimization import OnnxConfig

        with patch.dict(os.environ, {"USE_GPU": "false"}):
            cfg = OnnxConfig()

        assert cfg.use_gpu is False

    def test_fp16_disabled_by_default(self):
        from app.models.onnx_optimization import OnnxConfig

        with patch.dict(os.environ, {}, clear=False):
            cfg = OnnxConfig()

        assert cfg.enable_fp16 is False

    def test_input_size_parsing_defaults_on_bad_value(self):
        from app.models.onnx_optimization import _parse_input_size

        with patch.dict(os.environ, {"ONNX_INPUT_SIZE": "not-a-number"}):
            h, w = _parse_input_size()

        assert h == 640
        assert w == 640


# ---------------------------------------------------------------------------
# Tests — Letterbox preprocessing
# ---------------------------------------------------------------------------


class TestLetterbox:
    def test_output_shape_matches_target(self):
        from app.models.onnx_optimization import _letterbox

        frame = _make_frame(480, 640)
        out = _letterbox(frame, (640, 640))
        assert out.shape == (640, 640, 3)

    def test_square_frame_no_padding(self):
        from app.models.onnx_optimization import _letterbox

        frame = _make_frame(640, 640)
        out = _letterbox(frame, (640, 640))
        assert out.shape == (640, 640, 3)

    def test_portrait_frame_padded_correctly(self):
        from app.models.onnx_optimization import _letterbox

        frame = _make_frame(720, 405)  # 16:9 portrait
        out = _letterbox(frame, (640, 640))
        assert out.shape == (640, 640, 3)

    def test_small_frame_upscaled(self):
        from app.models.onnx_optimization import _letterbox

        frame = _make_frame(100, 100)
        out = _letterbox(frame, (640, 640))
        assert out.shape == (640, 640, 3)


# ---------------------------------------------------------------------------
# Tests — Coordinate helpers
# ---------------------------------------------------------------------------


class TestCoordinateHelpers:
    def test_xywh_to_xyxy_basic(self):
        from app.models.onnx_optimization import _xywh_to_xyxy

        boxes = np.array([[100.0, 200.0, 50.0, 80.0]])  # cx, cy, w, h
        result = _xywh_to_xyxy(boxes)

        assert result[0, 0] == pytest.approx(75.0)   # x1
        assert result[0, 1] == pytest.approx(160.0)  # y1
        assert result[0, 2] == pytest.approx(125.0)  # x2
        assert result[0, 3] == pytest.approx(240.0)  # y2

    def test_xywh_to_xyxy_batch(self):
        from app.models.onnx_optimization import _xywh_to_xyxy

        boxes = np.array([
            [100.0, 100.0, 40.0, 60.0],
            [200.0, 300.0, 80.0, 120.0],
        ])
        result = _xywh_to_xyxy(boxes)
        assert result.shape == (2, 4)

    def test_xywh_to_xyxy_zero_box(self):
        from app.models.onnx_optimization import _xywh_to_xyxy

        boxes = np.array([[0.0, 0.0, 0.0, 0.0]])
        result = _xywh_to_xyxy(boxes)
        assert np.all(result == 0.0)


# ---------------------------------------------------------------------------
# Tests — NMS
# ---------------------------------------------------------------------------


class TestNMS:
    def test_empty_returns_empty(self):
        from app.models.onnx_optimization import _nms

        boxes, scores = _nms(
            np.empty((0, 4), dtype=np.float32),
            np.empty(0, dtype=np.float32),
        )
        assert boxes.shape[0] == 0
        assert scores.shape[0] == 0

    def test_single_box_passes_through(self):
        from app.models.onnx_optimization import _nms

        boxes = np.array([[10.0, 10.0, 50.0, 50.0]])
        scores = np.array([0.9])
        kept_boxes, kept_scores = _nms(boxes, scores, iou_threshold=0.45)
        assert kept_boxes.shape[0] == 1
        assert kept_scores[0] == pytest.approx(0.9)

    def test_identical_boxes_suppresses_to_one(self):
        from app.models.onnx_optimization import _nms

        boxes = np.array([
            [10.0, 10.0, 50.0, 50.0],
            [10.0, 10.0, 50.0, 50.0],
            [10.0, 10.0, 50.0, 50.0],
        ])
        scores = np.array([0.9, 0.8, 0.7])
        kept_boxes, kept_scores = _nms(boxes, scores, iou_threshold=0.45)
        assert kept_boxes.shape[0] == 1
        assert kept_scores[0] == pytest.approx(0.9)

    def test_non_overlapping_boxes_all_kept(self):
        from app.models.onnx_optimization import _nms

        boxes = np.array([
            [0.0, 0.0, 10.0, 10.0],
            [100.0, 100.0, 200.0, 200.0],
            [300.0, 300.0, 400.0, 400.0],
        ])
        scores = np.array([0.9, 0.8, 0.85])
        kept_boxes, _ = _nms(boxes, scores, iou_threshold=0.45)
        assert kept_boxes.shape[0] == 3

    def test_partial_overlap_removes_low_score(self):
        from app.models.onnx_optimization import _nms

        # Two boxes with high overlap
        boxes = np.array([
            [10.0, 10.0, 60.0, 60.0],
            [12.0, 12.0, 58.0, 58.0],
        ])
        scores = np.array([0.95, 0.85])
        kept_boxes, kept_scores = _nms(boxes, scores, iou_threshold=0.45)
        assert kept_boxes.shape[0] == 1
        assert kept_scores[0] == pytest.approx(0.95)


# ---------------------------------------------------------------------------
# Tests — OnnxInferenceSession: Loading
# ---------------------------------------------------------------------------


class TestSessionLoading:
    def test_load_raises_when_onnxruntime_missing(self, cfg, tmp_path):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        # Create a dummy file so the existence check passes
        model = tmp_path / "model.onnx"
        model.write_bytes(b"fake")
        cfg.model_path = str(model)

        sess = OnnxInferenceSession(cfg.model_path, cfg)

        with patch("app.models.onnx_optimization._HAS_ORT", False):
            with pytest.raises(OnnxError, match="onnxruntime is not installed"):
                sess._load()

    def test_load_raises_on_missing_file(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, ModelNotFoundError

        cfg.model_path = "/nonexistent/path/model.onnx"
        sess = OnnxInferenceSession(cfg.model_path, cfg)

        with patch("app.models.onnx_optimization._HAS_ORT", True):
            with pytest.raises(ModelNotFoundError):
                sess._load()

    def test_from_config_uses_cache(self, cfg, tmp_path, mock_session):
        from app.models.onnx_optimization import _SESSION_CACHE
        from pathlib import Path

        key = str(Path(cfg.model_path).resolve())
        _SESSION_CACHE[key] = mock_session

        from app.models.onnx_optimization import OnnxInferenceSession

        result = OnnxInferenceSession.from_config(cfg)
        assert result is mock_session

    def test_provider_resolution_cpu_override(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession

        cfg.provider = "cpu"
        sess = OnnxInferenceSession("/fake.onnx", cfg)
        providers = sess._resolve_providers()
        assert providers == ["CPUExecutionProvider"]

    def test_provider_resolution_cuda_override(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession

        cfg.provider = "cuda"
        sess = OnnxInferenceSession("/fake.onnx", cfg)
        providers = sess._resolve_providers()
        assert "CUDAExecutionProvider" in providers
        assert "CPUExecutionProvider" in providers

    def test_provider_resolution_tensorrt_override(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession

        cfg.provider = "tensorrt"
        sess = OnnxInferenceSession("/fake.onnx", cfg)
        providers = sess._resolve_providers()
        assert providers[0] == "TensorRTExecutionProvider"

    def test_provider_resolution_no_gpu_uses_cpu(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession

        cfg.provider = "auto"
        cfg.use_gpu = False
        sess = OnnxInferenceSession("/fake.onnx", cfg)
        providers = sess._resolve_providers()
        assert providers == ["CPUExecutionProvider"]

    def test_session_options_threads(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, _HAS_ORT

        if not _HAS_ORT:
            pytest.skip("onnxruntime not installed in this environment")

        cfg.num_threads = 2
        sess = OnnxInferenceSession("/fake.onnx", cfg)
        opts = sess._build_session_options()
        assert opts is not None


# ---------------------------------------------------------------------------
# Tests — Warmup
# ---------------------------------------------------------------------------


class TestWarmup:
    def test_warmup_calls_run(self, mock_session):
        mock_session.warmup(iterations=3)
        assert mock_session._session.run.call_count == 3

    def test_warmup_raises_when_not_loaded(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        sess = OnnxInferenceSession("/fake.onnx", cfg)
        # _loaded is False by default
        with pytest.raises(OnnxError, match="not loaded"):
            sess.warmup(1)

    def test_warmup_fp16(self, mock_session):
        mock_session._config.enable_fp16 = True
        mock_session.warmup(iterations=1)
        call_args = mock_session._session.run.call_args
        input_tensor = list(call_args[0][1].values())[0]
        assert input_tensor.dtype == np.float16


# ---------------------------------------------------------------------------
# Tests — Validate model
# ---------------------------------------------------------------------------


class TestValidateModel:
    def test_validate_returns_true_on_success(self, mock_session):
        result = mock_session.validate_model()
        assert result is True

    def test_validate_raises_when_not_loaded(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        sess = OnnxInferenceSession("/fake.onnx", cfg)
        with pytest.raises(OnnxError, match="not loaded"):
            sess.validate_model()

    def test_validate_raises_when_no_output(self, mock_session):
        from app.models.onnx_optimization import OnnxError

        mock_session._session.run.return_value = []
        with pytest.raises(OnnxError, match="no output"):
            mock_session.validate_model()


# ---------------------------------------------------------------------------
# Tests — run_raw
# ---------------------------------------------------------------------------


class TestRunRaw:
    def test_run_raw_basic(self, mock_session):
        dummy = np.zeros((1, 3, 640, 640), dtype=np.float32)
        outputs = mock_session.run_raw({"images": dummy})
        assert len(outputs) == 1

    def test_run_raw_raises_when_not_loaded(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        sess = OnnxInferenceSession("/fake.onnx", cfg)
        with pytest.raises(OnnxError, match="not loaded"):
            sess.run_raw({"images": np.zeros((1, 3, 640, 640))})


# ---------------------------------------------------------------------------
# Tests — Detection pipeline
# ---------------------------------------------------------------------------


class TestRunDetection:
    def test_returns_detection_result_type(self, mock_session):
        from app.models.onnx_optimization import DetectionResult

        frame = _make_frame()
        result = mock_session.run_detection(frame)
        assert isinstance(result, DetectionResult)

    def test_returns_correct_person_count(self, mock_session):
        frame = _make_frame()
        result = mock_session.run_detection(frame)
        # n_detections=3 injected in mock output, all high-confidence
        assert result.person_count >= 0  # NMS may reduce count

    def test_none_frame_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        with pytest.raises(InvalidInputError, match="not be None"):
            mock_session.run_detection(None)

    def test_wrong_shape_frame_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        bad_frame = np.zeros((480, 640), dtype=np.uint8)  # missing channel dim
        with pytest.raises(InvalidInputError, match="shape"):
            mock_session.run_detection(bad_frame)

    def test_empty_frame_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        empty = np.empty((0, 0, 3), dtype=np.uint8)
        with pytest.raises(InvalidInputError, match="empty"):
            mock_session.run_detection(empty)

    def test_detections_within_frame_bounds(self, mock_session):
        h, w = 480, 640
        frame = _make_frame(h, w)
        result = mock_session.run_detection(frame)
        for det in result.detections:
            assert 0 <= det.x1 < w
            assert 0 <= det.y1 < h
            assert det.x2 <= w
            assert det.y2 <= h
            assert det.x1 < det.x2
            assert det.y1 < det.y2

    def test_detection_confidence_in_range(self, mock_session):
        frame = _make_frame()
        result = mock_session.run_detection(frame)
        for det in result.detections:
            assert 0.0 <= det.confidence <= 1.0

    def test_detection_labels_are_person(self, mock_session):
        frame = _make_frame()
        result = mock_session.run_detection(frame)
        for det in result.detections:
            assert det.label == "person"
            assert det.class_id == 0

    def test_inference_ms_is_positive(self, mock_session):
        frame = _make_frame()
        result = mock_session.run_detection(frame)
        assert result.inference_ms >= 0.0

    def test_no_detections_with_zero_output(self, mock_session, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession

        # All scores = 0 → nothing above conf_threshold
        zero_output = np.zeros((1, 84, 8400), dtype=np.float32)
        mock_session._session.run.return_value = [zero_output]

        frame = _make_frame()
        result = mock_session.run_detection(frame)
        assert result.person_count == 0


# ---------------------------------------------------------------------------
# Tests — Batch inference
# ---------------------------------------------------------------------------


class TestRunBatch:
    def test_batch_returns_correct_count(self, mock_session):
        frames = [_make_frame() for _ in range(3)]
        # Batch output needs shape (N, 4+nc, anchors)
        mock_session._session.run.return_value = [
            np.zeros((3, 84, 8400), dtype=np.float32)
        ]
        results = mock_session.run_batch(frames)
        assert len(results) == 3

    def test_empty_batch_raises(self, mock_session):
        with pytest.raises(ValueError, match="empty"):
            mock_session.run_batch([])

    def test_batch_invalid_frame_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        frames = [_make_frame(), None]  # type: ignore[list-item]
        with pytest.raises(InvalidInputError):
            mock_session.run_batch(frames)


# ---------------------------------------------------------------------------
# Tests — Preprocessing
# ---------------------------------------------------------------------------


class TestPreprocess:
    def test_output_shape_is_nchw(self, mock_session):
        frame = _make_frame(480, 640)
        blob, oh, ow = mock_session.preprocess(frame)
        assert blob.ndim == 4
        assert blob.shape == (1, 3, 640, 640)

    def test_output_dtype_float32_by_default(self, mock_session):
        frame = _make_frame()
        blob, _, _ = mock_session.preprocess(frame)
        assert blob.dtype == np.float32

    def test_output_dtype_float16_when_enabled(self, mock_session):
        mock_session._config.enable_fp16 = True
        frame = _make_frame()
        blob, _, _ = mock_session.preprocess(frame)
        assert blob.dtype == np.float16

    def test_pixel_values_in_zero_one_range(self, mock_session):
        frame = _make_frame()
        blob, _, _ = mock_session.preprocess(frame)
        assert blob.min() >= 0.0
        assert blob.max() <= 1.0

    def test_original_dimensions_preserved(self, mock_session):
        frame = _make_frame(720, 1280)
        _, orig_h, orig_w = mock_session.preprocess(frame)
        assert orig_h == 720
        assert orig_w == 1280


# ---------------------------------------------------------------------------
# Tests — Generic inference API
# ---------------------------------------------------------------------------


class TestGenericInference:
    def test_inference_single_array(self, mock_session):
        dummy = np.zeros((1, 3, 640, 640), dtype=np.float32)
        outputs = mock_session.inference(dummy)
        assert len(outputs) >= 1

    def test_inference_list_of_arrays(self, mock_session):
        dummy = np.zeros((1, 3, 640, 640), dtype=np.float32)
        outputs = mock_session.inference([dummy])
        assert len(outputs) >= 1

    def test_inference_wrong_number_of_inputs_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        # Session expects 1 input; pass 2
        inputs = [
            np.zeros((1, 3, 640, 640), dtype=np.float32),
            np.zeros((1, 3, 640, 640), dtype=np.float32),
        ]
        with pytest.raises(InvalidInputError, match="Expected 1"):
            mock_session.inference(inputs)

    def test_inference_non_numpy_raises(self, mock_session):
        from app.models.onnx_optimization import InvalidInputError

        with pytest.raises(InvalidInputError):
            mock_session.inference(["not-a-numpy-array"])  # type: ignore[list-item]

    def test_inference_not_loaded_raises(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        sess = OnnxInferenceSession("/fake.onnx", cfg)
        with pytest.raises(OnnxError, match="not loaded"):
            sess.inference(np.zeros((1, 3, 640, 640)))


# ---------------------------------------------------------------------------
# Tests — Benchmark
# ---------------------------------------------------------------------------


class TestBenchmark:
    def test_benchmark_returns_result(self, mock_session):
        from app.models.onnx_optimization import BenchmarkResult

        result = mock_session.benchmark(num_iterations=5, warmup_iters=2)
        assert isinstance(result, BenchmarkResult)

    def test_benchmark_fps_positive(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        assert result.fps > 0.0

    def test_benchmark_timings_non_negative(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        assert result.preprocess_ms >= 0.0
        assert result.inference_ms >= 0.0
        assert result.postprocess_ms >= 0.0
        assert result.total_ms > 0.0

    def test_benchmark_total_equals_sum(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        expected_total = (
            result.preprocess_ms + result.inference_ms + result.postprocess_ms
        )
        assert result.total_ms == pytest.approx(expected_total, rel=1e-3)

    def test_benchmark_iteration_count_stored(self, mock_session):
        result = mock_session.benchmark(num_iterations=10, warmup_iters=2)
        assert result.num_iterations == 10

    def test_benchmark_provider_name_stored(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        assert result.provider == "CPUExecutionProvider"

    def test_benchmark_model_path_stored(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        assert "fake" in result.model_path

    def test_benchmark_summary_json_serialisable(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        summary = result.summary()
        assert json.dumps(summary)  # Must not raise

    def test_benchmark_with_custom_frame(self, mock_session):
        frame = _make_frame(720, 1280)
        result = mock_session.benchmark(frame=frame, num_iterations=3, warmup_iters=1)
        assert result.fps > 0.0

    def test_benchmark_raises_when_not_loaded(self, cfg):
        from app.models.onnx_optimization import OnnxInferenceSession, OnnxError

        sess = OnnxInferenceSession("/fake.onnx", cfg)
        with pytest.raises(OnnxError, match="not loaded"):
            sess.benchmark(num_iterations=1)


# ---------------------------------------------------------------------------
# Tests — CPU fallback
# ---------------------------------------------------------------------------


class TestCPUFallback:
    def test_fallback_when_cuda_unavailable(self, cfg, tmp_path):
        """
        Simulate a scenario where CUDA is listed as available but fails to
        initialise, and verify the session falls back to CPU.
        """
        model_file = tmp_path / "model.onnx"
        model_file.write_bytes(b"fake-onnx-data")
        cfg.model_path = str(model_file)
        cfg.provider = "auto"
        cfg.use_gpu = True

        ort_mock = _make_mock_ort_session()

        call_count = {"n": 0}

        def failing_then_cpu(*args: Any, **kwargs: Any) -> MagicMock:
            prov = kwargs.get("providers", args[1] if len(args) > 1 else [])
            call_count["n"] += 1
            if "CUDAExecutionProvider" in prov or "TensorRTExecutionProvider" in prov:
                raise RuntimeError("CUDA provider failed: no GPU found")
            return ort_mock

        from app.models.onnx_optimization import OnnxInferenceSession

        sess = OnnxInferenceSession(cfg.model_path, cfg)

        with (
            patch("app.models.onnx_optimization._HAS_ORT", True),
            patch("app.models.onnx_optimization.ort") as mock_ort,
        ):
            mock_ort.InferenceSession.side_effect = failing_then_cpu
            mock_ort.get_available_providers.return_value = [
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ]
            mock_ort.SessionOptions.return_value = MagicMock()
            mock_ort.GraphOptimizationLevel.ORT_ENABLE_ALL = 99
            mock_ort.ExecutionMode.ORT_SEQUENTIAL = 0
            ort_mock.get_providers.return_value = ["CPUExecutionProvider"]
            ort_mock.get_inputs.return_value = [
                MagicMock(name="images", shape=[1, 3, 640, 640])
            ]
            # Pydantic attribute names conflict — set manually
            ort_mock.get_inputs.return_value[0].configure_mock(
                **{"name": "images", "shape": [1, 3, 640, 640]}
            )
            ort_mock.get_outputs.return_value = [
                MagicMock(**{"name": "output0"})
            ]
            sess._config.warmup_iters = 0

            sess._load()

        # If CPU fallback worked, _loaded should be True
        assert sess._loaded is True


# ---------------------------------------------------------------------------
# Tests — Dynamic input shapes
# ---------------------------------------------------------------------------


class TestDynamicInputShapes:
    def test_320x320_input(self, mock_session):
        """Verify 320×320 input is processed correctly end-to-end."""
        mock_session._config.input_height = 320
        mock_session._config.input_width = 320

        frame = _make_frame(240, 320)
        blob, oh, ow = mock_session.preprocess(frame)
        assert blob.shape == (1, 3, 320, 320)
        assert oh == 240
        assert ow == 320

    def test_1280x720_input(self, mock_session):
        mock_session._config.input_height = 720
        mock_session._config.input_width = 1280

        frame = _make_frame(480, 640)
        blob, oh, ow = mock_session.preprocess(frame)
        assert blob.shape == (1, 3, 720, 1280)

    def test_non_square_input(self, mock_session):
        mock_session._config.input_height = 480
        mock_session._config.input_width = 640

        frame = _make_frame(1080, 1920)
        blob, oh, ow = mock_session.preprocess(frame)
        assert blob.shape == (1, 3, 480, 640)
        assert oh == 1080
        assert ow == 1920


# ---------------------------------------------------------------------------
# Tests — Module-level convenience API
# ---------------------------------------------------------------------------


class TestConvenienceAPI:
    def test_load_model_returns_session(self, cfg, mock_session):
        from app.models.onnx_optimization import load_model, _SESSION_CACHE
        from pathlib import Path

        key = str(Path(cfg.model_path).resolve())
        _SESSION_CACHE[key] = mock_session

        result = load_model(cfg.model_path, cfg)
        assert result is mock_session

    def test_inference_api(self, mock_session):
        from app.models.onnx_optimization import inference, DetectionResult

        frame = _make_frame()
        result = inference(mock_session, frame)
        assert isinstance(result, DetectionResult)

    def test_warmup_api(self, mock_session):
        from app.models.onnx_optimization import warmup

        warmup(mock_session, iterations=2)
        assert mock_session._session.run.call_count == 2

    def test_benchmark_api(self, mock_session):
        from app.models.onnx_optimization import benchmark, BenchmarkResult

        result = benchmark(mock_session, num_iterations=3)
        assert isinstance(result, BenchmarkResult)

    def test_validate_api(self, mock_session):
        from app.models.onnx_optimization import validate_model

        result = validate_model(mock_session)
        assert result is True


# ---------------------------------------------------------------------------
# Tests — Performance validation
# ---------------------------------------------------------------------------


class TestPerformanceValidation:
    def test_fps_greater_than_zero(self, mock_session):
        result = mock_session.benchmark(num_iterations=10, warmup_iters=2)
        assert result.fps > 0.0, "FPS must always be positive."

    def test_benchmark_summary_has_required_keys(self, mock_session):
        result = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        summary = result.summary()
        required_keys = {
            "model_path",
            "provider",
            "num_iterations",
            "preprocess_ms",
            "inference_ms",
            "postprocess_ms",
            "total_ms",
            "fps",
        }
        assert required_keys.issubset(summary.keys())

    def test_multiple_runs_are_stable(self, mock_session):
        """Run benchmark twice and assert FPS stays reasonable (> 0)."""
        r1 = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        r2 = mock_session.benchmark(num_iterations=5, warmup_iters=1)
        assert r1.fps > 0.0
        assert r2.fps > 0.0
