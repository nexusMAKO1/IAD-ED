from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.routers import health
from app.stubs.model_store_stub import load_model
from app.stubs.mqtt_client_stub import connect_mqtt

logger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Load ML Model
    try:
        load_model()
    except Exception:
        logger.exception("model_load_failed")

    # 2. Connect MQTT
    try:
        connect_mqtt()
    except Exception:
        logger.exception("mqtt_connect_failed")

    # 3. Log startup
    logger.info(
        "startup_complete",
        port=settings.ML_PORT,
    )

    yield

    # Shutdown
    logger.info("shutdown")


app = FastAPI(
    title="SmartQueue ML Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Include Prometheus instrumentation
Instrumentator().instrument(app).expose(app)

# Import routers
app.include_router(health.router)


@app.get("/")
def read_root():
    return {
        "message": "SmartQueue ML Service",
        "version": "1.0.0",
        "docs": "/docs",
    }
