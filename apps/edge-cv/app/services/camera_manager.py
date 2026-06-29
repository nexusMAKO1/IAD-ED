"""
camera_manager.py — Camera Availability Manager
IAD & SmartQueue AI — Edge CV Service (T-009)

Provides a lightweight, thread-safe manager that tracks whether a camera
(or any video source) is reachable.  It does *not* open the camera itself —
that is the responsibility of the CLI loop or the detect endpoint.  Its
sole purpose is to expose a boolean status flag that the health and status
endpoints can query safely.

In the Edge-CV container the camera source can be:
  - An integer index (USB webcam)
  - An RTSP URL (IP camera)
  - A local file path (benchmark / testing)

When MODEL_SKIP_LOAD is set (CI / testing), the manager skips any actual
probe and simply reports itself as "unavailable" so the service can still
start cleanly.
"""

from __future__ import annotations

import logging
import threading

log = logging.getLogger("iad.camera_manager")


class CameraManager:
    """
    Thread-safe camera availability tracker.

    Usage
    -----
    manager = CameraManager(source="0")
    manager.probe()          # Try to open the source briefly
    manager.is_connected     # → True | False

    The probe is intentionally non-blocking from the caller's perspective:
    it runs synchronously inside startup (lifespan) where a short delay is
    acceptable, then the result is cached and exposed as a property.
    """

    def __init__(self, source: str = "0") -> None:
        self._source = source
        self._connected: bool = False
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def probe(self) -> bool:
        """
        Attempt to open the video source and immediately release it.

        Returns
        -------
        bool
            True if the source opened successfully; False otherwise.
        """
        try:
            # Import OpenCV only when probing — avoids import-time overhead
            # if the manager is constructed but never probed.
            import cv2  # type: ignore[import-untyped]

            # Resolve source type: numeric index or string URL/path
            source: int | str
            try:
                source = int(self._source)
            except (ValueError, TypeError):
                source = self._source

            cap = cv2.VideoCapture(source)
            connected = cap.isOpened()
            cap.release()

            with self._lock:
                self._connected = connected

            if connected:
                log.info("Camera probe succeeded — source: %s", self._source)
            else:
                log.warning("Camera probe failed — source unreachable: %s", self._source)

            return connected

        except Exception as exc:  # pragma: no cover — hardware-dependent
            log.warning("Camera probe raised an exception: %s", exc)
            with self._lock:
                self._connected = False
            return False

    def set_connected(self, value: bool) -> None:
        """Manually override the connection status (used in tests / mocks)."""
        with self._lock:
            self._connected = value

    # ------------------------------------------------------------------ #
    # Properties
    # ------------------------------------------------------------------ #

    @property
    def is_connected(self) -> bool:
        """Return the last known connection status (thread-safe read)."""
        with self._lock:
            return self._connected

    @property
    def source(self) -> str:
        """The configured video source string."""
        return self._source

    @property
    def status_str(self) -> str:
        """Human-readable camera status: 'online' or 'offline'."""
        return "online" if self._connected else "offline"
