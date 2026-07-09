"""
Loads the trained Pipeline (StandardScaler -> RandomForestRegressor) and the
LabelEncoders from disk. Exposes a small, model-family-agnostic interface so
predictor.py never needs to know this is specifically a RandomForest — if the
pipeline is swapped for GradientBoosting/XGBoost later, only this file changes.
"""

import numpy as np
import structlog
# pyrefly: ignore [missing-import]
import joblib

from app.core.config import settings

logger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

_pipeline = None
_encoders = None
_loaded: bool = False

def load_model() -> None:
    global _pipeline, _encoders, _loaded

    if settings.MODEL_SKIP_LOAD:
        logger.info("model_skip_load", skipped=True)
        _loaded = False
        return

    try:
        pipeline = joblib.load(settings.MODEL_PATH)
        encoders = joblib.load(settings.ENCODERS_PATH)

        # Validate pipeline
        if "scaler" not in pipeline.named_steps or "model" not in pipeline.named_steps:
            logger.error("model_load_validation_failed", reason="Missing named steps in pipeline")
            _loaded = False
            return
            
        # Validate encoders
        if not isinstance(encoders, dict) or set(encoders.keys()) != {"service_type", "priority"}:
            logger.error("model_load_validation_failed", reason="Invalid encoders dict keys")
            _loaded = False
            return

        service_classes = set(encoders["service_type"].classes_.tolist())
        priority_classes = set(encoders["priority"].classes_.tolist())

        if service_classes != set(settings.VALID_SERVICE_TYPES) or priority_classes != set(settings.VALID_PRIORITIES):
            logger.error("model_load_validation_failed", reason="Encoder classes drift from config")
            _loaded = False
            return

        _pipeline = pipeline
        _encoders = encoders
        _loaded = True
        logger.info("model_loaded")

    except Exception as e:
        logger.error("model_load_error", error=str(e))
        _loaded = False


def is_model_loaded() -> bool:
    return _loaded

def get_encoder(name: str):
    if not _loaded or not _encoders:
        raise KeyError(f"Encoders not loaded, cannot get {name}")
    if name not in _encoders:
        raise KeyError(f"Encoder {name} not found")
    return _encoders[name]

def predict_with_uncertainty(features: np.ndarray) -> tuple[float, float]:
    """
    features: shape (1, 8), already in settings.FEATURE_COLUMNS order.
    Raises RuntimeError if called while is_model_loaded() is False.

    This is the ONLY function in the codebase allowed to know the pipeline has
    a scaler + RF:
        scaled = _pipeline.named_steps["scaler"].transform(features)
        rf = _pipeline.named_steps["model"]
        prediction = rf.predict(scaled)[0]
        std = np.std([tree.predict(scaled)[0] for tree in rf.estimators_])
        return float(prediction), float(std)

    If the pipeline is later replaced with a model family without per-tree
    estimators, only this function changes — predictor.py is unaffected.
    """
    if not is_model_loaded():
        raise RuntimeError("Model is not loaded")
        
    scaled = _pipeline.named_steps["scaler"].transform(features)
    rf = _pipeline.named_steps["model"]
    prediction = rf.predict(scaled)[0]
    std = np.std([tree.predict(scaled)[0] for tree in rf.estimators_])
    
    return float(prediction), float(std)
