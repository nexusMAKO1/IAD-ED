import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


def get_utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def get_uuid() -> str:
    return str(uuid.uuid4())


class PredictRequest(BaseModel):
    service_type: Literal[
        "consultation",
        "virement",
        "retrait",
        "depot",
        "reclamation",
        "info",
    ]
    priority: Literal["standard", "priority", "vip"] = "standard"
    queue_length: int = Field(ge=0, description="People waiting")
    active_agents: int = Field(ge=1, le=10)


class PredictionResponse(BaseModel):
    predicted_wait_time_seconds: int
    confidence_interval_percentage: float
    congestion_level: Literal["low", "moderate", "high", "critical"]
    factors: dict


class MQTTPredictionPayload(BaseModel):
    prediction_id: str = Field(default_factory=get_uuid)
    timestamp: str = Field(default_factory=get_utc_now)
    predicted_wait_time_seconds: int
    confidence_interval_percentage: float
    congestion_level: Literal["low", "moderate", "high", "critical"]


class QueueStatusPayload(BaseModel):
    kiosk_id: str
    timestamp: str
    active_tickets: int
    waiting_users: int
    average_wait_time_seconds: int
    service_point_status: list


class AnomalyAlert(BaseModel):
    alert_id: str = Field(default_factory=get_uuid)
    timestamp: str = Field(default_factory=get_utc_now)
    source: str = "smartqueue-prediction"
    severity: Literal["warning", "critical", "fatal"]
    error_code: str
    message: str


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    timestamp: str
    service: str = "smartqueue-ml"
    model_loaded: bool
    services: dict
