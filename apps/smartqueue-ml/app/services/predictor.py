"""
T-014 — Full ML prediction pipeline.
ZERO dependency on any web framework. Raises only PredictionServiceError on failure.
Must be callable directly (no HTTP context) — T-015's future MQTT callback will do exactly that.
"""

import numpy as np
import structlog
from datetime import datetime, UTC
from typing import Optional
from time import perf_counter

from app.core.config import settings
from app.schemas.prediction import PredictionResponse
from app.services.exceptions import PredictionServiceError
from app.services import model_store

logger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

_prediction_count: int = 0
_congestion_distribution: dict[str, int] = {
    "low": 0, "moderate": 0, "high": 0, "critical": 0
}
_fallback_prediction_count: int = 0


async def predict_wait_time(
    service_type: str,
    priority: str,
    queue_length: int,
    active_agents: int,
    timestamp: Optional[datetime] = None,
) -> PredictionResponse:
    start_time = perf_counter()
    global _prediction_count, _fallback_prediction_count, _congestion_distribution

    if timestamp is None:
        timestamp = datetime.now(tz=UTC)
        
    hour = timestamp.hour
    day_of_week = timestamp.weekday()
    is_weekend = bool(day_of_week >= 5)
    is_lunch_hour = bool(12 <= hour < 14)

    is_fallback = False
    
    # 9. Compute congestion level
    if queue_length <= settings.CONGESTION_LOW_MAX:
        congestion_level = "low"
    elif queue_length <= settings.CONGESTION_MODERATE_MAX:
        congestion_level = "moderate"
    elif queue_length <= settings.CONGESTION_HIGH_MAX:
        congestion_level = "high"
    else:
        congestion_level = "critical"

    factors = {
        "hour": hour,
        "day_of_week": day_of_week,
        "queue_length": queue_length,
        "active_agents": active_agents,
        "service_type": service_type,
        "priority": priority
    }

    try:
        if not model_store.is_model_loaded():
            # 12. Mock fallback
            predicted_wait_time_seconds = max(settings.MIN_WAIT_TIME_SECONDS, queue_length * 45)
            confidence_interval_percentage = 60.0
            is_fallback = True
            logger.warning("prediction_fallback", service_type=service_type, queue_length=queue_length)
        else:
            # 4. Encode
            try:
                enc_service = model_store.get_encoder("service_type")
                enc_priority = model_store.get_encoder("priority")
                
                service_encoded = enc_service.transform([service_type])[0]
                priority_encoded = enc_priority.transform([priority])[0]
            except Exception as e:
                raise PredictionServiceError("Unknown service_type or priority", error_code="QUEUE_002") from e

            # 5. Build features
            # queue_length matches queue_length_at_arrival
            features = np.array([[
                hour,
                day_of_week,
                is_weekend,
                is_lunch_hour,
                queue_length,
                active_agents,
                service_encoded,
                priority_encoded
            ]])

            # 6. Predict
            raw_prediction, std = model_store.predict_with_uncertainty(features)

            # 7. Apply priority discount
            multiplier = 1.0
            if priority == "vip":
                multiplier = settings.PRIORITY_MULTIPLIER_VIP
            elif priority == "priority":
                multiplier = settings.PRIORITY_MULTIPLIER_PRIORITY
            else:
                multiplier = settings.PRIORITY_MULTIPLIER_STANDARD
                
            discounted = raw_prediction * multiplier
            
            # 8. Round and clip
            predicted_wait_time_seconds = int(round(discounted))
            predicted_wait_time_seconds = max(settings.MIN_WAIT_TIME_SECONDS, min(settings.MAX_WAIT_TIME_SECONDS, predicted_wait_time_seconds))
            
            # 10. Confidence
            if predicted_wait_time_seconds == 0:
                confidence_interval_percentage = 100.0
            else:
                # NOTE: approximate confidence score from tree-prediction spread, not a rigorous statistical CI (CDC F2.8, deferred).
                deduction = min(std / predicted_wait_time_seconds * 100, settings.CONFIDENCE_MAX_DEDUCTION)
                confidence_interval_percentage = round(100.0 - deduction, 1)

    except PredictionServiceError:
        raise
    except Exception as e:
        raise PredictionServiceError(str(e)) from e
        
    duration_ms = (perf_counter() - start_time) * 1000

    logger.info(
        "predict_wait_time",
        service_type=service_type,
        priority=priority,
        queue_length=queue_length,
        predicted_wait_time_seconds=predicted_wait_time_seconds,
        congestion_level=congestion_level,
        duration_ms=duration_ms
    )

    _prediction_count += 1
    if is_fallback:
        _fallback_prediction_count += 1
    _congestion_distribution[congestion_level] += 1

    return PredictionResponse(
        predicted_wait_time_seconds=predicted_wait_time_seconds,
        congestion_level=congestion_level,
        confidence_interval_percentage=confidence_interval_percentage,
        factors=factors,
        is_fallback=is_fallback,
        timestamp=timestamp
    )


def get_prediction_stats() -> dict:
    return {
        "total_predictions": _prediction_count,
        "congestion_distribution": _congestion_distribution,
        "fallback_predictions": _fallback_prediction_count
    }
