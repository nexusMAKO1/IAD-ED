from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

import uuid


def _get_uuid() -> str:
    return str(uuid.uuid4())


class QueueStatusPayload(BaseModel):
    timestamp: datetime
    source: str    # 'redis' | 'fallback'
    status: str    # 'ok' | 'degraded'
    active_queue_length: int
    longest_wait_seconds: int
    average_wait_seconds: int
    queues_by_service_type: dict[str, int]


class AckRequestBody(BaseModel):
    """Minimal client-facing input for the ack endpoint.
    The caller may optionally specify a channel; everything else is server-side."""
    channel: str = "dashboard"


class AlertAcknowledgment(BaseModel):
    ack_id: str = Field(default_factory=_get_uuid)
    alert_id: str
    acknowledged_by: str                    # populated server-side from X-Operator-Id header
    acknowledged_at: datetime               # populated server-side from datetime.now(UTC)
    channel: str = "dashboard"


class AnomalyAlert(BaseModel):
    alert_id: str = Field(default_factory=_get_uuid)
    service_type: str
    timestamp: datetime
    z_score: float
    threshold_crossed: float
    severity: str  # 'warning', 'critical', 'fatal'
    recommended_action: str
