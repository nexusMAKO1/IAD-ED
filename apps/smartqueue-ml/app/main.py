from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Info

from app.core.config import settings
from app.routers import predict, alerts, health
from app.services.model_store import load_model, is_model_loaded
from app.core.mqtt_client import mqtt_client

logger = structlog.get_logger().bind(
    service="smartqueue-ml",
    module=__name__,
)

# ---------------------------------------------------------------------------
# Custom Prometheus Metrics
# ---------------------------------------------------------------------------
ml_prediction_latency_hist = Histogram(
    "smartqueue_prediction_latency_seconds", "Latency of predictions"
)
ml_prediction_count = Counter(
    "smartqueue_prediction_total", "Total number of predictions"
)
ml_training_duration_hist = Histogram(
    "smartqueue_training_duration_seconds", "Duration of model training"
)
ml_model_version_info = Info("smartqueue_model", "Current active model version")
ml_inference_success_counter = Counter(
    "smartqueue_inference_success_total", "Total successful inferences"
)
ml_inference_failure_counter = Counter(
    "smartqueue_inference_failure_total", "Total failed inferences"
)
ml_forecast_requests_counter = Counter(
    "smartqueue_forecast_requests_total", "Total forecast requests"
)

# Initialize default model info
ml_model_version_info.info({"version": "1.0.0", "type": "SMARTQUEUE"})


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Load ML Model
    try:
        load_model()
    except Exception:
        logger.exception("model_load_failed")

    # 2. Connect MQTT
    try:
        mqtt_client.start()
    except Exception:
        logger.exception("mqtt_connect_failed")

    # 3. Log startup & config
    logger.info(
        "startup_complete",
        port=settings.ML_PORT,
    )
    logger.info(f"Anomaly thresholds: WARNING={settings.ANOMALY_Z_THRESHOLD}, CRITICAL={settings.ANOMALY_Z_CRITICAL}, FATAL={settings.ANOMALY_Z_FATAL}")

    yield

    # Shutdown
    mqtt_client.stop()
    logger.info("shutdown")


app = FastAPI(
    title="SmartQueue ML Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Include Prometheus instrumentation
Instrumentator().instrument(app).expose(app)

# Import routers

app.include_router(predict.router)
app.include_router(alerts.router)
app.include_router(health.router)


@app.get("/")
def read_root():
    return {
        "message": "SmartQueue ML Service",
        "version": "1.0.0",
        "docs": "/docs",
    }


