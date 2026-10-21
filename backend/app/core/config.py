"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development")
        self.app_name = os.getenv("APP_NAME", "Insight Agent")
        self.api_v1_prefix = os.getenv("API_V1_PREFIX", "/api/v1")
        self.app_timezone = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        self.frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

        self.api_host = os.getenv("API_HOST", "127.0.0.1")
        self.api_port = int(os.getenv("API_PORT", "8000"))
        self.auth_secret_key = os.getenv("AUTH_SECRET_KEY", "")
        self.admin_username = os.getenv("ADMIN_USERNAME", "")
        self.admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")

        self.database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/insight.db")
        self.checkpoint_database_url = os.getenv("CHECKPOINT_DATABASE_URL", "")

        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        self.ollama_text_model = os.getenv("OLLAMA_TEXT_MODEL", "")
        self.ollama_vision_model = os.getenv("OLLAMA_VISION_MODEL", "")

        self.llm_provider = os.getenv("LLM_PROVIDER", "")
        self.llm_api_key = os.getenv("LLM_API_KEY", "")
        self.llm_base_url = os.getenv("LLM_BASE_URL", "")
        self.llm_model = os.getenv("LLM_MODEL", "")
        self.llm_fallback_model = os.getenv("LLM_FALLBACK_MODEL", "")
        self.llm_daily_budget_inr = float(os.getenv("LLM_DAILY_BUDGET_INR", "50"))

        self.web_search_provider = os.getenv("WEB_SEARCH_PROVIDER", "")
        self.web_search_api_key = os.getenv("WEB_SEARCH_API_KEY", "")
        self.web_search_base_url = os.getenv("WEB_SEARCH_BASE_URL", "")

        self.instagram_app_id = os.getenv("INSTAGRAM_APP_ID", "")
        self.instagram_app_secret = os.getenv("INSTAGRAM_APP_SECRET", "")
        self.instagram_redirect_uri = os.getenv(
            "INSTAGRAM_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/instagram/callback"
        )
        self.instagram_api_version = os.getenv("INSTAGRAM_API_VERSION", "")
        self.instagram_access_token_encryption_key = os.getenv("INSTAGRAM_ACCESS_TOKEN_ENCRYPTION_KEY", "")

        self.browser_headless = os.getenv("BROWSER_HEADLESS", "false").lower() == "true"
        self.browser_storage_dir = os.getenv("BROWSER_STORAGE_DIR", "./private/browser")
        self.browser_login_required = os.getenv("BROWSER_LOGIN_REQUIRED", "true").lower() == "true"
        self.browser_action_timeout_ms = int(os.getenv("BROWSER_ACTION_TIMEOUT_MS", "15000"))

        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        self.telegram_enabled = os.getenv("TELEGRAM_ENABLED", "false").lower() == "true"

        self.daily_discovery_enabled = os.getenv("DAILY_DISCOVERY_ENABLED", "true").lower() == "true"
        self.daily_discovery_hour = int(os.getenv("DAILY_DISCOVERY_HOUR", "8"))
        self.daily_discovery_minute = int(os.getenv("DAILY_DISCOVERY_MINUTE", "0"))
        self.max_candidates_per_run = int(os.getenv("MAX_CANDIDATES_PER_RUN", "100"))
        self.max_deep_investigations = int(os.getenv("MAX_DEEP_INVESTIGATIONS", "20"))
        self.max_research_iterations = int(os.getenv("MAX_RESEARCH_ITERATIONS", "5"))
        self.max_concurrent_tasks = int(os.getenv("MAX_CONCURRENT_TASKS", "2"))
        self.max_run_duration_seconds = int(os.getenv("MAX_RUN_DURATION_SECONDS", "2700"))
        self.max_sources_per_discovery = int(os.getenv("MAX_SOURCES_PER_DISCOVERY", "8"))

        self.raw_content_retention_days = int(os.getenv("RAW_CONTENT_RETENTION_DAYS", "90"))
        self.comment_retention_days = int(os.getenv("COMMENT_RETENTION_DAYS", "30"))
        self.audit_retention_days = int(os.getenv("AUDIT_RETENTION_DAYS", "180"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
