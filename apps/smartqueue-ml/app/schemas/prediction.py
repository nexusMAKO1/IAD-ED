import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import settings


def get_utc_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def get_uuid() -> str:
    return str(uuid.uuid4())


class PredictRequest(BaseModel):
    service_type: str
    priority: str = "standard"
    queue_length: int = Field(default=0, ge=0)
    active_agents: int = Field(default=2, ge=0)

    @field_validator("service_type")
    @classmethod
    def validate_service_type(cls, v: str) -> str:
        if v not in settings.VALID_SERVICE_TYPES:
            raise ValueError(f"service_type must be one of {settings.VALID_SERVICE_TYPES}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in settings.VALID_PRIORITIES:
            raise ValueError(f"priority must be one of {settings.VALID_PRIORITIES}")
        return v


class BatchPredictRequest(BaseModel):
    items: list[PredictRequest]

    @model_validator(mode="after")
    def validate_batch_size(self):
        if len(self.items) > 50:
            raise ValueError("Batch size exceeds maximum of 50")
        return self


class PredictionResponse(BaseModel):
    predicted_wait_time_seconds: int
    congestion_level: str
    confidence_interval_percentage: float
    factors: dict
    is_fallback: bool = False
    timestamp: datetime


class MQTTPredictionPayload(BaseModel):
    prediction_id: str = Field(default_factory=get_uuid)
    timestamp: str = Field(default_factory=get_utc_now)
    predicted_wait_time_seconds: int
    confidence_interval_percentage: float
    congestion_level: Literal["low", "moderate", "high", "critical"]


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
