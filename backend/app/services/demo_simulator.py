from __future__ import annotations

import asyncio
import json
import logging
import random
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.analysis_job import AnalysisJob
from app.models.drain import Drain
from app.models.sensor_data import SensorData
from app.models.xgboost_result import XgboostResult
from app.models.yolo_result import YoloResult
from app.schemas.api_response import drain_status_event_payload, format_datetime
from app.services import analysis_async_service
from app.websocket.events import DRAIN_STATUS_UPDATED, XGBOOST_RESULT_UPDATED, YOLO_RESULT_UPDATED
from app.websocket.manager import manager

LOGGER = logging.getLogger(__name__)
PROJECT_ROOT_DIR = Path(__file__).resolve().parents[3]
DEMO_IMAGE_SOURCE_DIR = PROJECT_ROOT_DIR / "mock_data" / "ai_image_samples" / "demo"
DEMO_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
MANUAL_PRESETS = {"GOOD", "CAUTION", "DANGER", "UNAVAILABLE"}
WEATHER_STEPS = ("CLEAR", "LIGHT_RAIN", "HEAVY_RAIN", "CLOUDBURST", "RAIN_WEAKENING", "RECOVERY")
REHEARSAL_INTERVAL_SECONDS = (10, 15, 30, 60)


@dataclass
class DemoControlState:
    running: bool = False
    paused: bool = True
    weather_step_index: int = 0
    manual_overrides: set[str] | None = None
    scenario_task: asyncio.Task | None = None
    interval_seconds: int | None = None
    last_action: str = "initialized"
    last_error: str | None = None
    updated_at: str | None = None


@dataclass(frozen=True)
class DemoScenario:
    drain_code: str
    risk_level: str
    risk_score: float
    water_level_cm: float
    flow_velocity_mps: float
    obstruction_ratio: float
    confidence_score: float
    yolo_status: str
    final_decision: str


OVERVIEW_SCENARIOS: tuple[DemoScenario, ...] = (
    DemoScenario("DR-001", "good", 0.16, 24, 1.15, 0.14, 0.94, "clear", "normal"),
    DemoScenario("DR-002", "caution", 0.58, 55, 0.45, 0.58, 0.91, "partially_blocked", "field_check"),
    DemoScenario("DR-003", "danger", 0.91, 82, 0.12, 0.86, 0.94, "blocked", "dispatch_required"),
    DemoScenario("DR-004", "unknown", 0.0, 31, 1.20, 0.0, 0.30, "unknown", "monitoring"),
    DemoScenario("DR-005", "good", 0.18, 7, 0.30, 0.08, 0.93, "clear", "normal"),
)

STORY_SCENARIOS: tuple[DemoScenario, ...] = (
    DemoScenario("DR-003", "good", 0.18, 24, 1.15, 0.16, 0.93, "clear", "normal"),
    DemoScenario("DR-003", "caution", 0.62, 55, 0.45, 0.62, 0.90, "partially_blocked", "field_check"),
    DemoScenario("DR-003", "danger", 0.92, 82, 0.12, 0.88, 0.94, "blocked", "dispatch_required"),
    DemoScenario("DR-003", "unknown", 0.0, 18, 0.20, 0.0, 0.30, "unknown", "monitoring"),
    DemoScenario("DR-003", "caution", 0.54, 48, 0.55, 0.48, 0.88, "partially_blocked", "field_check"),
)

