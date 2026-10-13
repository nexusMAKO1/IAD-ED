"""
cli.py — Standalone CLI runner for Edge-CV.
IAD & SmartQueue AI — Express Display SmartVision

Kept for local testing, live camera preview, and legacy POC compatibility.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import time
from typing import Dict

import cv2

from app.config import settings
from app.detector import PersonDetector
from app.tracking.bytetrack import ByteTracker
from app.demographics.age_estimation import AgeEstimator
from app.demographics.gender_estimation import GenderEstimator
from app.services.mqtt_client import MQTTClient
from app.utils import (
    FPSCounter,
    LatencyTracker,
    PerformanceLogger,
    draw_hud,
    draw_tracked_persons,
)
from app.video_stream import VideoStream

log = logging.getLogger("iad.edge-cv.cli")


def main() -> None:
    """CLI fallback entry point."""
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

    shutdown = False

    def _sig(sig: int, frame: object) -> None:
        nonlocal shutdown
        log.info("Shutdown signal — stopping.")
        shutdown = True

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

    AGE_ESTIMATE_EVERY_N: int = 10
    AGE_ESTIMATE_INTERVAL_MS: float = 500.0

    cli_tracker = ByteTracker()
    cli_age_estimator = AgeEstimator()
    cli_gender_estimator = (
        GenderEstimator(
            model_path=settings.gender_model_path,
            confidence_threshold=settings.gender_confidence_threshold,
        )
        if settings.gender_enabled
        else None
    )

    mqtt_client = MQTTClient(
        host=settings.mqtt_host,
        port=settings.mqtt_port,
        username=settings.mqtt_user,
        password=settings.mqtt_password,
        client_id=f"{settings.mqtt_client_id}-cli",
        site_id=settings.site_id,
        device_id=settings.device_id,
    )

    if mqtt_client.connect():
        log.info("CLI Mode: MQTT connected.")
    else:
        log.warning("CLI Mode: MQTT connection failed.")

    age_cache: Dict[int, str] = {}
    gender_cache: Dict[int, str] = {}
    gender_conf_cache: Dict[int, float] = {}
    last_age_estimate_time: float = 0.0

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
    last_detection_publish_time: float = 0.0
    DETECTION_PUBLISH_INTERVAL_S: float = 1.0

    try:
        while not shutdown:
            ret, frame = stream.read()
            if not ret or frame is None:
                time.sleep(0.005)
                continue

            result = cli_detector.detect(frame)
            latency_tracker.record(result.inference_ms)
            fps_counter.tick()
            frame_count += 1
            current_fps = fps_counter.fps
            avg_latency = latency_tracker.average_ms

            raw_dets = [
                {"bbox": [d.x1, d.y1, d.x2, d.y2], "confidence": d.confidence}
                for d in result.detections
            ]
            h, w = frame.shape[:2]
            try:
                tracked_people = cli_tracker.update(raw_dets, frame_h=h, frame_w=w)
            except Exception as trk_exc:
                log.debug("Tracker error: %s", trk_exc)
                tracked_people = []

            person_count_cli = len(tracked_people)

            now_ms = time.perf_counter() * 1000.0
            time_gate = (now_ms - last_age_estimate_time) >= AGE_ESTIMATE_INTERVAL_MS
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
                        group_label = cli_age_estimator.age_group_label(float(raw_age))
                        prev = age_cache.get(person.track_id)
                        age_cache[person.track_id] = group_label
                        if prev != group_label:
                            log.info("[IAD] Track %d Age Group: %s", person.track_id, group_label)

                if cli_gender_estimator is not None:
                    try:
                        gender_results = cli_gender_estimator.estimate(frame, age_dets)
                    except Exception as gender_exc:
                        log.debug("Gender estimation error: %s", gender_exc)
                        gender_results = []

                    for person, gender_info in zip(tracked_people, gender_results):
                        gender_cache[person.track_id] = gender_info.get("gender", "unknown")
                        if "gender_confidence" in gender_info:
                            gender_conf_cache[person.track_id] = gender_info["gender_confidence"]

                last_age_estimate_time = now_ms

            active_ids = {p.track_id for p in tracked_people}
            stale_ids = [tid for tid in age_cache if tid not in active_ids]
            for tid in stale_ids:
                del age_cache[tid]
                gender_cache.pop(tid, None)
                gender_conf_cache.pop(tid, None)

            now_s = time.perf_counter()
            if mqtt_client.is_connected and (now_s - last_detection_publish_time) >= DETECTION_PUBLISH_INTERVAL_S:
                last_detection_publish_time = now_s

                detection_items = []
                for person in tracked_people:
                    group_label = age_cache.get(person.track_id, "adult")
                    group_norm = group_label.lower().replace(" ", "_")
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
                    item = {
                        "track_id": person.track_id,
                        "confidence": round(person.confidence, 4),
                        "age_group": age_group,
                        "gender": gender_cache.get(person.track_id, "unknown"),
                    }
                    if person.track_id in gender_conf_cache:
                        item["gender_confidence"] = gender_conf_cache[person.track_id]
                    detection_items.append(item)

                if settings.site_id:
                    mqtt_client.publish_detections(
                        person_count=person_count_cli,
                        inference_msec=result.inference_ms,
                        processing_msec=avg_latency,
                        detections=detection_items,
                    )
                    density = "critical" if person_count_cli >= 20 else ("high" if person_count_cli >= 10 else ("medium" if person_count_cli >= 5 else "low"))
                    mqtt_client.publish_crowd_density(count=person_count_cli, density=density)
                    mqtt_client.publish_tracking(
                        active_count=person_count_cli,
                        track_ids=[p.track_id for p in tracked_people],
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
                    log.info("[IAD] FPS: %.1f | Latency: %.1f ms | Persons: %d", current_fps, avg_latency, person_count_cli)
                continue

            draw_tracked_persons(frame, tracked_people, age_cache)
            draw_hud(frame, fps=current_fps, latency_ms=avg_latency, person_count=len(tracked_people))
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
        mqtt_client.disconnect()


if __name__ == "__main__":
    main()
