from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ML_PORT: int = 8002
    ML_LOG_LEVEL: str = "INFO"

    MODEL_PATH: str = "models/wait_time_rf.joblib"
    ENCODERS_PATH: str = "models/encoders.joblib"

    # Set to true in tests/CI to skip loading the real model file
    MODEL_SKIP_LOAD: bool = False

    # MUST match train.py's FEATURE_COLUMNS exactly — single source of truth for array construction
    FEATURE_COLUMNS: list[str] = [
        "hour", "day_of_week", "is_weekend", "is_lunch_hour",
        "queue_length_at_arrival", "active_agents",
        "service_type", "priority",
    ]

    # Priority discount multipliers (business rule, configurable — CDC F4.3)
    PRIORITY_MULTIPLIER_VIP: float = 0.60
    PRIORITY_MULTIPLIER_PRIORITY: float = 0.80
    PRIORITY_MULTIPLIER_STANDARD: float = 1.00

    # Congestion thresholds (queue_length upper bound, inclusive)
    CONGESTION_LOW_MAX: int = 5
    CONGESTION_MODERATE_MAX: int = 10
    CONGESTION_HIGH_MAX: int = 20

    # Prediction clamp bounds, seconds
    MIN_WAIT_TIME_SECONDS: int = 60
    MAX_WAIT_TIME_SECONDS: int = 2700

    CONFIDENCE_MAX_DEDUCTION: float = 50.0

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_TIMEOUT_SECONDS: float = 1.0

    # Valid categories for request validation — MUST match encoders.joblib's classes_ exactly
    VALID_SERVICE_TYPES: list[str] = ["consultation", "depot", "info", "reclamation", "retrait", "virement"]
    VALID_PRIORITIES: list[str] = ["priority", "standard", "vip"]

    # Postgres (from existing config)
    POSTGRES_DB: str = "iad_db"
    POSTGRES_USER: str = "iad_user"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_PORT: int = 5432

    # MQTT (from existing config)
    MQTT_HOST: str = "mosquitto"
    MQTT_PORT: int = 1883
    MQTT_USER: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_CONNECT_RETRIES: int = 3
    MQTT_CONNECT_RETRY_DELAY_SECONDS: float = 2.0
    MQTT_PUBLISH_TIMEOUT_SECONDS: float = 5.0

    # -----------------------------------------------------------------------
    # T-015 — MQTT Topics (from T-001 interface contracts)
    # -----------------------------------------------------------------------
    MQTT_TOPIC_QUEUE_STATUS: str = "smartqueue/status"
    MQTT_TOPIC_PREDICTIONS: str = "smartqueue/predictions"
    MQTT_TOPIC_ANOMALIES: str = "alerts/anomalies"
    MQTT_TOPIC_DASHBOARD_ALERT: str = "alerts/dashboard"
    DASHBOARD_ALERT_QOS: int = 1
    MQTT_TOPIC_HEALTH: str = "system/health"
    MQTT_HEALTH_INTERVAL_SECONDS: float = 30.0

    # -----------------------------------------------------------------------
    # T-015 — Anomaly Detection (CDC F2.9)
    # Business-owned parameters — see spec §1.8 for governance rules.
    # -----------------------------------------------------------------------
    ANOMALY_WINDOW_SIZE: int = 100          # per-service_type sliding window
    ANOMALY_MIN_SAMPLES: int = 10           # minimum data points before z-score is meaningful
    ANOMALY_Z_THRESHOLD: float = 3.0        # warning floor
    ANOMALY_Z_CRITICAL: float = 4.0         # critical threshold
    ANOMALY_Z_FATAL: float = 5.0            # fatal threshold
    ANOMALY_COOLDOWN_SECONDS: int = 120     # suppress repeat alerts for sustained anomaly
    ANOMALY_RECENT_ALERTS_MAXLEN: int = 50  # max recent alerts kept in memory


    # -----------------------------------------------------------------------
    # T-015 — Recommended Actions (CDC F2.10 — static rule table keyed on severity)
    # -----------------------------------------------------------------------
    RECOMMENDED_ACTION_WARNING: str = "Surveiller la file — envisager d'ouvrir un guichet supplémentaire."
    RECOMMENDED_ACTION_CRITICAL: str = "Ouvrir immédiatement un guichet supplémentaire ou réaffecter du personnel."
    RECOMMENDED_ACTION_FATAL: str = "Intervention urgente requise — mobiliser tout le personnel disponible."

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