ACTIVE_JOB_STATUSES = {"processing", "yolo_completed"}
SUPPORTED_MODES = {"direct", "async"}
SENSOR_RANGES = {
    "good": ((18.0, 32.0), (0.95, 1.35)),
    "caution": ((48.0, 64.0), (0.35, 0.65)),
    "danger": ((76.0, 90.0), (0.05, 0.22)),
    "unknown": ((0.0, 20.0), (0.0, 0.25)),
}
ANALYSIS_RANGES = {
    "good": ((0.12, 0.24), (0.10, 0.22), (0.90, 0.96)),
    "caution": ((0.52, 0.68), (0.48, 0.66), (0.86, 0.93)),
    "danger": ((0.86, 0.96), (0.80, 0.92), (0.90, 0.96)),
    "unknown": ((0.0, 0.08), (0.0, 0.08), (0.25, 0.38)),
}
SCENARIO_SENSOR_RANGES = {
    "good": ((4.0, 12.0), (0.18, 0.50), (0.04, 0.18), (0.90, 0.98), (0.08, 0.22)),
    "caution": ((16.0, 30.0), (0.55, 1.15), (0.26, 0.50), (0.84, 0.94), (0.48, 0.68)),
    "danger": ((34.0, 60.0), (1.05, 1.90), (0.58, 0.92), (0.88, 0.97), (0.84, 0.96)),
    "unknown": ((20.0, 36.0), (0.45, 1.20), (0.0, 0.08), (0.22, 0.38), (0.0, 0.08)),
}
FACILITY_BEHAVIOR = {
    "DR-001": {"water": 0.70, "flow": 0.85, "obstruction": 0.75, "recovery": 1.20},
    "DR-002": {"water": 1.05, "flow": 0.90, "obstruction": 1.35, "recovery": 0.95},
    "DR-003": {"water": 1.35, "flow": 1.10, "obstruction": 1.05, "recovery": 0.90},
    "DR-004": {"water": 1.00, "flow": 1.00, "obstruction": 0.90, "recovery": 1.00},
    "DR-005": {"water": 1.10, "flow": 0.85, "obstruction": 1.05, "recovery": 0.55},
}
SMOOTHING_RATIO = 0.58

PRESET_SCENARIOS: dict[str, DemoScenario] = {
    "GOOD": DemoScenario("", "good", 0.16, 7, 0.30, 0.08, 0.94, "clear", "normal"),
    "CAUTION": DemoScenario("", "caution", 0.58, 23, 0.80, 0.38, 0.91, "partially_blocked", "field_check"),
    "DANGER": DemoScenario("", "danger", 0.92, 46, 1.60, 0.78, 0.94, "blocked", "dispatch_required"),
    "UNAVAILABLE": DemoScenario("", "unknown", 0.0, 31, 1.20, 0.0, 0.30, "unknown", "monitoring"),
}

WEATHER_SCENARIOS: dict[str, dict[str, str]] = {
    "CLEAR": {
        "DR-001": "GOOD",
        "DR-002": "GOOD",
        "DR-003": "GOOD",
        "DR-004": "GOOD",
        "DR-005": "GOOD",
    },
    "LIGHT_RAIN": {
        "DR-001": "GOOD",
        "DR-002": "GOOD",
        "DR-003": "CAUTION",
        "DR-004": "GOOD",
        "DR-005": "GOOD",
    },
    "HEAVY_RAIN": {
        "DR-001": "GOOD",
        "DR-002": "CAUTION",
        "DR-003": "DANGER",
        "DR-004": "CAUTION",
        "DR-005": "CAUTION",
    },
    "CLOUDBURST": {
        "DR-001": "CAUTION",
        "DR-002": "DANGER",
        "DR-003": "DANGER",
        "DR-004": "UNAVAILABLE",
        "DR-005": "CAUTION",
    },
    "RAIN_WEAKENING": {
        "DR-001": "GOOD",
        "DR-002": "CAUTION",
        "DR-003": "CAUTION",
        "DR-004": "CAUTION",
        "DR-005": "CAUTION",
    },
    "RECOVERY": {
        "DR-001": "GOOD",
        "DR-002": "GOOD",
        "DR-003": "GOOD",
        "DR-004": "GOOD",
        "DR-005": "GOOD",
    },
}

_CONTROL_STATE = DemoControlState(manual_overrides=set())
_CONTROL_LOCK = asyncio.Lock()


