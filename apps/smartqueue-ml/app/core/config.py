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

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
