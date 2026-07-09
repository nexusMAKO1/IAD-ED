import asyncio
import random
from datetime import datetime, UTC
from fastapi import APIRouter, HTTPException

from app.schemas.prediction import PredictRequest, BatchPredictRequest, PredictionResponse
from app.schemas.queue import QueueStatusPayload
from app.services.exceptions import PredictionServiceError
from app.services import predictor
from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["predictions"])

@router.get("/queue/predict", response_model=PredictionResponse)
async def predict(
    service_type: str,
    priority: str = "standard",
    queue_length: int = 0,
    active_agents: int = 2
):
    if service_type not in settings.VALID_SERVICE_TYPES:
        raise HTTPException(422, detail={
            "error_code": "QUEUE_003",
            "message": f"Invalid service_type. Must be one of: {settings.VALID_SERVICE_TYPES}"
        })
    if priority not in settings.VALID_PRIORITIES:
        raise HTTPException(422, detail={
            "error_code": "QUEUE_003",
            "message": f"Invalid priority. Must be one of: {settings.VALID_PRIORITIES}"
        })
    try:
        response = await predictor.predict_wait_time(
            service_type=service_type,
            priority=priority,
            queue_length=queue_length,
            active_agents=active_agents
        )
        # T-015 will hook in via BackgroundTasks here for anomaly detection and MQTT
        return response
    except PredictionServiceError as e:
        raise HTTPException(status_code=503, detail={"error_code": e.error_code, "message": e.message})


@router.post("/queue/predict/batch", response_model=list[PredictionResponse])
async def predict_batch(request: BatchPredictRequest):
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
        # T-015 will hook in via BackgroundTasks here
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
    # T-015 will replace this with anomaly.get_recent_anomalies()
    return []


@router.get("/queue/stats")
async def queue_stats():
    return predictor.get_prediction_stats()