def start_demo_simulator(app) -> None:
    if not settings.DEMO_SIMULATOR_ENABLED:
        LOGGER.info("Demo simulator is disabled")
        return

    if not settings.DEMO_SIMULATOR_AUTO_START:
        LOGGER.info("Demo simulator control is enabled; auto start is disabled")
        return

    mode = settings.DEMO_SIMULATOR_MODE.strip().lower()
    if mode not in SUPPORTED_MODES:
        LOGGER.warning("Demo simulator mode '%s' is invalid; falling back to direct", mode)
        mode = "direct"

    app.state.demo_simulator_task = asyncio.create_task(_demo_loop(mode))
    _CONTROL_STATE.running = True
    _CONTROL_STATE.paused = False
    _CONTROL_STATE.scenario_task = app.state.demo_simulator_task
    LOGGER.info(
        "Demo simulator started: mode=%s interval=%ss start_delay=%ss target=%s",
        mode,
        settings.DEMO_SIMULATOR_INTERVAL_SECONDS,
        settings.DEMO_SIMULATOR_START_DELAY_SECONDS,
        settings.DEMO_SIMULATOR_TARGET_DRAIN_CODE,
    )


async def stop_demo_simulator(app) -> None:
    task = getattr(app.state, "demo_simulator_task", None)
    controlled_task = _CONTROL_STATE.scenario_task
    if controlled_task is not None and controlled_task is not task:
        controlled_task.cancel()
        try:
            await controlled_task
        except asyncio.CancelledError:
            LOGGER.info("Demo control scenario stopped")
    _CONTROL_STATE.running = False
    _CONTROL_STATE.paused = True
    _CONTROL_STATE.scenario_task = None
    if task is None:
        return

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        LOGGER.info("Demo simulator stopped")


async def _demo_loop(mode: str) -> None:
    await asyncio.sleep(settings.DEMO_SIMULATOR_START_DELAY_SECONDS)
    await _run_overview(mode)

    step = 0
    while True:
        await asyncio.sleep(settings.DEMO_SIMULATOR_INTERVAL_SECONDS)
        scenario = _retarget_scenario(
            STORY_SCENARIOS[step % len(STORY_SCENARIOS)],
            settings.DEMO_SIMULATOR_TARGET_DRAIN_CODE,
        )
        await _apply_scenario(mode, scenario)
        step += 1


async def _run_overview(mode: str) -> None:
    for scenario in OVERVIEW_SCENARIOS:
        await _apply_scenario(mode, scenario)
        await asyncio.sleep(0.2)


async def get_demo_status() -> dict[str, Any]:
    async with _CONTROL_LOCK:
        return _control_status()


async def apply_manual_preset(
    db: Session,
    drain_code: str,
    preset: str,
    water_level_cm: float | None = None,
    flow_velocity_mps: float | None = None,
) -> dict[str, Any]:
    normalized_preset = preset.strip().upper()
    if normalized_preset not in MANUAL_PRESETS:
        raise ValueError(f"Unsupported demo preset: {preset}")

    scenario = _scenario_from_preset(drain_code, normalized_preset)
    scenario = replace(
        scenario,
        water_level_cm=_clamp_float(
            settings.DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM if water_level_cm is None else water_level_cm,
            0.0,
            120.0,
            1,
        ),
        flow_velocity_mps=_clamp_float(
            settings.DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS if flow_velocity_mps is None else flow_velocity_mps,
            0.0,
            3.0,
            2,
        ),
    )
    drain = _get_drain_by_code(db, scenario.drain_code)
    if drain is None:
        raise LookupError(f"Drain not found: {scenario.drain_code}")

    await _apply_direct_scenario(db, drain, scenario)
    async with _CONTROL_LOCK:
        assert _CONTROL_STATE.manual_overrides is not None
        _CONTROL_STATE.manual_overrides.add(scenario.drain_code)
        _mark_control_action(f"manual:{scenario.drain_code}:{normalized_preset}")
        return _control_status()


