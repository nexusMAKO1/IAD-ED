"""
main.py — Edge-CV Service Entry Point
IAD & SmartQueue AI — Express Display SmartVision (T-009)

Production-ready FastAPI application that:

  • Loads configuration from environment variables (app.config.AppSettings)
  • Initialises all Edge-CV services during lifespan startup:
      - YOLO detector (PersonDetector)
      - Camera manager (CameraManager)
      - MQTT client (MQTTClient)
  • Exposes the following HTTP endpoints:
      GET  /          — welcome / root
      GET  /health    — liveness + dependency status
      POST /detect    — multipart image → YOLO inference
      GET  /status    — runtime telemetry
      GET  /metrics   — Prometheus-compatible metrics
  • Configures structured logging, CORS middleware, and a global exception
    handler so every unhandled error returns a proper JSON 500 response.

Running locally:
    uvicorn app.main:app --reload

Docker:
    uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 2
"""

from __future__ import annotations

import logging
import os
import platform
import socket
import time
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import cv2
import numpy as np
import psutil
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge, Counter, Histogram

# ---------------------------------------------------------------------------
# Internal imports — support both "uvicorn app.main:app" and "python main.py"
# ---------------------------------------------------------------------------
import sys
from pathlib import Path

if __package__ is None or __package__ == "":
    # Executed directly as a script. Add the root of `apps/edge-cv` to sys.path
    # so that `from app.config import ...` works.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.detector import DetectionResult, PersonDetector
from app.services.camera_manager import CameraManager
from app.services.mqtt_client import MQTTClient
from app.demographics.age_estimation import AgeEstimator
from app.tracking.bytetrack import ByteTracker

# ---------------------------------------------------------------------------
# Logging — structured, level driven by LOG_LEVEL env-var
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("iad.edge-cv")

# ---------------------------------------------------------------------------
# Application-level state
# Shared across requests via module globals — FastAPI lifespan initialises
# these before the first request is accepted.
# ---------------------------------------------------------------------------
_detector: Optional[PersonDetector] = None
_model_loaded: bool = False
_age_estimator: Optional[AgeEstimator] = None
_tracker: Optional[ByteTracker] = None
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

# Startup timestamp for uptime calculation
_start_time: float = time.monotonic()

# Rolling metrics updated by the /detect endpoint
_total_detections: int = 0
_last_inference_ms: float = 0.0

# ---------------------------------------------------------------------------
# Service identifier (hostname — used in MQTT heartbeats)
# ---------------------------------------------------------------------------
_SERVICE_ID: str = socket.gethostname()

# ---------------------------------------------------------------------------
# Custom Prometheus Metrics
# ---------------------------------------------------------------------------
cv_fps_gauge = Gauge("edge_cv_fps", "Current estimated frames per second")
cv_yolo_latency_hist = Histogram(
    "edge_cv_yolo_latency_seconds", "YOLOv8 inference latency"
)
cv_processing_latency_hist = Histogram(
    "edge_cv_processing_latency_seconds", "Total frame processing latency"
)
cv_people_detected_gauge = Gauge(
    "edge_cv_people_detected", "Number of people detected by YOLO"
)
cv_tracked_ids_gauge = Gauge("edge_cv_tracked_ids", "Number of active tracking IDs")
cv_dropped_frames_counter = Counter(
    "edge_cv_dropped_frames_total", "Total dropped or failed frames"
)
cv_camera_status_gauge = Gauge(
    "edge_cv_camera_status", "Camera online status (1=online, 0=offline)"
)
cv_mqtt_published_counter = Counter(
    "edge_cv_mqtt_published_total", "Total MQTT messages published"
)


