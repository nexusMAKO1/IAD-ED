from datetime import datetime, UTC

from fastapi import APIRouter, Header, HTTPException
import logging

from app.schemas.queue import AckRequestBody, AlertAcknowledgment
from app.services.anomaly import anomaly_detector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.post("/{alert_id}/ack", response_model=AlertAcknowledgment)
async def acknowledge_alert(
    alert_id: str,
    body: AckRequestBody = AckRequestBody(),
    x_operator_id: str = Header(..., alias="X-Operator-Id"),
):
    """Acknowledge a specific anomaly alert.

    - ``alert_id`` is a path parameter; must match a known recent alert.
    - ``acknowledged_by`` is sourced from the ``X-Operator-Id`` request header
      (required — the caller must explicitly claim an identity).
    - ``acknowledged_at`` is set server-side to the current UTC time.
    - The response is the full ``AlertAcknowledgment`` object.
    """
    # Validate alert_id against known recent anomalies
    recent = anomaly_detector.get_recent_anomalies()
    found = any(a.alert_id == alert_id for a in recent)
    if not found:
        raise HTTPException(status_code=404, detail=f"Alerte {alert_id} introuvable")

    # Construct acknowledgment entirely server-side
    ack = AlertAcknowledgment(
        alert_id=alert_id,
        acknowledged_by=x_operator_id,
        acknowledged_at=datetime.now(UTC),
        channel=body.channel,
    )

    logger.info(
        "alert_acknowledged",
        extra={"alert_id": alert_id, "acknowledged_by": x_operator_id},
    )

    return ack