async def clear_manual_override(drain_code: str) -> dict[str, Any]:
    async with _CONTROL_LOCK:
        assert _CONTROL_STATE.manual_overrides is not None
        _CONTROL_STATE.manual_overrides.discard(drain_code.strip())
        _mark_control_action(f"override-cleared:{drain_code.strip()}")
        return _control_status()


async def reset_demo(db: Session) -> dict[str, Any]:
    await stop_controlled_scenario()
    for scenario in OVERVIEW_SCENARIOS:
        drain = _get_drain_by_code(db, scenario.drain_code)
        if drain is not None:
            await _apply_direct_scenario(db, drain, scenario)

    async with _CONTROL_LOCK:
        assert _CONTROL_STATE.manual_overrides is not None
        _CONTROL_STATE.manual_overrides.clear()
        _CONTROL_STATE.weather_step_index = 0
        _mark_control_action("reset")
        return _control_status()


async def recover_demo(db: Session) -> dict[str, Any]:
    await stop_controlled_scenario()
    await _apply_weather_step(db, "RECOVERY")
    async with _CONTROL_LOCK:
        assert _CONTROL_STATE.manual_overrides is not None
        _CONTROL_STATE.manual_overrides.clear()
        _CONTROL_STATE.weather_step_index = WEATHER_STEPS.index("RECOVERY")
        _mark_control_action("recover")
        return _control_status()


async def start_controlled_scenario() -> dict[str, Any]:
    async with _CONTROL_LOCK:
        if _CONTROL_STATE.scenario_task is None or _CONTROL_STATE.scenario_task.done():
            _CONTROL_STATE.scenario_task = asyncio.create_task(_controlled_scenario_loop())
        _CONTROL_STATE.running = True
        _CONTROL_STATE.paused = False
        _mark_control_action("scenario-start")
        return _control_status()


async def pause_controlled_scenario() -> dict[str, Any]:
    async with _CONTROL_LOCK:
        _CONTROL_STATE.paused = True
        _mark_control_action("scenario-pause")
        return _control_status()


async def resume_controlled_scenario() -> dict[str, Any]:
    async with _CONTROL_LOCK:
        if _CONTROL_STATE.scenario_task is None or _CONTROL_STATE.scenario_task.done():
            _CONTROL_STATE.scenario_task = asyncio.create_task(_controlled_scenario_loop())
        _CONTROL_STATE.running = True
        _CONTROL_STATE.paused = False
        _mark_control_action("scenario-resume")
        return _control_status()


async def stop_controlled_scenario() -> dict[str, Any]:
    task = _CONTROL_STATE.scenario_task
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async with _CONTROL_LOCK:
        _CONTROL_STATE.running = False
        _CONTROL_STATE.paused = True
        _CONTROL_STATE.scenario_task = None
        _mark_control_action("scenario-stop")
        return _control_status()


async def next_scenario_step(db: Session) -> dict[str, Any]:
    async with _CONTROL_LOCK:
        _CONTROL_STATE.weather_step_index = (_CONTROL_STATE.weather_step_index + 1) % len(WEATHER_STEPS)
        weather_step = WEATHER_STEPS[_CONTROL_STATE.weather_step_index]

    await _apply_weather_step(db, weather_step)

    async with _CONTROL_LOCK:
        _mark_control_action(f"scenario-next:{weather_step}")
        return _control_status()


async def apply_scenario_step(db: Session, weather_step: str) -> dict[str, Any]:
    normalized_step = weather_step.strip().upper()
    if normalized_step not in WEATHER_STEPS:
        raise ValueError(f"Unsupported weather step: {weather_step}")

    async with _CONTROL_LOCK:
        _CONTROL_STATE.weather_step_index = WEATHER_STEPS.index(normalized_step)

    await _apply_weather_step(db, normalized_step)

    async with _CONTROL_LOCK:
        _mark_control_action(f"scenario-step:{normalized_step}")
        return _control_status()


