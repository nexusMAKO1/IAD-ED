import asyncio
import random
import logging
from datetime import datetime, UTC
from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.schemas.prediction import PredictRequest, BatchPredictRequest, PredictionResponse, MQTTPredictionPayload
from app.schemas.queue import QueueStatusPayload
from app.services.exceptions import PredictionServiceError
from app.services import predictor
from app.services.anomaly import anomaly_detector
from app.core.config import settings
from app.core.mqtt_client import mqtt_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["predictions"])


def _predict_side_effects(
    service_type: str,
    priority: str,
    response: PredictionResponse,
):
    """Background task: publish prediction to MQTT and run anomaly check.

    Each step is independently wrapped so a failure in one never blocks the other.
    """
    # 1. Publish prediction to smartqueue/predictions
    try:
        payload = MQTTPredictionPayload(
            predicted_wait_time_seconds=response.predicted_wait_time_seconds,
            confidence_interval_percentage=response.confidence_interval_percentage,
            congestion_level=response.congestion_level,
        )
        mqtt_client.publish_prediction(payload)
        logger.debug("prediction_published", extra={"service_type": service_type})
    except Exception:
        logger.exception("prediction_publish_failed", extra={"service_type": service_type})

    # 2. Anomaly detection
    try:
        anomaly_detector.check_anomaly(service_type, response.predicted_wait_time_seconds)
    except Exception:
        logger.exception("anomaly_check_failed", extra={"service_type": service_type})


@router.get("/queue/predict", response_model=PredictionResponse)
async def predict(
    service_type: str,
    background_tasks: BackgroundTasks,
    priority: str = "standard",
    queue_length: int = 0,
    active_agents: int = 2
):
    if service_type not in settings.VALID_SERVICE_TYPES:
        raise HTTPException(422, detail={
            "error_code": "QUEUE_003",
            "message": f"Type de service invalide. Doit être parmi : {settings.VALID_SERVICE_TYPES}"
        })
    if priority not in settings.VALID_PRIORITIES:
        raise HTTPException(422, detail={
            "error_code": "QUEUE_003",
            "message": f"Priorité invalide. Doit être parmi : {settings.VALID_PRIORITIES}"
        })
    try:
        response = await predictor.predict_wait_time(
            service_type=service_type,
            priority=priority,
            queue_length=queue_length,
            active_agents=active_agents
        )
        background_tasks.add_task(_predict_side_effects, service_type, priority, response)
        return response
    except PredictionServiceError as e:
        raise HTTPException(status_code=503, detail={"error_code": e.error_code, "message": e.message})


@router.post("/queue/predict/batch", response_model=list[PredictionResponse])
async def predict_batch(request: BatchPredictRequest, background_tasks: BackgroundTasks):
    responses = []
    try:
        for item in request.items:
            response = await predictor.predict_wait_time(
                service_type=item.service_type,
                priority=item.priority,
                queue_length=item.queue_length,
                active_agents=item.active_agents
            )
            responses.append(response)
            background_tasks.add_task(_predict_side_effects, item.service_type, item.priority, response)
        return responses
    except PredictionServiceError as e:
        raise HTTPException(status_code=503, detail={"error_code": e.error_code, "message": e.message})


@router.get("/queue/status", response_model=QueueStatusPayload)
async def queue_status():
    try:
        # T-015 will replace this with real Redis call
        # Try Redis first (redis.asyncio, key "queue:status"), 1s timeout via asyncio.wait_for, catch all exceptions.
        # Fallback simulated here for now:
        raise Exception("Redis not connected")
    except Exception:
        return QueueStatusPayload(
            timestamp=datetime.now(tz=UTC),
            source="fallback",
            status="degraded",
            active_queue_length=random.randint(0, 25),
            longest_wait_seconds=random.randint(60, 1800),
            average_wait_seconds=random.randint(60, 600),
            queues_by_service_type={
                "consultation": random.randint(0, 8),
                "virement": random.randint(0, 8),
                "retrait": random.randint(0, 8),
                "depot": random.randint(0, 8),
                "reclamation": random.randint(0, 8),
                "info": random.randint(0, 8)
            }
        )

@router.get("/queue/anomalies", response_model=list)
async def queue_anomalies():
    return anomaly_detector.get_recent_anomalies()


@router.get("/queue/stats")
async def queue_stats():
    return predictor.get_prediction_stats()
