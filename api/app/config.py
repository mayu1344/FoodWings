from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings come from environment variables / .env file. No secrets in code or in the DB."""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://app_user:change_me_in_env@localhost:5432/swiggy_db"
    token_secret: str = "dev-only-secret-change-me"
    token_ttl_hours: int = 24
    otp_dev_mode: bool = True
    enable_mock_gateway: bool = True
    mockpay_webhook_secret: str = "dev-webhook-secret"
    log_file: str = "logs/app.log"
    # front-end origins allowed to call the API from another port (e.g. live-server / port 5500)
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,*"

    # business rules
    delivery_fee: float = 30.0
    platform_fee: float = 5.0
    tax_pct: float = 5.0
    search_radius_km: float = 7.0


settings = Settings()
