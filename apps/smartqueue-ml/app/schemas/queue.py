from datetime import datetime
from pydantic import BaseModel

class QueueStatusPayload(BaseModel):
    timestamp: datetime
    source: str    # 'redis' | 'fallback'
    status: str    # 'ok' | 'degraded'
    active_queue_length: int
    longest_wait_seconds: int
    average_wait_seconds: int
    queues_by_service_type: dict[str, int]
