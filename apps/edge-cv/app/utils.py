"""
utils.py — Performance metrics utilities
IAD & SmartQueue AI — Edge CV Service

Provides:
- FPS counter with rolling window
- Latency tracker
- CSV performance log exporter
- Overlay drawing helpers (bounding boxes, HUD)
"""

from __future__ import annotations

from typing import Dict, List


import csv
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np

try:
    from app.detector import Detection
except ImportError:
    from detector import Detection


# ---------------------------------------------------------------------------
# FPS Counter
# ---------------------------------------------------------------------------


class FPSCounter:
    """
    Computes a rolling-average FPS using a fixed-size time deque.

    Args:
        window: Number of frames to include in the rolling average.
    """

    def __init__(self, window: int = 30) -> None:
        if window < 1:
            raise ValueError("FPS window must be >= 1")
        self._times: deque[float] = deque(maxlen=window)

    def tick(self) -> None:
        """Record a frame timestamp."""
        self._times.append(time.perf_counter())

    @property
    def fps(self) -> float:
        """Current rolling-average FPS."""
        if len(self._times) < 2:
            return 0.0
        elapsed = self._times[-1] - self._times[0]
        return (len(self._times) - 1) / elapsed if elapsed > 0 else 0.0


# ---------------------------------------------------------------------------
# Latency Tracker
# ---------------------------------------------------------------------------


class LatencyTracker:
    """
    Tracks inference latency with a rolling average.

    Args:
        window: Number of samples to average.
    """

    def __init__(self, window: int = 30) -> None:
        if window < 1:
            raise ValueError("Latency window must be >= 1")
        self._samples: deque[float] = deque(maxlen=window)

    def record(self, latency_ms: float) -> None:
        """Add a latency sample in milliseconds."""
        self._samples.append(latency_ms)

    @property
    def average_ms(self) -> float:
        """Rolling average latency in milliseconds."""
        if not self._samples:
            return 0.0
        return float(np.mean(self._samples))

    @property
    def max_ms(self) -> float:
        """Rolling maximum latency in milliseconds."""
        if not self._samples:
            return 0.0
        return float(np.max(self._samples))


# ---------------------------------------------------------------------------
# CSV Performance Logger
# ---------------------------------------------------------------------------


class PerformanceLogger:
    """
    Logs per-frame performance metrics to a CSV file.

    Args:
        path: Output CSV file path.
    """

    HEADERS = ["timestamp", "fps", "latency_ms", "person_count"]

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._file = self.path.open("w", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._file, fieldnames=self.HEADERS)
        self._writer.writeheader()

    def log(self, fps: float, latency_ms: float, person_count: int) -> None:
        """Write one row of metrics."""
        self._writer.writerow(
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "fps": f"{fps:.1f}",
                "latency_ms": f"{latency_ms:.1f}",
                "person_count": person_count,
            }
        )
        self._file.flush()

    def close(self) -> None:
        self._file.close()

    def __enter__(self) -> "PerformanceLogger":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Overlay drawing helpers
# ---------------------------------------------------------------------------

# Colour palette (BGR)
COLOR_BOX = (0, 200, 0)  # Green bounding box
COLOR_TEXT_BG = (0, 0, 0)  # Black background for text
COLOR_TEXT = (255, 255, 255)  # White text
COLOR_HUD_BG = (30, 30, 30)  # Dark HUD background
COLOR_WARN = (0, 100, 255)  # Orange-red for high latency

FONT = cv2.FONT_HERSHEY_SIMPLEX
BOX_THICKNESS = 2
TEXT_SCALE = 0.55
TEXT_THICKNESS = 1


def draw_detections(frame: cv2.typing.MatLike, detections: List[Detection]) -> None:
    """
    Draw green bounding boxes and confidence scores for each detection.
    Mutates the frame in-place.
    """
    for det in detections:
        # Bounding box
        cv2.rectangle(
            frame, (det.x1, det.y1), (det.x2, det.y2), COLOR_BOX, BOX_THICKNESS
        )

        # Label background
        label = f"{det.label} {det.confidence:.0%}"
        (tw, th), baseline = cv2.getTextSize(label, FONT, TEXT_SCALE, TEXT_THICKNESS)
        lx, ly = det.x1, det.y1 - 4
        cv2.rectangle(
            frame,
            (lx, ly - th - baseline),
            (lx + tw + 2, ly + baseline),
            COLOR_BOX,
            cv2.FILLED,
        )
        cv2.putText(
            frame,
            label,
            (lx + 1, ly),
            FONT,
            TEXT_SCALE,
            COLOR_TEXT_BG,
            TEXT_THICKNESS + 1,
        )
        cv2.putText(
            frame, label, (lx + 1, ly), FONT, TEXT_SCALE, COLOR_TEXT, TEXT_THICKNESS
        )


