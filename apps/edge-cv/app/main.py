"""
main.py — Real-Time Person Detection Entry Point
IAD & SmartQueue AI — Edge CV (T-003)

Usage as CLI:
  # Webcam (default)
  python main.py

  # Specific webcam index
  python main.py --source 1

  # RTSP stream
  python main.py --source "rtsp://user:pass@192.168.1.100/stream"

  # Local video file (headless benchmarking)
  python main.py --source /path/to/video.mp4 --headless

  # Export ONNX model after running
  python main.py --export-onnx

  # Log performance to CSV
  python main.py --log-csv logs/perf.csv

Usage as API:
  uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException

# Try package imports first, fallback to module imports
try:
    from app.detector import PersonDetector
    from app.utils import (
        FPSCounter,
        LatencyTracker,
        PerformanceLogger,
        draw_detections,
        draw_hud,
    )
    from app.video_stream import VideoStream
except ImportError:
    from detector import PersonDetector
    from utils import (
        FPSCounter,
        LatencyTracker,
        PerformanceLogger,
        draw_detections,
        draw_hud,
    )
    from video_stream import VideoStream

# ---------------------------------------------------------------------------
# Logging configuration — no sensitive data in logs
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("iad.poc")

# ---------------------------------------------------------------------------
# Global Detector and FastAPI setup
# ---------------------------------------------------------------------------
detector: PersonDetector | None = None
model_loaded = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector, model_loaded
    skip_load = os.getenv("MODEL_SKIP_LOAD", "false").lower() == "true"
    if not skip_load:
        try:
            model_path = os.getenv("MODEL_PATH", "yolov8n.pt")
            log.info("Lifespan: Loading YOLOv8 model from %s", model_path)
            detector = PersonDetector(model_path=model_path)
            model_loaded = True
            log.info("Lifespan: Model loaded successfully.")
        except Exception as e:
            log.error("Lifespan: Failed to load YOLOv8 model: %s", e)
    else:
        log.info("Lifespan: MODEL_SKIP_LOAD is true. Skipping model loading.")
    yield
    # Cleanup on shutdown
    detector = None
    model_loaded = False

app = FastAPI(
    title="IAD Edge CV Service",
    description="Real-Time Person Detection API (FastAPI + YOLOv8n)",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/")
async def root():
    return {"message": "Welcome to the IAD Edge CV Service API"}

@app.get("/health")
async def health():
    status = "ok"
    # If not loaded and not skipped, we treat it as degraded
    if not model_loaded and os.getenv("MODEL_SKIP_LOAD", "false").lower() != "true":
        status = "degraded"
    return {
        "status": status,
        "service": "edge-cv",
        "model_loaded": model_loaded
    }

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if not model_loaded:
        if os.getenv("MODEL_SKIP_LOAD", "false").lower() == "true":
            return {
                "detections": [],
                "inference_ms": 0.0,
                "person_count": 0
            }
        raise HTTPException(status_code=503, detail="Model not loaded or degraded")
    
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    result = detector.detect(frame)
    
    detections_list = []
    for d in result.detections:
        detections_list.append({
            "x1": d.x1,
            "y1": d.y1,
            "x2": d.x2,
            "y2": d.y2,
            "confidence": d.confidence,
            "class_id": d.class_id,
            "label": d.label
        })
        
    return {
        "detections": detections_list,
        "inference_ms": result.inference_ms,
        "person_count": result.person_count
    }

# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="IAD SmartQueue — Real-Time Person Detection POC (YOLOv8n)"
    )
    parser.add_argument(
        "--source",
        default=0,
        help="Video source: 0 (webcam), device index, RTSP URL, or file path. Default: 0",
    )
    parser.add_argument(
        "--model",
        default="yolov8n.pt",
        help="Path to YOLOv8 model weights (.pt or .onnx). Default: yolov8n.pt",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.40,
        help="Confidence threshold (0.0–1.0). Default: 0.40",
    )
    parser.add_argument(
        "--device",
        default="",
        help="Inference device: '' (auto), 'cpu', 'cuda', 'mps'. Default: auto",
    )
    parser.add_argument(
        "--half",
        action="store_true",
        help="Use FP16 half-precision inference (GPU only).",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run without displaying the video window (for edge devices / benchmarks).",
    )
    parser.add_argument(
        "--log-csv",
        default=None,
        metavar="PATH",
        help="Export per-frame performance metrics to a CSV file.",
    )
    parser.add_argument(
        "--export-onnx",
        action="store_true",
        help="Export model to ONNX after loading and exit.",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Capture frame width. Default: 640",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Capture frame height. Default: 480",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_shutdown = False

def _signal_handler(sig: int, frame: object) -> None:
    global _shutdown
    log.info("Shutdown signal received — stopping.")
    _shutdown = True


# ---------------------------------------------------------------------------
# Main loop for CLI mode
# ---------------------------------------------------------------------------
def run(args: argparse.Namespace) -> None:
    global _shutdown

    # Resolve integer source if possible
    source: int | str
    try:
        source = int(args.source)
    except (ValueError, TypeError):
        source = str(args.source)

    # ------------------------------------------------------------------
    # Initialise detector
    # ------------------------------------------------------------------
    log.info("Loading YOLOv8n model: %s", args.model)
    cli_detector = PersonDetector(
        model_path=args.model,
        confidence=args.conf,
        device=args.device,
        half=args.half,
    )
    log.info("Model loaded on device: %s", cli_detector.device)

    # ONNX export mode — export and exit
    if args.export_onnx:
        out = cli_detector.export_onnx("yolov8n_person.onnx")
        log.info("ONNX model exported to: %s", out)
        return

    # ------------------------------------------------------------------
    # Initialise metrics
    # ------------------------------------------------------------------
    fps_counter = FPSCounter(window=30)
    latency_tracker = LatencyTracker(window=30)

    perf_logger: PerformanceLogger | None = None
    if args.log_csv:
        perf_logger = PerformanceLogger(args.log_csv)
        log.info("Performance logging to: %s", args.log_csv)

    # ------------------------------------------------------------------
    # Initialise video stream
    # ------------------------------------------------------------------
    log.info("Opening video source: %s", source)
    try:
        stream = VideoStream(source=source, width=args.width, height=args.height).start()
    except (RuntimeError, ValueError) as exc:
        log.error("Failed to open video source: %s", exc)
        sys.exit(1)

    log.info("Stream started — press 'q' to quit.")
    frame_count = 0

    try:
        while not _shutdown:
            ret, frame = stream.read()
            if not ret or frame is None:
                time.sleep(0.005)
                continue

            # ---------------------------------------------------------------
            # Inference
            # ---------------------------------------------------------------
            result = cli_detector.detect(frame)
            latency_tracker.record(result.inference_ms)
            fps_counter.tick()

            current_fps = fps_counter.fps
            avg_latency = latency_tracker.average_ms
            frame_count += 1

            # ---------------------------------------------------------------
            # Log to CSV
            # ---------------------------------------------------------------
            if perf_logger:
                perf_logger.log(
                    fps=current_fps,
                    latency_ms=avg_latency,
                    person_count=result.person_count,
                )

            # ---------------------------------------------------------------
            # Print to stdout in headless mode (every 30 frames)
            # ---------------------------------------------------------------
            if args.headless:
                if frame_count % 30 == 0:
                    log.info(
                        "FPS: %.1f | Latency: %.1f ms | Persons: %d",
                        current_fps,
                        avg_latency,
                        result.person_count,
                    )
                continue  # Skip display logic

            # ---------------------------------------------------------------
            # Draw overlays on frame
            # ---------------------------------------------------------------
            draw_detections(frame, result.detections)
            draw_hud(
                frame,
                fps=current_fps,
                latency_ms=avg_latency,
                person_count=result.person_count,
            )

            # ---------------------------------------------------------------
            # Show frame
            # ---------------------------------------------------------------
            cv2.imshow("IAD SmartQueue — Person Detection POC", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                log.info("'q' pressed — quitting.")
                break

    except KeyboardInterrupt:
        log.info("Interrupted — shutting down.")
    finally:
        stream.stop()
        cv2.destroyAllWindows()
        if perf_logger:
            perf_logger.close()

    log.info(
        "Completed %d frames | Avg FPS: %.1f | Avg Latency: %.1f ms",
        frame_count,
        fps_counter.fps,
        latency_tracker.average_ms,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)
    args = parse_args()
    run(args)


if __name__ == "__main__":
    main()
