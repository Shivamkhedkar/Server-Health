import os
import secrets
import warnings
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "DevOps Monitor Pro"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", os.getenv("ENV", "development"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    # Short-lived access token + longer-lived refresh token, instead of a
    # single 24h-lived access token. A stolen/leaked access token is now
    # only useful for a short window; the refresh token (only ever sent to
    # POST /auth/refresh, never attached to ordinary API calls) is what
    # actually keeps the user signed in. See app/api/auth.py.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Seed password for the auto-created default "admin" account on first
    # boot. Previously hard-coded to "admin123" directly in main.py; that's
    # a hard-coded credential and, more importantly, meant every fresh
    # deployment of this project started with the exact same publicly
    # documented password. Now it's operator-controlled via env, still
    # defaulting to admin123 in dev for a frictionless first run, but
    # required to be explicitly set in production (see main.py).
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "")

    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "devops_monitor")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            if self.ENVIRONMENT.lower() in ("production", "prod"):
                raise ValueError(
                    "CRITICAL SECURITY ERROR: SECRET_KEY environment variable must be set in production mode!"
                )
            else:
                self.SECRET_KEY = secrets.token_hex(32)
                warnings.warn("SECRET_KEY not set in environment. Using generated transient dev key.")

        if not self.ADMIN_DEFAULT_PASSWORD:
            if self.ENVIRONMENT.lower() in ("production", "prod"):
                raise ValueError(
                    "CRITICAL SECURITY ERROR: ADMIN_DEFAULT_PASSWORD environment variable "
                    "must be set in production mode (used only the very first time the "
                    "admin account is seeded)!"
                )
            self.ADMIN_DEFAULT_PASSWORD = "admin123"
            warnings.warn(
                "ADMIN_DEFAULT_PASSWORD not set in environment. Using 'admin123' for the "
                "seeded dev admin account - change this immediately if this is anything "
                "other than a local dev instance."
            )

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis Cache
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))

    # SMTP Config
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")

    # Telegram Bot Config
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    # CORS Origins
    CORS_ALLOWED_ORIGINS: str = os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:80,http://127.0.0.1:3000,http://127.0.0.1:80"
    )

    @property
    def cors_origins(self) -> list:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    # Threshold Settings
    CPU_THRESHOLD_CRITICAL: float = 85.0
    RAM_THRESHOLD_CRITICAL: float = 90.0
    DISK_THRESHOLD_CRITICAL: float = 90.0

    class Config:
        case_sensitive = True


settings = Settings()
