# Monitoring Stack — IAD & SmartQueue AI

This directory contains the configurations and resources for the comprehensive monitoring stack of the Express Display SmartVision project. The stack relies on **Prometheus** for metrics scraping and alerting, **Grafana** for dashboards, and several **exporters** (PostgreSQL, Redis, Mosquitto).

## How to Start Monitoring

The monitoring stack is fully integrated into the project's Docker Compose setup. It automatically spins up along with the rest of the infrastructure.

To start the complete environment (including monitoring):
```bash
docker compose up --build -d
```

This command will start:
- `iad_prometheus` (Prometheus)
- `iad_grafana` (Grafana)
- Exporters: `iad_postgres_exporter`, `iad_redis_exporter`, `iad_mosquitto_exporter`
- All your application services (Backend, Edge-CV, SmartQueue ML), which are instrumented to expose metrics.

## Accessing Grafana

Once the containers are running, you can access Grafana via your web browser:
- **URL**: `http://localhost:3001`
- **Username**: Defined by the `GRAFANA_ADMIN_USER` env var (default: `admin` in `.env.example`).
- **Password**: Defined by the `GRAFANA_ADMIN_PASSWORD` env var.

Grafana is provisioned automatically with:
- The **Prometheus data source**.
- **6 standard dashboards**: System Overview, Backend, Edge-CV, SmartQueue ML, Database, and MQTT.

## Accessing Prometheus

You can query Prometheus directly for debugging metrics or checking target status:
- **URL**: `http://localhost:9090`
- **Targets Page**: `http://localhost:9090/targets` (Check if all services are UP)
- **Alerts Page**: `http://localhost:9090/alerts` (Check active and configured alerts)

## How to Add New Metrics

### 1. NestJS Backend (`apps/backend/`)
We use `@willsoto/nestjs-prometheus` and `prom-client`.
- Define a new metric using `prom-client` (e.g., `Counter`, `Gauge`).
- You can place it globally or within a specific service/controller.
- Example in `auth.controller.ts`:
  ```typescript
  import { Counter } from 'prom-client';
  const myCounter = new Counter({ name: 'my_metric_total', help: 'Help text' });
  // Call myCounter.inc() where appropriate
  ```
- Prisma metrics are automatically exposed on `/metrics` by the custom `MetricsController`.

### 2. FastAPI Services (`apps/edge-cv/` and `apps/smartqueue-ml/`)
We use `prometheus_fastapi_instrumentator` for default HTTP metrics, and `prometheus_client` for custom business metrics.
- Import the metric type from `prometheus_client` in `main.py` or your service files.
- Example:
  ```python
  from prometheus_client import Gauge
  my_gauge = Gauge("my_custom_gauge", "Help text")
  my_gauge.set(42)
  ```
- The `Instrumentator` handles automatically exposing these on the `/metrics` endpoint.

## How to Create New Dashboards

1. **Via Grafana UI (Temporary / Prototyping):**
   - Log into Grafana.
   - Click **Dashboards > New > Dashboard**.
   - Add your panels using PromQL queries.
   - Note: Changes made directly in the UI are **not persistent** across container recreations because of provisioning. To persist, you must export the JSON.

2. **Via Code (Persistent):**
   - Create your dashboard in the Grafana UI and click the **Dashboard settings (gear icon) > JSON Model**.
   - Copy the JSON.
   - Save the JSON file in `infrastructure/monitoring/grafana/dashboards/new-dashboard.json`.
   - Grafana's file provisioning (configured in `dashboards.yml`) will automatically detect and load it (usually within 30 seconds).

## Available Alerts
Prometheus Alertmanager is configured with the following active alerts (see `alerts.yml`):
- **Infrastructure**: ServiceDown, HighCPUUsage, HighRAMUsage
- **Applications**: HighErrorRate, HighAPILatency, YoloFailure, CameraOffline, PredictionFailure
- **Dependencies**: DatabaseOffline, MQTTOffline