async def set_scenario_interval(interval_seconds: int) -> dict[str, Any]:
    if interval_seconds < 5 or interval_seconds > 300:
        raise ValueError("Scenario interval must be between 5 and 300 seconds")

    async with _CONTROL_LOCK:
        _CONTROL_STATE.interval_seconds = interval_seconds
        _mark_control_action(f"scenario-interval:{interval_seconds}")
        return _control_status()


async def _controlled_scenario_loop() -> None:
    try:
        while True:
            async with _CONTROL_LOCK:
                running = _CONTROL_STATE.running
                paused = _CONTROL_STATE.paused
                weather_step = WEATHER_STEPS[_CONTROL_STATE.weather_step_index]
                interval_seconds = _scenario_interval_seconds()

            if not running:
                await asyncio.sleep(1)
                continue

            if paused:
                await asyncio.sleep(1)
                continue

            try:
                with SessionLocal() as db:
                    await _apply_weather_step(db, weather_step)
            except Exception as exc:
                LOGGER.exception("Demo scenario step failed: weather_step=%s", weather_step)
                async with _CONTROL_LOCK:
                    _CONTROL_STATE.last_error = str(exc)

            await asyncio.sleep(interval_seconds)
            async with _CONTROL_LOCK:
                _CONTROL_STATE.weather_step_index = (_CONTROL_STATE.weather_step_index + 1) % len(WEATHER_STEPS)
    except asyncio.CancelledError:
        raise


async def _apply_weather_step(db: Session, weather_step: str) -> None:
    scenarios = WEATHER_SCENARIOS.get(weather_step, WEATHER_SCENARIOS["CLEAR"])
    manual_overrides = set(_CONTROL_STATE.manual_overrides or set())
    for drain_code, preset in scenarios.items():
        if drain_code in manual_overrides:
            continue
        drain = _get_drain_by_code(db, drain_code)
        if drain is None:
            LOGGER.warning("Demo scenario skipped missing drain: %s", drain_code)
            continue
        scenario = _scenario_from_preset(drain_code, preset)
        if settings.DEMO_SIMULATOR_RANDOMIZE:
            scenario = _naturalize_weather_scenario(db, drain, scenario)
        await _apply_direct_scenario(db, drain, scenario)
        await asyncio.sleep(0.05)


async def _apply_scenario(mode: str, scenario: DemoScenario) -> None:
    sampled_scenario = _sample_scenario(scenario)
    try:
        with SessionLocal() as db:
            drain = _get_drain_by_code(db, sampled_scenario.drain_code)
            if drain is None:
                LOGGER.warning("Demo simulator skipped missing drain: %s", sampled_scenario.drain_code)
                return

            if mode == "async":
                await _apply_async_scenario(db, drain, sampled_scenario)
                return

            await _apply_direct_scenario(db, drain, sampled_scenario)
    except asyncio.CancelledError:
        raise
    except Exception:
        LOGGER.exception("Demo simulator step failed: drain_code=%s", sampled_scenario.drain_code)


async def _apply_async_scenario(db: Session, drain: Drain, scenario: DemoScenario) -> None:
    if _has_active_job(db, drain.id):
        LOGGER.info("Demo simulator skipped active analysis job: drain_code=%s", scenario.drain_code)
        return

    sensor_data = _create_sensor_data(db, drain.id, scenario)
    db.commit()
    db.refresh(sensor_data)
    await analysis_async_service.start_analysis_for_drain(db, drain, trigger_type="demo")