# ===========================================================================
# Lifespan — initialises all services before the first request is served
# ===========================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    """
    FastAPI lifespan context manager.

    Startup phase (before yield):
      1. Load YOLO model (unless MODEL_SKIP_LOAD=true)
      2. Probe camera availability
      3. Connect to MQTT broker (non-blocking; failure is non-fatal)

    Shutdown phase (after yield):
      4. Disconnect MQTT gracefully
      5. Release model references
    """
    global _detector, _model_loaded, _age_estimator

    log.info("=== Edge-CV Service starting up ===")
    log.info("Service  : %s v%s", settings.service_name, settings.service_version)
    log.info("Host     : %s", _SERVICE_ID)
    log.info("Platform : %s %s", platform.system(), platform.release())
    log.info("Log level: %s", settings.log_level)

    # ------------------------------------------------------------------
    # 1. YOLO detector
    # ------------------------------------------------------------------
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
            log.info(
                "YOLO model loaded — device: %s, confidence: %.2f",
                _detector.device,
                settings.model_confidence,
            )
        except Exception as exc:
            _model_loaded = False
            log.error("Failed to load YOLO model: %s", exc, exc_info=True)
            log.warning("Service starting in DEGRADED mode — /detect will return 503.")

    # ------------------------------------------------------------------
    # 2. Camera manager
    # ------------------------------------------------------------------
    if settings.model_skip_load:
        # In CI / test mode skip hardware probe; camera reported as offline
        log.info("Camera probe skipped (MODEL_SKIP_LOAD mode).")
        cv_camera_status_gauge.set(0)
    else:
        log.info("Probing camera source: %s", settings.camera_source)
        _camera_manager.probe()
        cv_camera_status_gauge.set(1 if _camera_manager.is_connected else 0)

    # ------------------------------------------------------------------
    # 2.5. Age estimator
    # ------------------------------------------------------------------
    log.info("Initializing Age Estimation module...")
    _age_estimator = AgeEstimator()

    # ------------------------------------------------------------------
    # 2.6. Multi-Object Tracker (ByteTrack)
    # ------------------------------------------------------------------
    log.info("Initializing ByteTrack multi-object tracker...")
    try:
        _tracker = ByteTracker()
    except Exception as exc:
        log.error("Failed to initialize tracker: %s", exc)
        _tracker = None

    # ------------------------------------------------------------------
    # 3. MQTT client
    # ------------------------------------------------------------------
    log.info(
        "Connecting to MQTT broker at %s:%s …", settings.mqtt_host, settings.mqtt_port
    )
    mqtt_ok = _mqtt_client.connect()
    if mqtt_ok:
        log.info("MQTT connected successfully.")
        # Register command handlers
        from app.mqtt.topics import CommandTopics, config_topic

        def _handle_config_update(topic: str, payload: dict) -> None:
            """
            Handles config pushes from the backend — including pairing acks.

            When the backend registers a new device it publishes the assigned
            siteId back to smartvision/edge/{deviceId}/config.  We persist
            that assignment in identity.json so it survives restarts.
            """
            log.info("[DEVICE] Pairing ack / config received on [%s]", topic)
            site_id = payload.get("siteId") or (payload.get("payload") or {}).get("siteId")
            zone_id = payload.get("zoneId") or (payload.get("payload") or {}).get("zoneId")

            from app.config import save_identity
            save_identity(site_id, zone_id)

            if site_id:
                log.info(
                    "[DEVICE] Device paired — deviceId=%s siteId=%s zoneId=%s",
                    settings.device_id,
                    site_id,
                    zone_id,
                )
            else:
                log.info(
                    "[DEVICE] Config update received — no siteId (device remains UNPAIRED)"
                )

        def _handle_camera_command(topic: str, payload: dict) -> None:
            log.info("[DEVICE] Camera command received on [%s] — %s", topic, payload.get("payload"))
            # Depending on action, we could toggle features
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
            import os
            import signal
            os.kill(os.getpid(), signal.SIGTERM)

        # Device-specific config / pairing ack topic
        if settings.device_id:
            _mqtt_client.register_handler(config_topic(settings.device_id), _handle_config_update)
            log.info("[DEVICE] Subscribed to pairing ack topic: %s", config_topic(settings.device_id))

        _mqtt_client.register_handler(CommandTopics.CAMERA,       _handle_camera_command)
        _mqtt_client.register_handler(CommandTopics.MODEL_UPDATE,  _handle_model_update)
        _mqtt_client.register_handler(CommandTopics.RESTART,       _handle_restart)

        _mqtt_client.publish_health(
            service_id=_SERVICE_ID,
            status="healthy",
            metrics={"fps": 0.0, "memory_usage_bytes": _memory_usage_bytes()},
        )
    else:
        log.warning(
            "MQTT not connected — service continues without real-time publishing."
        )

    log.info("=== Edge-CV Service ready ===")

    # ------------------------------------------------------------------
    # Background tasks
    # ------------------------------------------------------------------
    import asyncio

    async def discovery_loop() -> None:
        """
        Publishes device identity to MQTT every heartbeat_interval seconds.

        Publishes to TWO topics on each cycle:
          1. smartvision/edge/discovery  — triggers DeviceRegistryService.handleHeartbeat()
             which creates/updates the Device record in PostgreSQL.
          2. smartvision/edge/heartbeat  — triggers the dedicated HEARTBEAT subscriber
             in DeviceRegistryService (updates lastHeartbeat / status).

        The loop runs indefinitely; it skips a cycle if MQTT is not connected.
        """
        from app.mqtt.topics import EdgeTopics

        if not settings.device_id:
            log.warning(
                "[DEVICE] No DEVICE_ID configured — MQTT discovery loop disabled. "
                "Set DEVICE_ID (or EDGE_CV_DEVICE_ID) in docker-compose.yml or .env "
                "to enable automatic camera registration."
            )
            return

        log.info(
            "[DEVICE] Discovery loop started — deviceId=%s interval=%ds",
            settings.device_id,
            settings.heartbeat_interval,
        )

        while True:
            if _mqtt_client.is_connected:
                try:
                    import psutil as _psutil
                    cpu = _psutil.cpu_percent(interval=None)
                    mem = _psutil.virtual_memory().percent

                    # Build the inner payload (all device metadata)
                    inner = {
                        "deviceId":       settings.device_id,
                        "siteId":         settings.site_id,
                        "zoneId":         settings.zone_id,
                        "deviceType":     "EDGE_CAMERA",
                        "status":         _get_device_status(),
                        "hostname":       _SERVICE_ID,
                        "platform":       f"{platform.system()} {platform.release()}",
                        "ip":             socket.gethostbyname(socket.gethostname()),
                        "resolution":     "1920x1080",
                        "fps":            30,
                        "version":        settings.service_version,
                        "firmwareVersion": "1.0.0",
                        "model":          getattr(settings, "model_name", "yolov8n"),
                        "cpuUsage":       cpu,
                        "memoryUsage":    mem,
                        "streamUrl":      (
                            f"http://{socket.gethostbyname(socket.gethostname())}:8001/snapshot"
                        ),
                        "uptime":         int(time.monotonic() - _start_time),
                        "timestamp":      datetime.now(timezone.utc).isoformat(),
                    }

                    envelope = _mqtt_client._envelope("discovery", inner)
                    raw_msg  = json.dumps(envelope)

                    # 1. Publish to DISCOVERY topic (creates/updates Device record)
                    result_d = _mqtt_client._client.publish(
                        EdgeTopics.DISCOVERY, raw_msg, qos=1
                    )
                    if result_d.rc == 0:
                        log.info(
                            "[DEVICE] Discovery published — deviceId=%s status=%s",
                            settings.device_id,
                            inner["status"],
                        )
                    else:
                        log.warning(
                            "[DEVICE] Discovery publish failed (rc=%d)", result_d.rc
                        )

                    # 2. Publish to HEARTBEAT topic (updates lastHeartbeat / status)
                    result_h = _mqtt_client._client.publish(
                        EdgeTopics.HEARTBEAT, raw_msg, qos=1
                    )
                    if result_h.rc != 0:
                        log.debug(
                            "[DEVICE] Heartbeat publish failed (rc=%d)", result_h.rc
                        )

                except Exception as exc:
                    log.error("[DEVICE] Discovery loop error: %s", exc, exc_info=True)
            else:
                log.debug(
                    "[DEVICE] MQTT not connected — skipping discovery heartbeat"
                )

            await asyncio.sleep(settings.heartbeat_interval)

    task = asyncio.create_task(discovery_loop())


    # ------------------------------------------------------------------
    # Yield — serve requests
    # ------------------------------------------------------------------
    yield

    task.cancel()

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------
    log.info("=== Edge-CV Service shutting down ===")
    _mqtt_client.disconnect()
    _detector = None
    _model_loaded = False
    _age_estimator = None
    _tracker = None
    log.info("=== Shutdown complete ===")


# ===========================================================================
# FastAPI application instance
# ===========================================================================

app = FastAPI(
    title="IAD Edge-CV Service",
    description=(
        "Real-Time Person Detection API — Express Display SmartVision\n\n"
        "Powered by FastAPI + Ultralytics YOLOv8n"
    ),
    version=settings.service_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ===========================================================================
# Middleware
# ===========================================================================

# CORS — allow configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus instrumentation — exposes /metrics endpoint automatically
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    excluded_handlers=["/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=True)

# ===========================================================================
# Global exception handler
# ===========================================================================


@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unhandled exceptions.

    Returns a JSON 500 body so API consumers always receive structured output
    rather than a plain-text traceback.
    """
    log.exception(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again.",
            "path": str(request.url.path),
        },
    )


