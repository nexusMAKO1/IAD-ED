"""
schemas.py — Pydantic Models for MQTT Payload Validation
Express Display SmartVision — T-021

All incoming and outgoing MQTT messages must conform to the BaseEvent
envelope. Services that publish non-conformant payloads are rejected.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Base envelope (matches TypeScript BaseEventDto)
# ---------------------------------------------------------------------------


class BaseEvent(BaseModel):
    """Standard MQTT message envelope for all SmartVision services."""

    timestamp: datetime = Field(description="ISO-8601 UTC event timestamp")
    device_id: str = Field(alias="deviceId", description="Physical device identifier")
    site_id: str = Field(alias="siteId", description="Logical site identifier")
    event: str = Field(description="Event type discriminator")
    payload: Optional[Dict[str, Any]] = Field(default=None)

    model_config = {"populate_by_name": True}

    @field_validator("event")
    @classmethod
    def event_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("event must not be blank")
        return v


# ---------------------------------------------------------------------------
# Edge-CV outgoing payloads
# ---------------------------------------------------------------------------


class DetectionItem(BaseModel):
    track_id: Optional[int] = Field(None, alias="track_id")
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float = Field(ge=0.0, le=1.0)
    label: Optional[str] = None
    estimated_age: Optional[float] = Field(None, alias="estimated_age")
    age_group: Optional[str] = Field(None, alias="age_group")

    model_config = {"populate_by_name": True}


class DetectionPayload(BaseModel):
    person_count: int = Field(ge=0, alias="personCount")
    inference_msec: float = Field(ge=0.0, alias="inferenceMsec")
    processing_msec: float = Field(ge=0.0, alias="processingMsec")
    detections: List[DetectionItem] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class TrackingPayload(BaseModel):
    active_count: int = Field(ge=0, alias="activeCount")
    track_ids: List[int] = Field(default_factory=list, alias="trackIds")
    fps: float = Field(ge=0.0)

    model_config = {"populate_by_name": True}


class DemographicsItem(BaseModel):
    track_id: int = Field(alias="trackId")
    estimated_age: Optional[float] = Field(None, alias="estimatedAge")
    age_group: Optional[str] = Field(None, alias="ageGroup")
    confidence: float = Field(ge=0.0, le=1.0)

    model_config = {"populate_by_name": True}


class DemographicsPayload(BaseModel):
    person_count: int = Field(ge=0, alias="personCount")
    demographics: List[DemographicsItem] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class PerformancePayload(BaseModel):
    fps: float = Field(ge=0.0)
    inference_msec: float = Field(ge=0.0, alias="inferenceMsec")
    processing_msec: float = Field(ge=0.0, alias="processingMsec")
    cpu_percent: Optional[float] = Field(None, alias="cpuPercent")
    memory_bytes: Optional[int] = Field(None, alias="memoryBytes")

    model_config = {"populate_by_name": True}


class CrowdDensityPayload(BaseModel):
    count: int = Field(ge=0)
    density: str = Field(pattern=r"^(low|medium|high|critical)$")
    zone_id: Optional[str] = Field(None, alias="zoneId")

    model_config = {"populate_by_name": True}


class HealthPayload(BaseModel):
    status: str = Field(pattern=r"^(healthy|degraded|unhealthy|offline|online)$")
    service_name: str = Field(alias="serviceName")
    uptime: Optional[float] = None
    metrics: Optional[Dict[str, float]] = None

    model_config = {"populate_by_name": True}


class CameraHealthPayload(BaseModel):
    online: bool
    source: str
    resolution: Optional[str] = None
    fps: Optional[float] = None


# ---------------------------------------------------------------------------
# Incoming command payloads (Edge-CV subscribes)
# ---------------------------------------------------------------------------


class ConfigUpdateCommand(BaseModel):
    confidence: Optional[float] = Field(None, ge=0.01, le=1.0)
    device: Optional[str] = None
    log_level: Optional[str] = Field(None, alias="logLevel")

    model_config = {"populate_by_name": True}


class CameraCommand(BaseModel):
    action: str = Field(description="on | off | snapshot | ptz")
    target_device_id: Optional[str] = Field(None, alias="targetDeviceId")

    model_config = {"populate_by_name": True}


class ModelUpdateCommand(BaseModel):
    model_path: str = Field(alias="modelPath")
    model_version: Optional[str] = Field(None, alias="modelVersion")

    model_config = {"populate_by_name": True}


class RestartCommand(BaseModel):
    reason: str = Field(default="manual")
    target_device_id: Optional[str] = Field(None, alias="targetDeviceId")

    model_config = {"populate_by_name": True}