def draw_hud(
    frame: cv2.typing.MatLike,
    fps: float,
    latency_ms: float,
    person_count: int,
) -> None:
    """
    Draw a semi-transparent HUD in the top-left corner with FPS, latency
    and person count.  Mutates frame in-place.
    """
    lines = [
        f"FPS     : {fps:5.1f}",
        f"Latency : {latency_ms:5.1f} ms",
        f"Persons : {person_count}",
    ]

    padding = 6
    line_h = 22
    hud_h = len(lines) * line_h + padding * 2
    hud_w = 220

    # Semi-transparent dark rectangle
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (hud_w, hud_h), COLOR_HUD_BG, cv2.FILLED)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    for i, line in enumerate(lines):
        y = padding + (i + 1) * line_h
        color = COLOR_WARN if (i == 1 and latency_ms > 200) else COLOR_TEXT
        cv2.putText(
            frame,
            line,
            (padding, y),
            FONT,
            TEXT_SCALE,
            color,
            TEXT_THICKNESS,
            cv2.LINE_AA,
        )


# Overlay colours for tracked-person annotations
COLOR_ID = (255, 80, 0)     # Blue  — tracking ID label
COLOR_AGE = (0, 220, 255)   # Yellow — age group label


def draw_tracked_persons(
    frame: cv2.typing.MatLike,
    tracked_persons: list,
    age_cache: dict,
) -> None:
    """
    Draw bounding boxes, tracking IDs, and age group labels for every active
    tracked person.  Exact numerical ages are never displayed.

    For each tracked person the overlay shows:
        • Green rectangle around the body
        • Two-line label above the box:
            Line 1:  ``ID <id>``          (rendered in blue)
            Line 2:  ``<age group>``       (rendered in yellow)
          e.g.  ID 7
                Adult
          If the age group is not yet in the cache the second line reads
          ``Unknown``.

    Parameters
    ----------
    frame : np.ndarray
        BGR image to annotate (mutated in-place).
    tracked_persons : list of TrackedPerson
        Output of ByteTracker.update() for the current frame.
    age_cache : Dict[int, str]
        Mapping of track_id -> age group display string (e.g. ``'Adult'``).
        Values are read-only; this function does NOT write to the cache.
    """
    for person in tracked_persons:
        x1, y1, x2, y2 = person.bbox
        tid = person.track_id

        # ── 1. Bounding box (green) ────────────────────────────────────
        cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_BOX, BOX_THICKNESS)

        # ── 2. Build label strings ─────────────────────────────────────
        id_label   = f"ID {tid}"
        # age_cache now stores display strings (e.g. 'Adult', 'Unknown')
        age_label  = str(age_cache.get(tid, "Unknown"))

        # ── 3. Measure both lines for the background rectangle ─────────
        (id_tw,  id_th),  id_base  = cv2.getTextSize(id_label,  FONT, TEXT_SCALE, TEXT_THICKNESS)
        (age_tw, age_th), age_base = cv2.getTextSize(age_label, FONT, TEXT_SCALE, TEXT_THICKNESS)

        line_gap  = 4          # pixels between the two text lines
        label_w   = max(id_tw, age_tw) + 6
        label_h   = id_th + age_th + id_base + age_base + line_gap + 4

        # Anchor: place label strip directly above the bounding box
        lx  = x1
        # Bottom of the background strip sits at y1 - 2
        bg_y2 = max(y1 - 2, label_h + 2)   # clamp to stay on-screen
        bg_y1 = bg_y2 - label_h

        # ── 4. Semi-transparent dark background strip ──────────────────
        cv2.rectangle(
            frame, (lx, bg_y1), (lx + label_w, bg_y2), (20, 20, 20), cv2.FILLED
        )

        # ── 5. Draw ID line (blue) on top ─────────────────────────────
        id_y = bg_y1 + id_th + 2
        cv2.putText(
            frame,
            id_label,
            (lx + 3, id_y),
            FONT,
            TEXT_SCALE,
            COLOR_ID,
            TEXT_THICKNESS,
            cv2.LINE_AA,
        )

        # ── 6. Draw age group line (yellow) below ──────────────────────
        age_y = id_y + age_th + id_base + line_gap
        cv2.putText(
            frame,
            age_label,
            (lx + 3, age_y),
            FONT,
            TEXT_SCALE,
            COLOR_AGE,
            TEXT_THICKNESS,
            cv2.LINE_AA,
        )