# ===========================================================================
# Helper utilities
# ===========================================================================


def _uptime_str() -> str:
    """Return a human-readable uptime string (e.g. '0d 02h 15m 33s')."""
    elapsed = int(time.monotonic() - _start_time)
    days, remainder = divmod(elapsed, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s"


def _memory_usage_bytes() -> int:
    """Return current process RSS memory usage in bytes."""
    try:
        proc = psutil.Process(os.getpid())
        return proc.memory_info().rss
    except Exception:
        return 0


def _cpu_usage_percent() -> float:
    """Return process CPU utilisation (1-second interval)."""
    try:
        proc = psutil.Process(os.getpid())
        return proc.cpu_percent(interval=None)  # non-blocking
    except Exception:
        return 0.0


# ===========================================================================
# Endpoints
# ===========================================================================

# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------


@app.get(
    "/",
    summary="Root",
    tags=["Service"],
    response_description="Welcome message and service metadata",
)
async def root() -> Dict[str, Any]:
    """
    Root endpoint — confirms the service is alive.

    Returns a welcome message alongside the service name and version.
    Useful for quick smoke-testing from cURL or a browser.
    """
    return {
        "message": "Welcome to the IAD Edge-CV Service API",
        "service": settings.service_name,
        "version": settings.service_version,
        "docs": "/docs",
        "health": "/health",
    }


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


@app.get(
    "/health",
    summary="Health check",
    tags=["Monitoring"],
    response_description="Service health and dependency status",
)
async def health() -> Dict[str, Any]:
    """
    Liveness and dependency-health endpoint.

    Returns HTTP 200 in all cases so Docker / orchestrators can distinguish
    between a *running-but-degraded* container and a *crashed* container.
    The ``status`` field encodes the actual state:

    * ``"healthy"``  — all components operational
    * ``"degraded"`` — service is running but one or more components failed
    """
    # Determine overall health status
    if _model_loaded and not settings.model_skip_load:
        overall = "healthy"
    elif settings.model_skip_load:
        # Running in skip-load mode — model intentionally not loaded
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


# ---------------------------------------------------------------------------
# GET /status
# ---------------------------------------------------------------------------


@app.get(
    "/status",
    summary="Runtime status",
    tags=["Monitoring"],
    response_description="Live runtime telemetry",
)
async def status() -> Dict[str, Any]:
    """
    Runtime telemetry endpoint.

    Returns operational data collected since startup: detection counts,
    last inference timing, camera state, MQTT state, and process uptime.
    This is intended for operator dashboards and CI health gates — not for
    automated Prometheus scraping (use ``/metrics`` for that).
    """
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


# ---------------------------------------------------------------------------
# GET /metrics  (Prometheus-compatible JSON + Prometheus text)
# ---------------------------------------------------------------------------
# NOTE: The Prometheus text-format endpoint at /metrics is auto-exposed
# by prometheus-fastapi-instrumentator above.  The endpoint below is an
# *additional* JSON endpoint that returns the same core metrics in a
# human-readable format for dashboards / debugging.


@app.get(
    "/metrics/json",
    summary="JSON metrics",
    tags=["Monitoring"],
    response_description="Key metrics in JSON format (alternative to /metrics)",
)
async def metrics_json() -> Dict[str, Any]:
    """
    JSON-format metrics — useful for quick inspection and non-Prometheus consumers.

    For the Prometheus text format used by ``prometheus.yml`` scraping,
    see ``GET /metrics`` (auto-exposed by prometheus-fastapi-instrumentator).
    """
    elapsed = time.monotonic() - _start_time
    mem_bytes = _memory_usage_bytes()

    return {
        "service": settings.service_name,
        "uptime_seconds": round(elapsed, 1),
        "fps": 0.0,  # populated by a future streaming loop
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


# ---------------------------------------------------------------------------
# GET /snapshot
# ---------------------------------------------------------------------------

@app.get(
    "/snapshot",
    summary="Capture a camera frame",
    tags=["Camera"],
    responses={
        200: {
            "content": {"image/jpeg": {}}
        }
    }
)
async def snapshot():
    from fastapi.responses import Response
    if not _camera_manager.is_connected:
        raise HTTPException(status_code=503, detail="Caméra hors ligne")
        
    try:
        source = int(settings.camera_source)
    except Exception:
        source = settings.camera_source
        
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise HTTPException(status_code=503, detail="Impossible d\\'ouvrir la caméra")
        
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        raise HTTPException(status_code=500, detail="Impossible de lire l\\'image de la caméra")
        
    success, encoded = cv2.imencode(".jpg", frame)
    if not success:
        raise HTTPException(status_code=500, detail="Impossible d\\'encoder l\\'image en JPEG")
        
    return Response(content=encoded.tobytes(), media_type="image/jpeg")

# ---------------------------------------------------------------------------
# POST /detect
# ---------------------------------------------------------------------------


@app.post(
    "/detect",
    summary="Run YOLO inference on an uploaded image",
    tags=["Detection"],
    response_description="Bounding boxes, confidence scores, and timing",
)
async def detect(
    file: UploadFile = File(..., description="Image file (JPEG, PNG, BMP)"),
) -> Dict[str, Any]:
    """
    Run YOLOv8 person detection on an uploaded image.

    **Request** — ``multipart/form-data`` with a single ``file`` field
    containing any OpenCV-readable image (JPEG, PNG, BMP, TIFF…).

    **Response**
    ```json
    {
        "detections": [
            {"x1": 10, "y1": 20, "x2": 100, "y2": 200,
             "confidence": 0.92, "class_id": 0, "label": "person"}
        ],
        "inference_ms": 23.4,
        "person_count": 1,
        "processing_ms": 25.1
    }
    ```

    **Error codes**
    - ``400 Bad Request``  — image is invalid / unreadable
    - ``422 Unprocessable Entity`` — no file provided
    - ``503 Service Unavailable`` — YOLO model not loaded
    """
    global _total_detections, _last_inference_ms

    t_start = time.perf_counter()

    # ------------------------------------------------------------------ #
    # Guard: model availability
    # ------------------------------------------------------------------ #
    if not _model_loaded:
        if settings.model_skip_load:
            # CI / test mode — return a valid empty result
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
                "message": (
                    "Le modèle YOLO n'a pas pu être chargé au démarrage. "
                    "Vérifiez les journaux du service et la configuration MODEL_PATH."
                ),
            },
        )

    # ------------------------------------------------------------------ #
    # Guard: file presence and content-type
    # ------------------------------------------------------------------ #
    if file is None or file.filename is None:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_file", "message": "Aucun fichier image n'a été fourni."},
        )

    content_type = (file.content_type or "").lower()
    allowed_mime_prefixes = ("image/", "application/octet-stream", "")
    if not any(content_type.startswith(prefix) for prefix in allowed_mime_prefixes):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_content_type",
                "message": (
                    f"Fichier image attendu mais type de contenu '{file.content_type}' reçu."
                ),
            },
        )

    # ------------------------------------------------------------------ #
    # Read and decode image bytes
    # ------------------------------------------------------------------ #
    try:
        contents = await file.read()
    except Exception as exc:
        log.error("Failed to read uploaded file: %s", exc)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "file_read_error",
                "message": "Impossible de lire le fichier téléchargé.",
            },
        ) from exc

    if not contents:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_file", "message": "Le fichier téléchargé est vide."},
        )

    # Decode bytes → NumPy array → BGR frame
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        cv_dropped_frames_counter.inc()
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_image",
                "message": (
                    "Le fichier téléchargé n'a pas pu être décodé en tant qu'image. "
                    "Assurez-vous qu'il s'agit d'un fichier JPEG, PNG, BMP ou TIFF valide."
                ),
            },
        )

    # ------------------------------------------------------------------ #
    # YOLO inference
    # ------------------------------------------------------------------ #
    try:
        assert _detector is not None  # guaranteed by _model_loaded guard above
        result: DetectionResult = _detector.detect(frame)
        cv_yolo_latency_hist.observe(result.inference_ms / 1000.0)
        cv_people_detected_gauge.set(result.person_count)
    except Exception as exc:
        cv_dropped_frames_counter.inc()
        log.error("YOLO inference failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "inference_error",
                "message": "L'inférence YOLO a échoué. Consultez les journaux du service pour plus de détails.",
            },
        ) from exc

    # ------------------------------------------------------------------ #
    # Tracker update
    # ------------------------------------------------------------------ #
    try:
        assert _tracker is not None
        raw_input = [
            {"bbox": [d.x1, d.y1, d.x2, d.y2], "confidence": d.confidence}
            for d in result.detections
        ]
        h, w = frame.shape[:2]
        tracked_people = _tracker.update(raw_input, frame_h=h, frame_w=w)
    except Exception as exc:
        log.warning("Tracker failed: %s", exc)
        tracked_people = []

    person_count = len(tracked_people)

    # ------------------------------------------------------------------ #
    # Update rolling metrics
    # ------------------------------------------------------------------ #
    _total_detections += person_count
    _last_inference_ms = result.inference_ms

    # ------------------------------------------------------------------ #
    # Build response
    # ------------------------------------------------------------------ #
    t_end = time.perf_counter()
    processing_ms = (t_end - t_start) * 1000.0

    cv_processing_latency_hist.observe(processing_ms / 1000.0)
    cv_tracked_ids_gauge.set(person_count)
    if processing_ms > 0:
        cv_fps_gauge.set(1000.0 / processing_ms)

    detections_list = []
    if tracked_people:
        # Prepare list for age estimator
        raw_detections = [
            {"bbox": p.bbox, "confidence": p.confidence} for p in tracked_people
        ]

        # Estimate age for each detected person
        try:
            assert _age_estimator is not None
            age_results = _age_estimator.estimate(frame, raw_detections)
        except Exception as exc:
            log.warning("Age estimation failed: %s", exc)
            age_results = []

        for i, p in enumerate(tracked_people):
            det_info = {
                "track_id": p.track_id,
                "x1": p.bbox[0],
                "y1": p.bbox[1],
                "x2": p.bbox[2],
                "y2": p.bbox[3],
                "confidence": round(p.confidence, 4),
                "class_id": 0,
                "label": p.class_name,
            }
            # Merge age estimation results if available
            if i < len(age_results):
                det_info["age"] = age_results[i]["age"]
                det_info["age_group"] = age_results[i]["age_group"]
                det_info["age_confidence"] = age_results[i]["confidence"]
            detections_list.append(det_info)

    log.info(
        "[IAD] Detection: peopleCount=%d | inference=%.1f ms | processing=%.1f ms",
        person_count,
        result.inference_ms,
        processing_ms,
    )

    # Publish detection event to MQTT using the proper BaseEvent envelope.
    # Always publish (even when person_count == 0) so the backend can clear
    # currentVisitors when the scene is empty.
    if _mqtt_client.is_connected:
        cv_mqtt_published_counter.inc()
        log.info(
            "[IAD] Publishing audience event — topic=smartvision/edge/detections peopleCount=%d",
            person_count,
        )
        # Build properly-typed detection items for the backend DTO
        detection_items = []
        for det in detections_list:
            detection_items.append({
                "track_id": det.get("track_id"),
                "confidence": det.get("confidence", 1.0),
                "age_group": det.get("age_group", "adult"),
                "estimated_age": det.get("age"),
            })
        _mqtt_client.publish_detections(
            person_count=person_count,
            inference_msec=result.inference_ms,
            processing_msec=processing_ms,
            detections=detection_items,
        )
        # Also publish crowd density for the live density gauge
        if person_count > 0:
            if person_count >= 20:
                density = "critical"
            elif person_count >= 10:
                density = "high"
            elif person_count >= 5:
                density = "medium"
            else:
                density = "low"
            _mqtt_client.publish_crowd_density(count=person_count, density=density)
        # Also publish tracking update for the live visitor counter
        track_ids = [d.get("track_id") for d in detections_list if d.get("track_id") is not None]
        _mqtt_client.publish_tracking(
            active_count=person_count,
            track_ids=track_ids,
            fps=1000.0 / max(processing_ms, 1.0),
        )

    return {
        "detections": detections_list,
        "inference_ms": round(result.inference_ms, 2),
        "person_count": person_count,
        "processing_ms": round(processing_ms, 2),
    }


