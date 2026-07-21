import asyncio
from datetime import datetime

import redis.asyncio as redis
import structlog
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.prediction import HealthResponse
from app.services.model_store import is_model_loaded
from app.core.mqtt_client import mqtt_client

logger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

router = APIRouter()

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD,
    decode_responses=True,
)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    services = {}

    # 1. Check model
    try:
        model_loaded = is_model_loaded()
        services["model"] = "loaded" if model_loaded else "not_loaded"
    except Exception:
        logger.exception("model_check_error")
        model_loaded = False
        services["model"] = "error"

    # 2. Check Redis
    redis_up = False
    try:
        await asyncio.wait_for(redis_client.ping(), timeout=1.0)
        redis_up = True
        services["redis"] = "ok"
    except (TimeoutError, asyncio.TimeoutError, asyncio.CancelledError):
        logger.warning("redis_check_timeout")
        services["redis"] = "error"
    except Exception:
        logger.exception("redis_check_error")
        services["redis"] = "error"

    # 3. Check MQTT
    try:
        mqtt_connected = mqtt_client.is_mqtt_connected()
        services["mqtt"] = "connected" if mqtt_connected else "not_connected"
    except Exception:
        logger.exception("mqtt_check_error")
        mqtt_connected = False
        services["mqtt"] = "not_connected"

    # 4. Determine overall status
    if model_loaded and redis_up and mqtt_connected:
        status = "healthy"
    elif not model_loaded and not redis_up and not mqtt_connected:
        status = "unhealthy"
    else:
        status = "degraded"

    # 5. Log result
    logger.info(
        "health_check_completed",
        status=status,
        services=services,
    )

    return HealthResponse(
        status=status,
        timestamp=datetime.utcnow().isoformat() + "Z",
        model_loaded=model_loaded,
        services=services,
    )