async def _apply_direct_scenario(db: Session, drain: Drain, scenario: DemoScenario) -> None:
    now = datetime.now(timezone.utc)
    sensor_data = _create_sensor_data(db, drain.id, scenario, measured_at=now)
    db.flush()

    yolo_result = YoloResult(
        drain_id=drain.id,
        image_url=_mock_image_url(drain.id, scenario.risk_level),
        obstruction_ratio=scenario.obstruction_ratio,
        confidence_score=scenario.confidence_score,
        yolo_status=scenario.yolo_status,
        captured_at=now,
    )
    db.add(yolo_result)
    db.flush()

    xgboost_result = XgboostResult(
        drain_id=drain.id,
        sensor_data_id=sensor_data.id,
        yolo_result_id=yolo_result.id,
        risk_score=scenario.risk_score,
        risk_level=scenario.risk_level,
        final_decision=scenario.final_decision,
        evaluated_at=now,
    )
    drain.status = scenario.risk_level
    db.add(xgboost_result)
    db.flush()

    request_id = _create_demo_request_id(drain.id, now)
    job = AnalysisJob(
        request_id=request_id,
        job_id=f"AI_JOB_{request_id}",
        drain_id=drain.id,
        sensor_data_id=sensor_data.id,
        sensor_measured_at=sensor_data.measured_at,
        yolo_result_id=yolo_result.id,
        status="completed",
        trigger_type="demo",
    )
    db.add(job)
    db.commit()
    db.refresh(yolo_result)
    db.refresh(xgboost_result)

    await _broadcast_events(db, drain, sensor_data, yolo_result, xgboost_result)
    LOGGER.info(
        "Demo simulator applied: drain_code=%s risk=%s water=%s flow=%s",
        scenario.drain_code,
        scenario.risk_level,
        scenario.water_level_cm,
        scenario.flow_velocity_mps,
    )


def _create_sensor_data(
    db: Session,
    drain_id: int,
    scenario: DemoScenario,
    measured_at: datetime | None = None,
) -> SensorData:
    sensor_data = SensorData(
        drain_id=drain_id,
        water_level_cm=scenario.water_level_cm,
        flow_velocity_mps=scenario.flow_velocity_mps,
        measured_at=measured_at or datetime.now(timezone.utc),
    )
    db.add(sensor_data)
    return sensor_data


def _sample_scenario(scenario: DemoScenario) -> DemoScenario:
    sensor_ranges = SENSOR_RANGES.get(scenario.risk_level)
    analysis_ranges = ANALYSIS_RANGES.get(scenario.risk_level)
    if sensor_ranges is None or analysis_ranges is None:
        return scenario

    water_level_range, flow_velocity_range = sensor_ranges
    risk_score_range, obstruction_ratio_range, confidence_score_range = analysis_ranges

    return DemoScenario(
        drain_code=scenario.drain_code,
        risk_level=scenario.risk_level,
        risk_score=_sample_float(*risk_score_range, digits=4),
        water_level_cm=_sample_float(*water_level_range, digits=1),
        flow_velocity_mps=_sample_float(*flow_velocity_range, digits=2),
        obstruction_ratio=_sample_float(*obstruction_ratio_range, digits=4),
        confidence_score=_sample_float(*confidence_score_range, digits=4),
        yolo_status=scenario.yolo_status,
        final_decision=scenario.final_decision,
    )


def _scenario_from_preset(drain_code: str, preset: str) -> DemoScenario:
    scenario = PRESET_SCENARIOS[preset]
    return replace(scenario, drain_code=drain_code.strip())