# ===========================================================================
# CLI entry-point — kept for backwards compatibility with the original T-003
# POC script.  When invoked directly (python main.py), the CLI loop from the
# original implementation runs.  When imported by uvicorn, only `app` is used.
# ===========================================================================


def _cli_main() -> None:  # pragma: no cover
    """
    CLI fallback entry point (legacy T-003 POC behaviour).

    Imports and runs the original argument-driven loop so that:
        python app/main.py --source 0
    still works exactly as before.
    """
    import argparse
    import signal
    import sys

    try:
        from app.utils import (
            FPSCounter,
            LatencyTracker,
            PerformanceLogger,
            draw_detections,
            draw_hud,
            draw_tracked_persons,
        )
        from app.video_stream import VideoStream
        from app.tracking.bytetrack import ByteTracker as _ByteTracker
        from app.demographics.age_estimation import AgeEstimator as _AgeEstimator
    except ImportError:
        from utils import (  # type: ignore[no-redef]
            FPSCounter,
            LatencyTracker,
            PerformanceLogger,
            draw_detections,
            draw_hud,
            draw_tracked_persons,
        )
        from video_stream import VideoStream  # type: ignore[no-redef]
        from tracking.bytetrack import ByteTracker as _ByteTracker  # type: ignore[no-redef]
        from demographics.age_estimation import AgeEstimator as _AgeEstimator  # type: ignore[no-redef]

    parser = argparse.ArgumentParser(
        description="IAD Edge-CV — Real-Time Person Detection (CLI)"
    )
    parser.add_argument(
        "--source", default=0, help="Video source (int index, file path, RTSP URL)"
    )
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--conf", type=float, default=0.40)
    parser.add_argument("--device", default="")
    parser.add_argument("--half", action="store_true")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--log-csv", default=None, metavar="PATH")
    parser.add_argument("--export-onnx", action="store_true")
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    args = parser.parse_args()

    _shutdown = False

    def _sig(sig: int, frame: object) -> None:
        nonlocal _shutdown
        log.info("Shutdown signal — stopping.")
        _shutdown = True

    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    try:
        source = int(args.source)
    except (ValueError, TypeError):
        source = str(args.source)

    cli_detector = PersonDetector(
        model_path=args.model,
        confidence=args.conf,
        device=args.device,
        half=args.half,
    )

    if args.export_onnx:
        out = cli_detector.export_onnx("yolov8n_person.onnx")
        log.info("ONNX exported to: %s", out)
        return

    # ── Age estimation: estimate every N frames OR every 500 ms ────────────
    # Either condition triggers a fresh inference run.  The cached label
    # (a display string such as "Adult") is shown on all other frames so
    # the overlay never goes blank between refreshes.
    AGE_ESTIMATE_EVERY_N: int = 10        # frame-count gate
    AGE_ESTIMATE_INTERVAL_MS: float = 500.0  # wall-clock gate (milliseconds)

    # Instantiate a CLI-scoped ByteTracker and AgeEstimator.
    # These are separate instances from the FastAPI lifespan objects so the
    # CLI mode is entirely self-contained and does not touch the REST state.
    cli_tracker = _ByteTracker()
    cli_age_estimator = _AgeEstimator()   # no ONNX model → runs heuristic fallback

    # Connect MQTT for publishing events from CLI mode
    global _mqtt_client
    if _mqtt_client.connect():
        log.info("CLI Mode: MQTT connected.")
    else:
        log.warning("CLI Mode: MQTT connection failed.")

    # track_id → age group display string (e.g. "Adult", "Unknown").
    # Populated lazily; reused across frames to avoid redundant inference.
    age_cache: Dict[int, str] = {}
    _last_age_estimate_time: float = 0.0   # time.perf_counter() timestamp

    fps_counter = FPSCounter(window=30)
    latency_tracker = LatencyTracker(window=30)
    perf_logger = PerformanceLogger(args.log_csv) if args.log_csv else None
    frame_count = 0

    try:
        stream = VideoStream(
            source=source, width=args.width, height=args.height
        ).start()
    except (RuntimeError, ValueError) as exc:
        log.error("Cannot open video source: %s", exc)
        sys.exit(1)

    log.info("Stream started — press 'q' to quit.")

    # Throttle MQTT detection publishes: at most once per second
    _last_detection_publish_time: float = 0.0
    DETECTION_PUBLISH_INTERVAL_S: float = 1.0

    try:
        import time as _time

        while not _shutdown:
            ret, frame = stream.read()
            if not ret or frame is None:
                _time.sleep(0.005)
                continue

            result = cli_detector.detect(frame)
            latency_tracker.record(result.inference_ms)
            fps_counter.tick()
            frame_count += 1
            current_fps = fps_counter.fps
            avg_latency = latency_tracker.average_ms

            # ── ByteTracker update ────────────────────────────────────────────
            raw_dets = [
                {"bbox": [d.x1, d.y1, d.x2, d.y2], "confidence": d.confidence}
                for d in result.detections
            ]
            h, w = frame.shape[:2]
            try:
                tracked_people = cli_tracker.update(raw_dets, frame_h=h, frame_w=w)
            except Exception as trk_exc:
                log.debug("Tracker error (skipping frame): %s", trk_exc)
                tracked_people = []

            person_count_cli = len(tracked_people)

            # ── Age estimation (throttled: every N frames OR every 500 ms) ──
            now_ms = time.perf_counter() * 1000.0
            time_gate = (now_ms - _last_age_estimate_time) >= AGE_ESTIMATE_INTERVAL_MS
            frame_gate = (frame_count % AGE_ESTIMATE_EVERY_N == 0)

            if (frame_gate or time_gate) and tracked_people:
                age_dets = [
                    {"bbox": p.bbox, "confidence": p.confidence}
                    for p in tracked_people
                ]
                try:
                    age_results = cli_age_estimator.estimate(frame, age_dets)
                except Exception as age_exc:
                    log.debug("Age estimation error: %s", age_exc)
                    age_results = []

                for person, age_info in zip(tracked_people, age_results):
                    raw_age = age_info.get("age")
                    if raw_age is not None:
                        # Convert numerical age → privacy-friendly display label
                        group_label = cli_age_estimator.age_group_label(float(raw_age))
                        prev = age_cache.get(person.track_id)
                        age_cache[person.track_id] = group_label

                        # Log only when the group changes for this track
                        if prev != group_label:
                            log.info(
                                "[IAD] Track %d Age Group: %s",
                                person.track_id,
                                group_label,
                            )

                _last_age_estimate_time = now_ms

            # ── Evict ages for tracks that are no longer active ───────────────
            active_ids = {p.track_id for p in tracked_people}
            stale_ids = [tid for tid in age_cache if tid not in active_ids]
            for tid in stale_ids:
                del age_cache[tid]

            # ── MQTT: Publish detection event (throttled to 1/s) ─────────────
            now_s = time.perf_counter()
            if _mqtt_client.is_connected and (now_s - _last_detection_publish_time) >= DETECTION_PUBLISH_INTERVAL_S:
                _last_detection_publish_time = now_s

                # Build detection items with age group from cache
                detection_items = []
                for person in tracked_people:
                    group_label = age_cache.get(person.track_id, "adult")
                    # Normalise age group label to backend-expected values
                    group_norm = group_label.lower().replace(" ", "_")
                    # Map display labels → backend age_group enum values
                    group_map = {
                        "child": "child",
                        "teen": "teen",
                        "young": "young_adult",
                        "young_adult": "young_adult",
                        "adult": "adult",
                        "senior": "senior",
                        "unknown": "adult",
                    }
                    age_group = group_map.get(group_norm, "adult")
                    detection_items.append({
                        "track_id": person.track_id,
                        "confidence": round(person.confidence, 4),
                        "age_group": age_group,
                    })

                log.info(
                    "[IAD] Detection: peopleCount=%d | fps=%.1f | siteId=%s",
                    person_count_cli,
                    current_fps,
                    settings.site_id or "UNPAIRED",
                )

                if not settings.site_id:
                    log.warning("[IAD] Device is UNPAIRED — detection events will be ignored by backend")
                else:
                    log.info(
                        "[IAD] Publishing detection event — topic=smartvision/edge/detections"
                    )
                    ok = _mqtt_client.publish_detections(
                        person_count=person_count_cli,
                        inference_msec=result.inference_ms,
                        processing_msec=avg_latency,
                        detections=detection_items,
                    )
                    if ok:
                        log.info("[IAD] Detection event published successfully")
                    else:
                        log.warning("[IAD] Detection event publish failed")

                    # Publish crowd density for the live gauge
                    if person_count_cli >= 20:
                        density = "critical"
                    elif person_count_cli >= 10:
                        density = "high"
                    elif person_count_cli >= 5:
                        density = "medium"
                    else:
                        density = "low"
                    _mqtt_client.publish_crowd_density(count=person_count_cli, density=density)

                    # Publish tracking for the live visitor counter
                    track_ids = [p.track_id for p in tracked_people]
                    _mqtt_client.publish_tracking(
                        active_count=person_count_cli,
                        track_ids=track_ids,
                        fps=current_fps,
                    )

            if perf_logger:
                perf_logger.log(
                    fps=current_fps,
                    latency_ms=avg_latency,
                    person_count=person_count_cli,
                )

            if args.headless:
                if frame_count % 30 == 0:
                    log.info(
                        "[IAD] FPS: %.1f | Latency: %.1f ms | Persons: %d",
                        current_fps,
                        avg_latency,
                        person_count_cli,
                    )
                continue

            # ── Visualisation ─────────────────────────────────────────────────
            # draw_tracked_persons replaces draw_detections for the tracker path;
            # draw_hud (FPS / latency / person count) is kept as-is.
            draw_tracked_persons(frame, tracked_people, age_cache)
            draw_hud(
                frame,
                fps=current_fps,
                latency_ms=avg_latency,
                person_count=len(tracked_people),
            )
            cv2.imshow("IAD SmartVision — Person Detection & Age Estimation", frame)
            if (cv2.waitKey(1) & 0xFF) == ord("q"):
                break

    except KeyboardInterrupt:
        log.info("Interrupted.")
    finally:
        stream.stop()
        cv2.destroyAllWindows()
        if perf_logger:
            perf_logger.close()
        _mqtt_client.disconnect()

    log.info(
        "Completed %d frames | Avg FPS: %.1f | Avg Latency: %.1f ms",
        frame_count,
        fps_counter.fps,
        latency_tracker.average_ms,
    )


if __name__ == "__main__":
    _cli_main()
