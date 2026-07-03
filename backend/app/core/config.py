"""
백엔드 환경 설정 값을 관리하는 설정 파일입니다.

주요 역할:
- 프로젝트 이름, 데이터베이스 URL, CORS 허용 출처 정의
- 환경 변수 기반 설정 로드
- CORS 출처 문자열 파싱
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"
DEFAULT_DATABASE_URL = "postgresql+psycopg://smartdrain:smartdrain123@localhost:5432/smartdrain_db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Flood Monitoring Backend"
    DATABASE_URL: str = DEFAULT_DATABASE_URL
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    AI_SERVER_BASE_URL: str = "http://localhost:9000"
    AI_SERVER_TIMEOUT_SECONDS: int = 10
    AI_CALLBACK_BASE_URL: str = "http://localhost:8000"
    AI_SERVER_ENABLED: bool = True
    ANALYSIS_SCHEDULER_ENABLED: bool = False
    ANALYSIS_SCHEDULER_INTERVAL_SECONDS: int = 300
    ANALYSIS_SCHEDULER_INITIAL_DELAY_SECONDS: int = 60
    ANALYSIS_SENSOR_MAX_AGE_SECONDS: int = 300
    ANALYSIS_JOB_TIMEOUT_SECONDS: int = 600
    DEMO_SIMULATOR_ENABLED: bool = False
    DEMO_SIMULATOR_MODE: str = "direct"
    DEMO_SIMULATOR_INTERVAL_SECONDS: int = 30
    DEMO_SIMULATOR_START_DELAY_SECONDS: int = 10
    DEMO_SIMULATOR_TARGET_DRAIN_CODE: str = "DR-003"
    DEMO_SIMULATOR_AUTO_START: bool = False
    DEMO_SIMULATOR_RANDOMIZE: bool = True
    DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM: float = 30.0
    DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS: float = 0.8
    DEMO_CONTROL_TOKEN: str | None = None

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
