"""
config.py — Application Configuration
IAD & SmartQueue AI — Edge CV Service (T-009)

Reads configuration exclusively from environment variables using
pydantic-settings.  All values have sensible defaults so the service
can start in development without any additional setup.

Environment variables (see .env.example / docker-compose.yml):
    LOG_LEVEL          — Logging level (default: INFO)
    MODEL_PATH         — Path to the YOLOv8 .pt weights (default: yolov8n.pt)
    MODEL_SKIP_LOAD    — If "true", skip YOLO model loading entirely
    MODEL_CONFIDENCE   — Detection confidence threshold (default: 0.40)
    MODEL_DEVICE       — Inference device: "cpu", "cuda", "mps", "" (auto)
    MQTT_HOST          — MQTT broker hostname (default: localhost)
    MQTT_PORT          — MQTT broker port (default: 1883)
    MQTT_USER          — MQTT username (default: empty)
    MQTT_PASSWORD      — MQTT password (default: empty)
    CORS_ORIGINS       — Comma-separated allowed CORS origins (default: *)
    SERVICE_VERSION    — Reported service version (default: 1.0.0)
"""

from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """
    Centralised, validated configuration for the Edge-CV service.

    All attributes map 1-to-1 to environment variables (case-insensitive).
    Secrets (passwords) are excluded from log output via the `repr=False` flag.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore unknown env-vars from docker-compose
        protected_namespaces=(),  # Allow field names starting with "model_"
    )

    # ------------------------------------------------------------------ #
    # Service metadata
    # ------------------------------------------------------------------ #
    service_name: str = Field(default="edge-cv", description="Canonical service name")
    service_version: str = Field(default="1.0.0", description="Semantic version string")

    # ------------------------------------------------------------------ #
    # Logging
    # ------------------------------------------------------------------ #
    log_level: str = Field(default="INFO", description="Python logging level")

    # ------------------------------------------------------------------ #
    # YOLO model
    # ------------------------------------------------------------------ #
    model_path: str = Field(
        default="yolov8n.pt",
        description="Path to YOLOv8 weights (.pt or .onnx)",
    )
    model_skip_load: bool = Field(
        default=False,
        description="When true, skip loading the YOLO model at startup",
    )
    model_confidence: float = Field(
        default=0.40,
        ge=0.01,
        le=1.0,
        description="Minimum detection confidence threshold",
    )
    model_device: str = Field(
        default="",
        description="Inference device: 'cpu', 'cuda', 'mps', or '' for auto",
    )

    # ------------------------------------------------------------------ #
    # Camera / Video source
    # ------------------------------------------------------------------ #
    camera_source: str = Field(
        default="0",
        description="Video source: integer index, file path, or RTSP URL",
    )

    # ------------------------------------------------------------------ #
    # MQTT
    # ------------------------------------------------------------------ #
    mqtt_host: str = Field(default="localhost", description="MQTT broker host")
    mqtt_port: int = Field(default=1883, ge=1, le=65535, description="MQTT broker port")
    mqtt_user: str = Field(default="", description="MQTT username")
    mqtt_password: str = Field(
        default="",
        repr=False,  # Never print password in logs
        description="MQTT password",
    )
    mqtt_client_id: str = Field(
        default="edge-cv-service",
        description="MQTT client identifier",
    )

    # ------------------------------------------------------------------ #
    # HTTP / CORS
    # ------------------------------------------------------------------ #
    cors_origins: str = Field(
        default="*",
        description="Comma-separated list of allowed CORS origins",
    )

    # ------------------------------------------------------------------ #
    # Validators
    # ------------------------------------------------------------------ #

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}, got '{v}'")
        return upper

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse the comma-separated CORS origins string into a list."""
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


# Module-level singleton — import and use this everywhere
settings = AppSettings()
