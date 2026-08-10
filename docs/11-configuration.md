# 11 - Configuration

Toute la configuration du système est pilotée par les variables d'environnement. Le fichier `.env` à la racine du projet est injecté dans le `docker-compose.yml`, qui propage ensuite les variables aux différents conteneurs.

## 11.1 Fichiers de Configuration Importants

* `.env` : Fichier principal (non commité).
* `.env.example` : Modèle de variables.
* `docker-compose.yml` : Définit les ports et les variables transmises.
* `infrastructure/docker/mosquitto/mosquitto.conf` : Configuration du broker.
* `infrastructure/monitoring/prometheus.yml` : Cibles de scraping.

## 11.2 Variables d'Environnement (.env.example)

Si un secret est requis, il doit être remplacé par une valeur sécurisée (marqué `REDACTED` ou `CHANGE_ME` dans l'exemple).

```env
# ─── PostgreSQL ─────────────────────────────────────────────────────────────
POSTGRES_DB=iad_db
POSTGRES_USER=iad_user
POSTGRES_PASSWORD=REDACTED
POSTGRES_PORT=5432

# ─── Redis ──────────────────────────────────────────────────────────────────
REDIS_PORT=6379
REDIS_PASSWORD=REDACTED

# ─── MQTT ───────────────────────────────────────────────────────────────────
MQTT_PORT=1883
MQTT_WS_PORT=9003
MQTT_USER=iad_mqtt
MQTT_PASSWORD=REDACTED

# ─── MinIO ──────────────────────────────────────────────────────────────────
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=REDACTED
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# ─── Backend API ────────────────────────────────────────────────────────────
API_PORT=3000
JWT_SECRET=REDACTED
JWT_EXPIRES_IN=3600s
NODE_ENV=development

# ─── Frontend ───────────────────────────────────────────────────────────────
FRONTEND_PORT=5173

# ─── Edge CV ────────────────────────────────────────────────────────────────
CV_PORT=8001
CV_LOG_LEVEL=INFO
CV_MAX_WORKERS=2

# ─── ML ─────────────────────────────────────────────────────────────────────
ML_PORT=8002
ML_LOG_LEVEL=INFO

# ─── Monitoring ─────────────────────────────────────────────────────────────
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=REDACTED
```