def _naturalize_weather_scenario(db: Session, drain: Drain, scenario: DemoScenario) -> DemoScenario:
    ranges = SCENARIO_SENSOR_RANGES.get(scenario.risk_level)
    if ranges is None:
        return scenario

    water_range, flow_range, obstruction_range, confidence_range, risk_range = ranges
    behavior = FACILITY_BEHAVIOR.get(drain.drain_code, {})
    recovery_factor = float(behavior.get("recovery", 1.0))
    latest_sensor = _latest_sensor_data(db, drain.id)
    latest_yolo = _latest_yolo_result(db, drain.id)

    sampled_water = _sample_scaled_value(water_range, float(behavior.get("water", 1.0)), max_value=95.0)
    sampled_flow = _sample_scaled_value(flow_range, float(behavior.get("flow", 1.0)), max_value=2.5)
    sampled_obstruction = _sample_scaled_value(
        obstruction_range,
        float(behavior.get("obstruction", 1.0)),
        max_value=0.98,
    )

    if latest_sensor is not None:
        sampled_water = _smooth_value(latest_sensor.water_level_cm, sampled_water, recovery_factor)
        sampled_flow = _smooth_value(latest_sensor.flow_velocity_mps, sampled_flow, recovery_factor)

    if latest_yolo is not None:
        sampled_obstruction = _smooth_value(
            latest_yolo.obstruction_ratio,
            sampled_obstruction,
            recovery_factor,
        )

    return replace(
        scenario,
        water_level_cm=round(sampled_water, 1),
        flow_velocity_mps=round(sampled_flow, 2),
        obstruction_ratio=round(sampled_obstruction, 4),
        confidence_score=_sample_float(*confidence_range, digits=4),
        risk_score=_sample_float(*risk_range, digits=4),
    )


def _retarget_scenario(scenario: DemoScenario, drain_code: str) -> DemoScenario:
    target_drain_code = drain_code.strip()
    if not target_drain_code or target_drain_code == scenario.drain_code:
        return scenario

    return DemoScenario(
        drain_code=target_drain_code,
        risk_level=scenario.risk_level,
        risk_score=scenario.risk_score,
        water_level_cm=scenario.water_level_cm,
        flow_velocity_mps=scenario.flow_velocity_mps,
        obstruction_ratio=scenario.obstruction_ratio,
        confidence_score=scenario.confidence_score,
        yolo_status=scenario.yolo_status,
        final_decision=scenario.final_decision,
    )


def _sample_float(minimum: float, maximum: float, digits: int) -> float:
    return round(random.uniform(minimum, maximum), digits)


def _sample_scaled_value(value_range: tuple[float, float], factor: float, max_value: float) -> float:
    minimum, maximum = value_range
    value = random.uniform(minimum, maximum) * factor
    return min(max_value, max(0.0, value))


def _smooth_value(current: float, target: float, recovery_factor: float) -> float:
    if target < current:
        ratio = min(0.85, SMOOTHING_RATIO * recovery_factor)
    else:
        ratio = SMOOTHING_RATIO
    return current + ((target - current) * ratio)


async def _broadcast_events(
    db: Session,
    drain: Drain,
    sensor_data: SensorData,
    yolo_result: YoloResult,
    xgboost_result: XgboostResult,
) -> None:
    yolo_event = {
        "type": YOLO_RESULT_UPDATED,
        "payload": {
            "drainId": drain.drain_code,
            "yoloResultId": yolo_result.id,
            "imageUrl": yolo_result.image_url,
            "obstructionRatio": yolo_result.obstruction_ratio,
            "confidenceScore": yolo_result.confidence_score,
            "yoloStatus": yolo_result.yolo_status,
            "capturedAt": format_datetime(yolo_result.captured_at),
            "analyzedAt": format_datetime(yolo_result.created_at),
            "updatedAt": format_datetime(yolo_result.created_at),
        },
    }
    xgboost_event = {
        "type": XGBOOST_RESULT_UPDATED,
        "payload": {
            "drainId": drain.drain_code,
            "xgboostResultId": xgboost_result.id,
            "sensorDataId": xgboost_result.sensor_data_id,
            "yoloResultId": xgboost_result.yolo_result_id,
            "riskLevel": xgboost_result.risk_level,
            "riskScore": xgboost_result.risk_score,
            "finalDecision": xgboost_result.final_decision,
            "evaluatedAt": format_datetime(xgboost_result.evaluated_at),
            "updatedAt": format_datetime(xgboost_result.evaluated_at),
        },
    }
    status_event = drain_status_event_payload(
        db,
        drain,
        xgboost_result,
        sensor_data=sensor_data,
        yolo_result=yolo_result,
    )
    status_event["type"] = DRAIN_STATUS_UPDATED

    for event in (yolo_event, xgboost_event, status_event):
        await manager.broadcast(json.dumps(event))


