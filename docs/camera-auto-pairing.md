# Camera Auto-Pairing Architecture

The Express Display SmartVision system includes a robust zero-touch provisioning and auto-pairing system for edge cameras via MQTT.

## Identity Flow

To prevent duplicate records and ensure a camera maintains its identity across network drops, container restarts, and physical reboots, the system relies on a stable **Device ID**.

1. **Explicit Startup**: The standard backend infrastructure (`docker compose up`) does **not** automatically start the Edge-CV camera. The camera must be explicitly started by the user by running:
   ```bash
   python3 apps/edge-cv/app/main.py
   ```
   *(Alternatively, if running the camera inside Docker is desired, use `docker compose --profile camera up -d edge-cv`)*.
2. **Environment Configuration**: The camera pulls its unique `DEVICE_ID` (and optionally `SITE_ID`) from environment variables (`EDGE_CV_DEVICE_ID` in `.env`).
3. **Discovery Broadcast**: Once explicitly started, the `edge-cv` service begins its discovery loop, publishing its metadata (IP, resolution, FPS, resource usage) to `smartvision/edge/discovery` every 30 seconds.
3. **Backend Registration**: The backend `DeviceRegistryService` receives the discovery message. 
    - If the `deviceId` does not exist in PostgreSQL, it creates a new `Device` record.
    - If `siteId` was provided by the camera, the device is immediately placed in `ONLINE` status.
    - If no `siteId` was provided, it is placed in `UNPAIRED` status.
4. **Pairing Acknowledgement**: The backend immediately publishes an acknowledgement back to the camera at `smartvision/edge/{deviceId}/config`, containing the assigned `siteId`.
5. **Edge Persistence**: The `edge-cv` service receives the acknowledgement and persists the `siteId` to a local `identity.json` file. 

## Heartbeat & Presence

- **Edge-CV**: Publishes to `smartvision/edge/heartbeat` and `smartvision/edge/discovery` every 30 seconds (configurable via `EDGE_CV_HEARTBEAT_INTERVAL`).
- **Backend Presence Monitor**: A cron job (`PresenceService`) scans the database every 10 seconds.
    - Time since last heartbeat < 30s → `ONLINE`
    - Time since last heartbeat 30–60s → `WARNING`
    - Time since last heartbeat > 60s → `OFFLINE`
- **UNPAIRED cameras**: Cameras that have never been assigned a site remain `UNPAIRED` indefinitely and do not trigger offline alerts.

## Troubleshooting Auto-Pairing

If a camera fails to appear in the dashboard:

1. **Verify DEVICE_ID**: Ensure `EDGE_CV_DEVICE_ID` is set in the `.env` file and correctly passed to the `edge-cv` container in `docker-compose.yml`. If this is missing, the camera operates in standalone mode and disables MQTT discovery.
2. **Check MQTT Connectivity**: Verify the `edge-cv` container logs (`docker compose logs edge-cv`) to ensure it successfully connects to the Mosquitto broker on port 1883.
3. **Check Backend Logs**: Search the backend logs for `[DEVICE]` prefixes to trace the discovery and heartbeat flow: `docker compose logs backend | grep "\[DEVICE\]"`.
