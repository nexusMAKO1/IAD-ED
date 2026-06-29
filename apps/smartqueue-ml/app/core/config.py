from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ML_PORT: int = 8002
    ML_LOG_LEVEL: str = "INFO"
    MODEL_SKIP_LOAD: bool = False

    POSTGRES_DB: str = "iad_db"
    POSTGRES_USER: str = "iad_user"
    POSTGRES_PASSWORD: str
    POSTGRES_PORT: int = 5432

    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str

    MQTT_HOST: str = "mosquitto"
    MQTT_PORT: int = 1883
    MQTT_USER: str
    MQTT_PASSWORD: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
