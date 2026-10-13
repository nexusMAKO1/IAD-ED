"""
main.py — Edge-CV Service Entry Point
IAD & SmartQueue AI — Express Display SmartVision (T-009)

Production-ready FastAPI application that:
  • Loads configuration from environment variables (app.config.AppSettings)
  • Initialises all Edge-CV services during lifespan startup:
      - YOLO detector (PersonDetector)
      - Demographics (AgeEstimator, GenderEstimator)
      - Multi-Object Tracker (ByteTracker)
      - Integrated FrameProcessor (app.pipeline.FrameProcessor)
      - Camera manager (CameraManager)
      - MQTT client (MQTTClient)
  • Exposes the following HTTP endpoints:
      GET  /          — welcome / root
      GET  /health    — liveness + dependency status
      POST /detect    — multipart image -> YOLO & Demographics inference
      GET  /status    — runtime telemetry
      GET  /metrics   — Prometheus-compatible metrics (via Instrumentator)
      GET  /metrics/json — JSON telemetry
      GET  /snapshot  — Live frame snapshot
  • Configures structured logging, CORS middleware, and global exception handler.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import socket
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
import psutil
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import Counter, Gauge, Histogram
from prometheus_fastapi_instrumentator import Instrumentator

if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.detector import PersonDetector
from app.services.camera_manager import CameraManager
from app.services.mqtt_client import MQTTClient
from app.demographics.age_estimation import AgeEstimator
from app.demographics.gender_estimation import GenderEstimator
from app.tracking.bytetrack import ByteTracker
from app.pipeline.frame_processor import FrameProcessor, ProcessedFrameResult

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("iad.edge-cv")

# ---------------------------------------------------------------------------
# Application State
# ---------------------------------------------------------------------------
_detector: Optional[PersonDetector] = None
_model_loaded: bool = False
_age_estimator: Optional[AgeEstimator] = None
_gender_estimator: Optional[GenderEstimator] = None
_tracker: Optional[ByteTracker] = None
_frame_processor: Optional[FrameProcessor] = None

_camera_manager: CameraManager = CameraManager(source=settings.camera_source)

def _get_device_status() -> str:
    if not settings.site_id:
        return "UNPAIRED"
    return "ONLINE" if _camera_manager.is_connected else "DEGRADED"

_mqtt_client: MQTTClient = MQTTClient(
    host=settings.mqtt_host,
    port=settings.mqtt_port,
    username=settings.mqtt_user,
    password=settings.mqtt_password,
    client_id=settings.mqtt_client_id,
    keepalive=settings.mqtt_keepalive,
    site_id=settings.site_id,
    device_id=settings.device_id,
    status_callback=_get_device_status,
)

_start_time: float = time.monotonic()
_total_detections: int = 0
_last_inference_ms: float = 0.0
_SERVICE_ID: str = socket.gethostname()

# ---------------------------------------------------------------------------
# Prometheus Metrics
# ---------------------------------------------------------------------------
cv_fps_gauge = Gauge("edge_cv_fps", "Current estimated frames per second")
cv_yolo_latency_hist = Histogram("edge_cv_yolo_latency_seconds", "YOLOv8 inference latency")
cv_processing_latency_hist = Histogram("edge_cv_processing_latency_seconds", "Total frame processing latency")
cv_people_detected_gauge = Gauge("edge_cv_people_detected", "Number of people detected by YOLO")
cv_tracked_ids_gauge = Gauge("edge_cv_tracked_ids", "Number of active tracking IDs")
cv_dropped_frames_counter = Counter("edge_cv_dropped_frames_total", "Total dropped or failed frames")
cv_camera_status_gauge = Gauge("edge_cv_camera_status", "Camera online status (1=online, 0=offline)")
cv_mqtt_published_counter = Counter("edge_cv_mqtt_published_total", "Total MQTT messages published")


# ===========================================================================
# Lifespan
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _detector, _model_loaded, _age_estimator, _gender_estimator, _tracker, _frame_processor

    log.info("=== Edge-CV Service starting up ===")
    log.info("Service  : %s v%s", settings.service_name, settings.service_version)
    log.info("Host     : %s", _SERVICE_ID)
    log.info("Platform : %s %s", platform.system(), platform.release())
    log.info("Log level: %s", settings.log_level)

    # 1. Detector
    if settings.model_skip_load:
        log.info("MODEL_SKIP_LOAD=true — skipping YOLO model loading.")
    else:
        log.info("Loading YOLO model from: %s", settings.model_path)
        try:
            _detector = PersonDetector(
                model_path=settings.model_path,
                confidence=settings.model_confidence,
                device=settings.model_device,
            )
            _model_loaded = True
            log.info("YOLO model loaded — device: %s, confidence: %.2f", _detector.device, settings.model_confidence)
        except Exception as exc:
            _model_loaded = False
            log.error("Failed to load YOLO model: %s", exc, exc_info=True)
            log.warning("Service starting in DEGRADED mode — /detect will return 503.")

    # 2. Camera manager
    if settings.model_skip_load:
        log.info("Camera probe skipped (MODEL_SKIP_LOAD mode).")
        cv_camera_status_gauge.set(0)
    else:
        log.info("Probing camera source: %s", settings.camera_source)
        _camera_manager.probe()
        cv_camera_status_gauge.set(1 if _camera_manager.is_connected else 0)

    # 3. Demographics & Tracker
    _age_estimator = AgeEstimator()
    if settings.gender_enabled:
        _gender_estimator = GenderEstimator(
            model_path=settings.gender_model_path,
            confidence_threshold=settings.gender_confidence_threshold,
        )
    else:
        _gender_estimator = None

    try:
        _tracker = ByteTracker()
    except Exception as exc:
        log.error("Failed to initialize tracker: %s", exc)
        _tracker = None

    # 4. Assembled FrameProcessor
    if _detector is not None:
        _frame_processor = FrameProcessor(
            detector=_detector,
            tracker=_tracker,
            age_estimator=_age_estimator,
            gender_estimator=_gender_estimator,
        )

    # 5. MQTT Client
    log.info("Connecting to MQTT broker at %s:%s …", settings.mqtt_host, settings.mqtt_port)
    if _mqtt_client.connect():
        log.info("MQTT connected successfully.")
        from app.mqtt.topics import CommandTopics, config_topic

        def _handle_config_update(topic: str, payload: dict) -> None:
            log.info("[DEVICE] Pairing ack / config received on [%s]", topic)
            site_id = payload.get("siteId") or (payload.get("payload") or {}).get("siteId")
            zone_id = payload.get("zoneId") or (payload.get("payload") or {}).get("zoneId")
            from app.config import save_identity
            save_identity(site_id, zone_id)
            if site_id:
                log.info("[DEVICE] Device paired — deviceId=%s siteId=%s zoneId=%s", settings.device_id, site_id, zone_id)
            else:
                log.info("[DEVICE] Config update received — no siteId (device remains UNPAIRED)")

        def _handle_camera_command(topic: str, payload: dict) -> None:
            log.info("[DEVICE] Camera command received on [%s] — %s", topic, payload.get("payload"))
            action = payload.get("action")
            if action == "enable_detection":
                settings.enable_detection = True
            elif action == "disable_detection":
                settings.enable_detection = False
            elif action == "update_settings":
                new_settings = payload.get("payload", {})
                if "confidence" in new_settings:
                    settings.model_confidence = float(new_settings["confidence"])

        def _handle_model_update(topic: str, payload: dict) -> None:
            log.info("[DEVICE] Model update command received — %s", payload.get("payload"))

        def _handle_restart(topic: str, payload: dict) -> None:
            log.warning("[DEVICE] Restart command received — exiting process.")
            import signal
            os.kill(os.getpid(), signal.SIGTERM)

        if settings.device_id:
            _mqtt_client.register_handler(config_topic(settings.device_id), _handle_config_update)
            log.info("[DEVICE] Subscribed to pairing ack topic: %s", config_topic(settings.device_id))

        _mqtt_client.register_handler(CommandTopics.CAMERA, _handle_camera_command)
        _mqtt_client.register_handler(CommandTopics.MODEL_UPDATE, _handle_model_update)
        _mqtt_client.register_handler(CommandTopics.RESTART, _handle_restart)

        _mqtt_client.publish_health(
            service_id=_SERVICE_ID,
            status="healthy",
            metrics={"fps": 0.0, "memory_usage_bytes": _memory_usage_bytes()},
        )
    else:
        log.warning("MQTT not connected — service continues without real-time publishing.")

    log.info("=== Edge-CV Service ready ===")

    # 6. Periodic Discovery Loop
    async def discovery_loop() -> None:
        from app.mqtt.topics import EdgeTopics

        if not settings.device_id:
            log.warning("[DEVICE] No DEVICE_ID configured — discovery loop disabled.")
            return

        log.info("[DEVICE] Discovery loop started — deviceId=%s interval=%ds", settings.device_id, settings.heartbeat_interval)

        while True:
            if _mqtt_client.is_connected:
                try:
                    cpu = psutil.cpu_percent(interval=None)
                    mem = psutil.virtual_memory().percent
                    inner = {
                        "deviceId": settings.device_id,
                        "siteId": settings.site_id,
                        "zoneId": settings.zone_id,
                        "deviceType": "EDGE_CAMERA",
                        "status": _get_device_status(),
                        "hostname": _SERVICE_ID,
                        "platform": f"{platform.system()} {platform.release()}",
                        "ip": socket.gethostbyname(socket.gethostname()),
                        "resolution": "1920x1080",
                        "fps": 30,
                        "version": settings.service_version,
                        "firmwareVersion": "1.0.0",
                        "model": getattr(settings, "model_name", "yolov8n"),
                        "cpuUsage": cpu,
                        "memoryUsage": mem,
                        "streamUrl": f"http://{socket.gethostbyname(socket.gethostname())}:8001/snapshot",
                        "uptime": int(time.monotonic() - _start_time),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    envelope = _mqtt_client._envelope("discovery", inner)
                    raw_msg = json.dumps(envelope)
                    _mqtt_client._client.publish(EdgeTopics.DISCOVERY, raw_msg, qos=1)
                    _mqtt_client._client.publish(EdgeTopics.HEARTBEAT, raw_msg, qos=1)
                except Exception as exc:
                    log.error("[DEVICE] Discovery loop error: %s", exc, exc_info=True)
            await asyncio.sleep(settings.heartbeat_interval)

    task = asyncio.create_task(discovery_loop())

    yield

    task.cancel()
    log.info("=== Edge-CV Service shutting down ===")
    _mqtt_client.disconnect()
    _detector = None
    _model_loaded = False
    _age_estimator = None
    _gender_estimator = None
    _tracker = None
    _frame_processor = None
    log.info("=== Shutdown complete ===")


# ===========================================================================
# Application & Middleware
# ===========================================================================

app = FastAPI(
    title="IAD Edge-CV Service",
    description="Real-Time Person Detection & Demographics API — Express Display SmartVision",
    version=settings.service_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    excluded_handlers=["/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=True)


@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again.",
            "path": str(request.url.path),
        },
    )


def _uptime_str() -> str:
    elapsed = int(time.monotonic() - _start_time)
    days, remainder = divmod(elapsed, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s"


def _memory_usage_bytes() -> int:
    try:
        return psutil.Process(os.getpid()).memory_info().rss
    except Exception:
        return 0


def _cpu_usage_percent() -> float:
    try:
        return psutil.Process(os.getpid()).cpu_percent(interval=None)
    except Exception:
        return 0.0


# ===========================================================================
# Endpoints
# ===========================================================================

@app.get("/", summary="Root", tags=["Service"])
async def root() -> Dict[str, Any]:
    return {
        "message": "Welcome to the IAD Edge-CV Service API",
        "service": settings.service_name,
        "version": settings.service_version,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", summary="Health check", tags=["Monitoring"])
async def health() -> Dict[str, Any]:
    if _model_loaded and not settings.model_skip_load:
        overall = "healthy"
    elif settings.model_skip_load:
        overall = "ok"
    else:
        overall = "degraded"

    return {
        "service": settings.service_name,
        "status": overall,
        "version": settings.service_version,
        "model_loaded": _model_loaded,
        "mqtt_connected": _mqtt_client.is_connected,
        "camera_connected": _camera_manager.is_connected,
        "uptime": _uptime_str(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/status", summary="Runtime status", tags=["Monitoring"])
async def status() -> Dict[str, Any]:
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "uptime": _uptime_str(),
        "model_loaded": _model_loaded,
        "model_path": settings.model_path,
        "people_detected": _total_detections,
        "last_inference_ms": round(_last_inference_ms, 2),
        "camera": _camera_manager.status_str,
        "camera_source": _camera_manager.source,
        "mqtt_connected": _mqtt_client.is_connected,
        "mqtt_broker": f"{settings.mqtt_host}:{settings.mqtt_port}",
        "memory_mb": round(_memory_usage_bytes() / (1024 * 1024), 1),
        "cpu_percent": _cpu_usage_percent(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics/json", summary="JSON metrics", tags=["Monitoring"])
async def metrics_json() -> Dict[str, Any]:
    elapsed = time.monotonic() - _start_time
    mem_bytes = _memory_usage_bytes()
    return {
        "service": settings.service_name,
        "uptime_seconds": round(elapsed, 1),
        "fps": 0.0,
        "detections_total": _total_detections,
        "inference_ms": round(_last_inference_ms, 2),
        "memory_bytes": mem_bytes,
        "memory_mb": round(mem_bytes / (1024 * 1024), 1),
        "cpu_percent": _cpu_usage_percent(),
        "model_loaded": _model_loaded,
        "mqtt_connected": _mqtt_client.is_connected,
        "camera_connected": _camera_manager.is_connected,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/snapshot", summary="Capture a camera frame", tags=["Camera"])
async def snapshot() -> Response:
    if not _camera_manager.is_connected:
        raise HTTPException(status_code=503, detail="Caméra hors ligne")

    try:
        source = int(settings.camera_source)
    except Exception:
        source = settings.camera_source

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise HTTPException(status_code=503, detail="Impossible d'ouvrir la caméra")

    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise HTTPException(status_code=500, detail="Impossible de lire l'image de la caméra")

    success, encoded = cv2.imencode(".jpg", frame)
    if not success:
        raise HTTPException(status_code=500, detail="Impossible d'encoder l'image en JPEG")

    return Response(content=encoded.tobytes(), media_type="image/jpeg")


@app.post("/detect", summary="Run YOLO inference on an uploaded image", tags=["Detection"])
async def detect(
    file: UploadFile = File(..., description="Image file (JPEG, PNG, BMP)"),
) -> Dict[str, Any]:
    global _total_detections, _last_inference_ms

    if not _model_loaded:
        if settings.model_skip_load:
            return {
                "detections": [],
                "inference_ms": 0.0,
                "person_count": 0,
                "processing_ms": 0.0,
                "model_loaded": False,
            }
        raise HTTPException(
            status_code=503,
            detail={
                "error": "model_not_loaded",
                "message": "Le modèle YOLO n'a pas pu être chargé au démarrage.",
            },
        )

    if file is None or file.filename is None:
        raise HTTPException(status_code=400, detail={"error": "missing_file", "message": "Aucun fichier image."})

    content_type = (file.content_type or "").lower()
    allowed_mime_prefixes = ("image/", "application/octet-stream", "")
    if not any(content_type.startswith(prefix) for prefix in allowed_mime_prefixes):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_content_type", "message": f"Type de contenu '{file.content_type}' invalide."},
        )

    try:
        contents = await file.read()
    except Exception as exc:
        log.error("Failed to read uploaded file: %s", exc)
        raise HTTPException(status_code=400, detail={"error": "file_read_error", "message": "Lecture échouée."}) from exc

    if not contents:
        raise HTTPException(status_code=400, detail={"error": "empty_file", "message": "Fichier vide."})

    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        cv_dropped_frames_counter.inc()
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_image", "message": "Fichier image invalide ou corrompu."},
        )

    # Process frame through modular FrameProcessor pipeline
    try:
        assert _frame_processor is not None
        pipeline_res: ProcessedFrameResult = _frame_processor.process_frame(frame)
    except Exception as exc:
        cv_dropped_frames_counter.inc()
        log.error("Pipeline processing failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "inference_error", "message": "Le traitement de l'image a échoué."},
        ) from exc

    person_count = pipeline_res.person_count
    _total_detections += person_count
    _last_inference_ms = pipeline_res.inference_ms

    cv_yolo_latency_hist.observe(pipeline_res.inference_ms / 1000.0)
    cv_people_detected_gauge.set(person_count)
    cv_processing_latency_hist.observe(pipeline_res.processing_ms / 1000.0)
    cv_tracked_ids_gauge.set(person_count)
    if pipeline_res.processing_ms > 0:
        cv_fps_gauge.set(1000.0 / pipeline_res.processing_ms)

    log.info(
        "[IAD] Detection: peopleCount=%d | inference=%.1f ms | processing=%.1f ms",
        person_count,
        pipeline_res.inference_ms,
        pipeline_res.processing_ms,
    )

    # Publish events to MQTT
    if _mqtt_client.is_connected:
        cv_mqtt_published_counter.inc()
        detection_items = []
        for det in pipeline_res.detections:
            item = {
                "track_id": det.get("track_id"),
                "confidence": det.get("confidence", 1.0),
                "age_group": det.get("age_group", "adult"),
                "estimated_age": det.get("age"),
                "gender": det.get("gender", "unknown"),
            }
            if "gender_confidence" in det:
                item["gender_confidence"] = det["gender_confidence"]
            detection_items.append(item)

        _mqtt_client.publish_detections(
            person_count=person_count,
            inference_msec=pipeline_res.inference_ms,
            processing_msec=pipeline_res.processing_ms,
            detections=detection_items,
        )

        if person_count > 0:
            _mqtt_client.publish_crowd_density(count=person_count, density=pipeline_res.density)

        track_ids = [d.get("track_id") for d in pipeline_res.detections if d.get("track_id") is not None]
        _mqtt_client.publish_tracking(
            active_count=person_count,
            track_ids=track_ids,
            fps=1000.0 / max(pipeline_res.processing_ms, 1.0),
        )

    return {
        "detections": pipeline_res.detections,
        "inference_ms": round(pipeline_res.inference_ms, 2),
        "person_count": person_count,
        "processing_ms": round(pipeline_res.processing_ms, 2),
    }


# ===========================================================================
# CLI Fallback Entry Point
# ===========================================================================

if __name__ == "__main__":
    from app.cli import main as cli_main
    cli_main()