def _get_drain_by_code(db: Session, drain_code: str) -> Drain | None:
    return db.query(Drain).filter(Drain.drain_code == drain_code).first()


def _latest_sensor_data(db: Session, drain_id: int) -> SensorData | None:
    return (
        db.query(SensorData)
        .filter(SensorData.drain_id == drain_id)
        .order_by(SensorData.measured_at.desc(), SensorData.id.desc())
        .first()
    )


def _latest_yolo_result(db: Session, drain_id: int) -> YoloResult | None:
    return (
        db.query(YoloResult)
        .filter(YoloResult.drain_id == drain_id)
        .order_by(YoloResult.captured_at.desc(), YoloResult.id.desc())
        .first()
    )


def _has_active_job(db: Session, drain_id: int) -> bool:
    return (
        db.query(AnalysisJob)
        .filter(
            AnalysisJob.drain_id == drain_id,
            AnalysisJob.status.in_(ACTIVE_JOB_STATUSES),
        )
        .first()
        is not None
    )


def _mock_image_url(drain_id: int, risk_level: str) -> str:
    for extension in DEMO_IMAGE_EXTENSIONS:
        image_path = DEMO_IMAGE_SOURCE_DIR / f"drain_{drain_id}_{risk_level}{extension}"
        if image_path.is_file():
            return f"/api/mock-images/demo/{image_path.name}"
    return f"/api/mock-images/drain_{drain_id}.jpg"


def _create_demo_request_id(drain_id: int, value: datetime) -> str:
    timestamp = value.strftime("%Y%m%d%H%M%S%f")
    return f"REQ_DEMO_{timestamp}_{drain_id}"


def _mark_control_action(action: str) -> None:
    _CONTROL_STATE.last_action = action
    _CONTROL_STATE.last_error = None
    _CONTROL_STATE.updated_at = datetime.now(timezone.utc).isoformat()


def _control_status() -> dict[str, Any]:
    return {
        "enabled": settings.DEMO_SIMULATOR_ENABLED,
        "mode": settings.DEMO_SIMULATOR_MODE,
        "autoStart": settings.DEMO_SIMULATOR_AUTO_START,
        "randomize": settings.DEMO_SIMULATOR_RANDOMIZE,
        "running": _CONTROL_STATE.running,
        "paused": _CONTROL_STATE.paused,
        "weatherStep": WEATHER_STEPS[_CONTROL_STATE.weather_step_index],
        "weatherStepIndex": _CONTROL_STATE.weather_step_index,
        "weatherSteps": list(WEATHER_STEPS),
        "manualOverrides": sorted(_CONTROL_STATE.manual_overrides or set()),
        "targetDrainCode": settings.DEMO_SIMULATOR_TARGET_DRAIN_CODE,
        "intervalSeconds": _scenario_interval_seconds(),
        "defaultIntervalSeconds": settings.DEMO_SIMULATOR_INTERVAL_SECONDS,
        "manualDefaultWaterLevelCm": settings.DEMO_MANUAL_DEFAULT_WATER_LEVEL_CM,
        "manualDefaultFlowVelocityMps": settings.DEMO_MANUAL_DEFAULT_FLOW_VELOCITY_MPS,
        "rehearsalIntervals": list(REHEARSAL_INTERVAL_SECONDS),
        "lastAction": _CONTROL_STATE.last_action,
        "lastError": _CONTROL_STATE.last_error,
        "updatedAt": _CONTROL_STATE.updated_at,
    }


def _scenario_interval_seconds() -> int:
    return _CONTROL_STATE.interval_seconds or settings.DEMO_SIMULATOR_INTERVAL_SECONDS


def _clamp_float(value: float, minimum: float, maximum: float, digits: int) -> float:
    return round(min(max(float(value), minimum), maximum), digits)
