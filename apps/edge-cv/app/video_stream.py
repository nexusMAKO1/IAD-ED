"""
video_stream.py — Thread-safe video capture module
IAD & SmartQueue AI — Edge CV Service

Supports USB webcam (index) and RTSP stream (URL).
Uses a background thread to continuously read frames, ensuring the main
inference loop always gets the latest frame without blocking on I/O.
"""

from __future__ import annotations

from typing import Optional, Tuple


import threading
import time
import cv2
import re


class VideoStream:
    """
    Thread-safe video capture wrapper for webcam or RTSP stream.

    The capture runs in a dedicated daemon thread, keeping a rolling buffer
    of the latest frame so the main loop never blocks on camera I/O.
    """

    def __init__(self, source: int | str, width: int = 640, height: int = 480) -> None:
        # TODO(security): Validate that string sources match expected webcam index
        # patterns or known-safe RTSP/RTSPS URL formats before passing to OpenCV.
        self._validate_source(source)

        self.source = source
        self.width = width
        self.height = height

        self.cap: Optional[cv2.VideoCapture] = None
        self.frame: Optional[cv2.typing.MatLike] = None
        self.lock = threading.Lock()
        self.running = False
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_source(source: int | str) -> None:
        """
        Validate the video source against an allow-list of safe patterns.
        Accepts: integer device index, file paths, or rtsp(s):// URLs.
        """
        if isinstance(source, int):
            if source < 0 or source > 64:
                raise ValueError(f"Webcam index must be between 0 and 64, got {source}")
            return

        if isinstance(source, str):
            # Allow: RTSP/RTSPS streams, local file paths
            safe_pattern = re.compile(
                r"^(rtsp://|rtsps://|/[\w./_-]+|[\w]:\\[\w./_\\-]+|\./[\w./_-]+|[0-9]+\.mp4|[0-9]+\.avi).*",
                re.IGNORECASE,
            )
            if not safe_pattern.match(source):
                raise ValueError(
                    f"Unsafe or unsupported video source format: '{source}'. "
                    "Use a device index (int), local file path, or rtsp:// URL."
                )
            return

        raise TypeError(f"source must be int or str, got {type(source)}")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> "VideoStream":
        """Open the capture device and start the background reader thread."""
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise RuntimeError(
                f"Cannot open video source: '{self.source}'. "
                "Check camera connection or RTSP URL."
            )

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimise buffer lag

        self.running = True
        self._thread = threading.Thread(
            target=self._reader, daemon=True, name="VideoStream"
        )
        self._thread.start()

        # Wait for the first frame before returning
        timeout = 5.0
        start = time.time()
        while self.frame is None:
            if time.time() - start > timeout:
                self.stop()
                raise RuntimeError("Timed out waiting for first video frame.")
            time.sleep(0.05)

        return self

    def stop(self) -> None:
        """Stop the reader thread and release the capture device."""
        self.running = False
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    # ------------------------------------------------------------------
    # Internal reader thread
    # ------------------------------------------------------------------

    def _reader(self) -> None:
        """Background thread: continuously read frames into self.frame."""
        while self.running:
            if self.cap is None or not self.cap.isOpened():
                break
            ret, frame = self.cap.read()
            if not ret:
                # End-of-file for video files, or camera disconnect
                time.sleep(0.01)
                continue
            with self.lock:
                self.frame = frame

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def read(self) -> Tuple[bool, Optional[cv2.typing.MatLike]]:
        """
        Return the latest captured frame.

        Returns:
            (True, frame)  — when a frame is available
            (False, None)  — when no frame has been captured yet
        """
        with self.lock:
            if self.frame is None:
                return False, None
            return True, self.frame.copy()

    @property
    def is_opened(self) -> bool:
        return self.running and self.cap is not None and self.cap.isOpened()

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    def __enter__(self) -> "VideoStream":
        return self.start()

    def __exit__(self, *_: object) -> None:
        self.stop()
