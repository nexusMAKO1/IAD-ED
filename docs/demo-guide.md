# SmartVision End-to-End Live Demonstration Guide

This guide describes how to run and verify the full **Express Display SmartVision** project. It details the steps required to experience the complete workflow—from starting the Docker infrastructure to real-time YOLO audience detection, MQTT event processing, database logging, and dashboard updates.

---

## 1. Prerequisites

Before running the application, make sure your host machine meets these requirements:

- **Operating System**: macOS, Linux, or Windows (WSL2)
- **Docker & Docker Compose**:
  - Docker Desktop installed and running.
  - Recommended minimum resources: 4 CPUs, 8 GB RAM, and at least 15 GB of free disk space (to load models and images).
- **Node.js**: Version `20.x` or later (for running local development tasks, although Docker wraps this).
- **Python**: Version `3.9` or `3.11` (only if running tests outside Docker).
- **Webcam**: A built-in webcam or external USB camera (required for the live webcam mode).

---

## 2. Installation

1. Clone the repository and navigate to the project root:
   ```bash
   git clone <repository-url>
   cd "IAD ED"
   ```
2. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   *Note: For local development and demonstration, the default values in `.env` are pre-configured to work out-of-the-box.*

---

## 3. Launching the Demonstration (Automatic)

We provide a master demonstration script that automates the entire setup (building, starting, migrations, database seeding, and opening the dashboard):

```bash
./scripts/demo.sh
```

This script will:
- Check your Docker daemon and build all container images.
- Start the database, cache, MQTT broker, and storage services.
- Wait for all health checks to pass.
- Run the TimescaleDB-compatible database migrations.
- Seed the PostgreSQL database with base locations, campaigns, users, and historical events.
- Configure default MinIO buckets.
- Automatically launch the Frontend in your default web browser at `http://localhost:5173`.

---

## 4. Manual Startup (Alternative)

If you prefer to start components step-by-step:

### A. Docker Startup
Start all Docker containers:
```bash
./scripts/start.sh
```
Check container statuses to ensure they are healthy:
```bash
docker compose ps
```

### B. Database Initialization
Ensure PostgreSQL has the required TimescaleDB extensions loaded, then run migrations and database seeding:
```bash
./scripts/seed.sh
```

---

## 5. End-to-End Workflow Testing

Once the services are running, follow these steps to experience the complete customer workflow:

### A. Opening the Frontend
Open your browser and navigate to:
**[http://localhost:5173](http://localhost:5173)**
- Log in using the default admin credentials seeded in the database:
  - **Email**: `admin@expressdisplay.com`
  - **Password**: `admin123` (or the password configured in the seed script).

### B. Testing with Webcam
1. Go to the **Live Detection** tab in the dashboard.
2. Select **Webcam** as the input source.
3. Grant camera permissions in the browser.
4. You will see your camera stream with bounding boxes, labels (`person`), confidence scores, and real-time tracked IDs overlaying detected individuals.

### C. Testing with Video Upload
1. In the **Live Detection** tab, select **Video Upload**.
2. Upload a sample `.mp4` video containing people.
3. The Edge-CV service will process the video, running YOLOv8 person detection, tracking (ByteTrack), and demographics estimation in real time.
4. The video player will display bounding boxes and tracking IDs.

### D. Testing MQTT Publication
During active detection (webcam or video), audience events are published to the Mosquitto broker:
- **Detections Topic**: `smartvision/edge/detections`
- **Tracking Topic**: `smartvision/edge/tracking`

You can monitor the MQTT stream directly by subscribing to the broker:
```bash
docker compose exec mosquitto mosquitto_sub -h localhost -p 1883 -u iad_mqtt_user -P CHANGE_ME_MQTT_PASSWORD -t "smartvision/edge/detections"
```

### E. Database Verification
Verify that the NestJS backend consumes these MQTT messages and logs them into PostgreSQL (TimescaleDB):
```bash
docker compose exec postgres psql -U iad_user -d iad_db -c "SELECT * FROM audience_events ORDER BY timestamp DESC LIMIT 5;"
```

---

## 6. Monitoring & Swagger Documentation

### A. Swagger API Docs
Explore the backend REST APIs and models:
- **Swagger URL**: **[http://localhost:3000/docs](http://localhost:3000/docs)**

### B. Prometheus Targets
Verify metrics collection:
- **Prometheus URL**: **[http://localhost:9090](http://localhost:9090)**
- Navigate to **Status -> Targets** to ensure all endpoints (`iad-backend`, `iad-edge-cv`, `iad-smartqueue-ml`, `redis`, `postgres`, `mosquitto`) are `UP`.

### C. Grafana Dashboards
View system and AI metrics in real time:
- **Grafana URL**: **[http://localhost:3001](http://localhost:3001)**
- **Credentials**: `admin` / `CHANGE_ME_GRAFANA_PASSWORD` (as set in your `.env` file).
- Open the provisioned dashboards to check CPU/Memory utilization, inference latencies, FPS, and database query performances.

---

## 7. Troubleshooting

- **Database Error: function create_hypertable() does not exist**
  - **Reason**: TimescaleDB extension is missing or public schema was dropped.
  - **Fix**: The migrations have been updated to auto-create extensions. Run `./scripts/demo.sh` to trigger a clean database reset.
- **Mosquitto Connection Refused in Exporter**
  - **Reason**: The exporter is looking at a default `127.0.0.1` address instead of the broker container.
  - **Fix**: Verify your `docker-compose.yml` has the correct `BROKER_ENDPOINT: "tcp://mosquitto:1883"` environment variable set.
- **Permission Errors on Mac/Linux**
  - **Fix**: Make sure shell scripts are executable:
    ```bash
    chmod +x scripts/*.sh
    ```
