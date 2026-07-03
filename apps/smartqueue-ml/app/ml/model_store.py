# -*- coding: utf-8 -*-
"""Singleton model store.

Replaces ``app.stubs.model_store_stub`` after Phase 2 merge.
Update ``app/main.py`` to import from ``app.ml.model_store`` once this file
is merged.

The public interface (locked in Phase 1) must not change:
    def load_model() -> None: ...
    def get_model() -> Optional[Any]: ...
    def get_encoders() -> Optional[dict]: ...
    def is_model_loaded() -> bool: ...
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any, Optional

# pyrefly: ignore [missing-import]
import joblib
import structlog
from structlog.types import FilteringBoundLogger

# Logger --------------------------------------------------------------------
logger: FilteringBoundLogger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

# Internal singleton state ----------------------------------------------------
_model: Optional[Any] = None
_encoders: Optional[dict] = None

# Paths ---------------------------------------------------------------------
MODEL_PATH = os.path.join("models", "wait_time_rf.joblib")
ENCODER_PATH = os.path.join("models", "encoders.joblib")


def load_model() -> None:
    """Load the trained model and encoders if present.

    If the environment variable ``MODEL_SKIP_LOAD`` is truthy, the function
    returns early after logging a warning. Errors are logged but never raised.
    """
    global _model, _encoders

    skip = os.getenv("MODEL_SKIP_LOAD", "").lower() in {"1", "true", "yes"}
    if skip:
        logger.warning(
            "model_skip_load",
            timestamp=datetime.now(tz=UTC).isoformat(),
            level="warning",
        )
        return

    try:
        _model = joblib.load(MODEL_PATH)
        _encoders = joblib.load(ENCODER_PATH)
        logger.info(
            "model_loaded",
            timestamp=datetime.now(tz=UTC).isoformat(),
            level="info",
            model_path=MODEL_PATH,
            encoder_path=ENCODER_PATH,
        )
    except FileNotFoundError:
        logger.error(
            "model_file_missing",
            timestamp=datetime.now(tz=UTC).isoformat(),
            level="error",
            model_path=MODEL_PATH,
            encoder_path=ENCODER_PATH,
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "model_load_error",
            timestamp=datetime.now(tz=UTC).isoformat(),
            level="error",
        )
        # Swallow exception – leave _model/_encoders as None.


def get_model() -> Optional[Any]:
    """Return the loaded model or ``None`` if not loaded."""
    return _model


def get_encoders() -> Optional[dict]:
    """Return the loaded encoders mapping or ``None`` if not loaded."""
    return _encoders


def is_model_loaded() -> bool:
    """True when a model is successfully loaded into memory."""
    return _model is not None
