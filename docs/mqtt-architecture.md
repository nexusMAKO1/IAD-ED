# MQTT Architecture — Express Display SmartVision

This document describes the MQTT communication layer implemented in Task T-021.

## 1. Broker Infrastructure
The central message broker is **Eclipse Mosquitto 2.0+**, deployed via Docker Compose.

*   **Port 1883**: Standard MQTT (TCP) — used by Backend (NestJS) and Edge-CV (Python).
*   **Port 9001 mapped to 9003**: WebSocket — used by the Frontend (React).
*   **Security**: `allow_anonymous false` is enforced globally. All clients must authenticate using credentials stored in `infrastructure/docker/mosquitto/passwd`. Both TCP and WebSocket listeners are protected.

## 2. Topic Hierarchy
All topics are strictly defined and shared across the three codebases. Topics follow the `smartvision/{publisher}/{domain}` convention.

| Topic Pattern | QoS | Publisher | Subscriber | Description |
| :--- | :--- | :--- | :--- | :--- |
| `smartvision/edge/detections` | 1 | Edge-CV | Backend, Frontend | Real-time object tracking and bounding boxes |
| `smartvision/edge/tracking` | 1 | Edge-CV | Backend, Frontend | Active tracking IDs and FPS |
| `smartvision/edge/demographics` | 1 | Edge-CV | Backend, Frontend | Age/gender estimation per track ID |
| `smartvision/edge/crowd-density`| 0 | Edge-CV | Backend, Frontend | Periodic aggregate of crowd density |
| `smartvision/edge/performance` | 0 | Edge-CV | Backend, Frontend | Telemetry (FPS, inference msec, CPU) |
| `smartvision/edge/camera-health`| 0 | Edge-CV | Backend, Frontend | Camera source availability |
| `smartvision/edge/status` | 1 | Edge-CV | Backend, Frontend | General processing status |
| `smartvision/commands/*` | 1/2 | Backend | Edge-CV | Configuration, camera control, restarts |
| `smartvision/backend/events` | 1 | Backend | Frontend | Processed business logic events |
| `smartvision/backend/alerts` | 2 | Backend | Frontend | Critical system or operational alerts |
| `smartvision/backend/queue` | 1 | Backend | Frontend | Queue wait-time predictions |
| `smartvision/frontend/*` | 0/1 | Backend | Frontend | UI-specific real-time streams |
| `smartvision/system/health` | 0/1 | *All* | *All* | Heartbeats (QoS 0) and Last Will offline alerts (QoS 1) |

## 3. Payload Standardisation
Every MQTT message **must** conform to a standard envelope. Services that publish invalid envelopes will have their messages rejected by the subscribers.

```json
{
  "timestamp": "2026-07-02T13:00:00.000Z", // ISO-8601 UTC
  "deviceId": "camera-01-entrance",        // Physical device or node ID
  "siteId": "express-display-lyon",        // Logical site ID
  "event": "person_detected",              // Discriminator
  "payload": {
    // Specific event data
  }
}
```

*   **Backend**: Validates incoming messages using `class-validator` DTOs.
*   **Edge-CV**: Validates incoming commands using Pydantic `BaseModel`.
*   **Frontend**: Validates envelope shape at runtime and enforces structure via TypeScript interfaces.

## 4. Resilience & Reconnection
All clients are configured for **Exponential Back-off Reconnection**.
*   If the Mosquitto broker goes down, services will continue running.
*   They will attempt to reconnect infinitely, increasing the delay between attempts up to a maximum threshold (usually 120s).
*   Messages published while disconnected are dropped (unless they are QoS 1/2 and the session was resumed, depending on client configuration, but generally we rely on stateless real-time data).

## 5. Last Will & Testament (LWT)
All three services register a LWT on the `smartvision/system/health` topic with `retain=True`.
If a service crashes or loses network abruptly, the Mosquitto broker will automatically publish:
```json
{
  "timestamp": "...",
  "deviceId": "...",
  "siteId": "...",
  "event": "service_offline",
  "payload": {
    "status": "offline",
    "serviceName": "backend|edge-cv|frontend"
  }
}
```

## 6. Implementation Locations
*   **Backend**: `apps/backend/src/mqtt/` (NestJS module, using `mqtt` npm package directly).
*   **Edge-CV**: `apps/edge-cv/app/mqtt/` and `app/services/mqtt_client.py` (Python, using `paho-mqtt` in a background thread).
*   **Frontend**: `apps/frontend/src/mqtt/` (React, singleton WebSocket client using `mqtt` with `useMqtt` hooks).
