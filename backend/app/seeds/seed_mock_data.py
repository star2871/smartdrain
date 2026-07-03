"""
프론트-백엔드 연동 테스트용 목 데이터를 생성하는 seed 스크립트입니다.

주요 역할:
- SmartDrain 대시보드와 상세 화면 테스트용 빗물받이 데이터 생성
- 각 빗물받이에 센서, YOLO, XGBoost 결과 데이터 함께 생성
- 이미 존재하는 drain_code는 중복 생성하지 않고 건너뜀
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.drain import Drain
from app.models.sensor_data import SensorData
from app.models.xgboost_result import XgboostResult
from app.models.yolo_result import YoloResult

MOCK_IMAGE_URL_PREFIX = "/api/mock-images"
PROJECT_ROOT_DIR = Path(__file__).resolve().parents[3]
MOCK_IMAGE_SOURCE_DIR = PROJECT_ROOT_DIR / "mock_data" / "ai_image_samples"


@dataclass(frozen=True)
class MockDrainData:
    drain_code: str
    name: str
    address: str
    latitude: float
    longitude: float
    risk_level: str
    risk_score: float
    obstruction_ratio: float
    confidence_score: float
    water_level_cm: float
    flow_velocity_mps: float
    yolo_status: str
    final_decision: str


MOCK_DRAINS: tuple[MockDrainData, ...] = (
    MockDrainData(
        drain_code="DR-001",
        name="시청역 1번 출구 빗물받이",
        address="서울특별시 중구 세종대로 110",
        latitude=37.5665,
        longitude=126.9780,
        risk_level="good",
        risk_score=0.12,
        obstruction_ratio=0.10,
        confidence_score=0.95,
        water_level_cm=12,
        flow_velocity_mps=1.20,
        yolo_status="clear",
        final_decision="막힘과 수위가 낮아 정상 상태입니다.",
    ),
    MockDrainData(
        drain_code="DR-002",
        name="강남역 6번 출구 빗물받이",
        address="서울특별시 강남구 강남대로 396",
        latitude=37.4979,
        longitude=127.0276,
        risk_level="good",
        risk_score=0.20,
        obstruction_ratio=0.20,
        confidence_score=0.92,
        water_level_cm=20,
        flow_velocity_mps=0.90,
        yolo_status="clear",
        final_decision="배수 흐름이 안정적이며 위험도는 낮습니다.",
    ),
    MockDrainData(
        drain_code="DR-003",
        name="홍대입구역 9번 출구 빗물받이",
        address="서울특별시 마포구 양화로 160",
        latitude=37.5572,
        longitude=126.9245,
        risk_level="caution",
        risk_score=0.58,
        obstruction_ratio=0.62,
        confidence_score=0.89,
        water_level_cm=48,
        flow_velocity_mps=0.40,
        yolo_status="partially_blocked",
        final_decision="일부 막힘이 감지되어 주의 관찰이 필요합니다.",
    ),
    MockDrainData(
        drain_code="DR-004",
        name="어린이대공원역 4번 출구 빗물받이",
        address="서울특별시 광진구 능동로 120",
        latitude=37.5472,
        longitude=127.0743,
        risk_level="danger",
        risk_score=0.91,
        obstruction_ratio=0.88,
        confidence_score=0.94,
        water_level_cm=85,
        flow_velocity_mps=0.05,
        yolo_status="blocked",
        final_decision="막힘률과 수위가 높아 침수 위험이 큽니다.",
    ),
    MockDrainData(
        drain_code="DR-005",
        name="잠실역 2번 출구 빗물받이",
        address="서울특별시 송파구 올림픽로 265",
        latitude=37.5133,
        longitude=127.1002,
        risk_level="unknown",
        risk_score=0.0,
        obstruction_ratio=0.00,
        confidence_score=0.30,
        water_level_cm=0,
        flow_velocity_mps=0.00,
        yolo_status="unknown",
        final_decision="센서 및 이미지 신뢰도가 낮아 위험도를 판단하기 어렵습니다.",
    ),
)


def _create_mock_drain(db: Session, item: MockDrainData, measured_at: datetime) -> None:
    drain = Drain(
        drain_code=item.drain_code,
        name=item.name,
        address=item.address,
        latitude=item.latitude,
        longitude=item.longitude,
        status=item.risk_level,
    )
    db.add(drain)
    db.flush()

    sensor_data = SensorData(
        drain_id=drain.id,
        water_level_cm=item.water_level_cm,
        flow_velocity_mps=item.flow_velocity_mps,
        measured_at=measured_at,
    )
    db.add(sensor_data)
    db.flush()

    yolo_result = YoloResult(
        drain_id=drain.id,
        image_url=_mock_image_url(drain.id),
        obstruction_ratio=item.obstruction_ratio,
        confidence_score=item.confidence_score,
        yolo_status=item.yolo_status,
        captured_at=measured_at,
    )
    db.add(yolo_result)
    db.flush()

    xgboost_result = XgboostResult(
        drain_id=drain.id,
        sensor_data_id=sensor_data.id,
        yolo_result_id=yolo_result.id,
        risk_score=item.risk_score,
        risk_level=item.risk_level,
        final_decision=item.final_decision,
        evaluated_at=measured_at,
    )
    db.add(xgboost_result)


def _mock_image_url(drain_id: int) -> str | None:
    image_path = MOCK_IMAGE_SOURCE_DIR / f"drain_{drain_id}.jpg"
    if not image_path.is_file():
        return None
    return f"{MOCK_IMAGE_URL_PREFIX}/drain_{drain_id}.jpg"


def _backfill_mock_image_url(db: Session, drain: Drain) -> bool:
    image_url = _mock_image_url(drain.id)
    if image_url is None:
        return False

    updated = False
    yolo_results = (
        db.query(YoloResult)
        .filter(YoloResult.drain_id == drain.id)
        .order_by(YoloResult.captured_at.desc())
        .all()
    )
    for yolo_result in yolo_results:
        if not yolo_result.image_url:
            yolo_result.image_url = image_url
            updated = True
    return updated


def _summary_line(item: MockDrainData, skipped: bool = False) -> str:
    status = " | 이미 존재함 / 건너뜀" if skipped else ""
    return (
        f"- {item.drain_code} | {item.risk_level} | "
        f"obstructionRatio={item.obstruction_ratio:.2f} | "
        f"waterLevelCm={item.water_level_cm:g} | "
        f"flowVelocityMps={item.flow_velocity_mps:.2f} | "
        f"yoloStatus={item.yolo_status} | "
        f"finalDecision={item.final_decision}"
        f"{status}"
    )


def seed_mock_data() -> None:
    created: list[MockDrainData] = []
    skipped: list[MockDrainData] = []
    now = datetime.now(timezone.utc)

    db = SessionLocal()
    try:
        for index, item in enumerate(MOCK_DRAINS):
            existing = db.scalars(select(Drain).where(Drain.drain_code == item.drain_code)).first()
            if existing:
                _backfill_mock_image_url(db, existing)
                skipped.append(item)
                continue

            _create_mock_drain(db, item, now - timedelta(minutes=(len(MOCK_DRAINS) - index) * 5))
            created.append(item)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("[SEED 완료]")
    print("생성된 목 데이터:")
    for item in created:
        print(_summary_line(item))
    for item in skipped:
        print(_summary_line(item, skipped=True))
    print()
    print(f"생성 개수: {len(created)}")
    print(f"건너뛴 개수: {len(skipped)}")


if __name__ == "__main__":
    seed_mock_data()
