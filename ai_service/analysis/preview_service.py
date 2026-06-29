from datetime import datetime, timedelta, timezone
from pathlib import Path

from ai_service.analysis.decision_mapper import map_risk_level_to_backend_decision
from ai_service.analysis.xgboost_adapter import build_xgboost_input_batch
from ai_service.yolo.analyzer import predict_yolo_by_image_path
from ai_service.xgboost.service import predict_flood_risk_batch

KST = timezone(timedelta(hours=9))


def run_preview_analysis(
    image_path: str | Path,
    water_level_cm: float,
    flow_velocity_mps: float,
    quality_status: str = "valid",
) -> dict:
    yolo_result = run_preview_yolo_analysis(image_path)
    xgboost_result = run_preview_xgboost_analysis(
        yolo_result,
        water_level_cm=water_level_cm,
        flow_velocity_mps=flow_velocity_mps,
        quality_status=quality_status,
    )

    return {
        "input": xgboost_result["input"],
        "yoloResult": yolo_result,
        "xgboostResult": xgboost_result["xgboostResult"],
        "createdAt": xgboost_result["createdAt"],
    }


def run_preview_yolo_analysis(image_path: str | Path) -> dict:
    yolo_result = predict_yolo_by_image_path(image_path)
    return _yolo_result_to_camel_case(yolo_result)


def run_preview_xgboost_analysis(
    yolo_result: dict,
    water_level_cm: float,
    flow_velocity_mps: float,
    quality_status: str = "valid",
) -> dict:
    if quality_status != "valid":
        raise ValueError("quality_status must be 'valid'.")

    sensor_data = {
        "water_level_cm": float(water_level_cm),
        "flow_velocity_mps": float(flow_velocity_mps),
        "quality_status": quality_status,
    }
    normalized_yolo_result = _yolo_result_to_snake_case(yolo_result)
    xgboost_input_batch = build_xgboost_input_batch(sensor_data, normalized_yolo_result)
    xgboost_result = predict_flood_risk_batch(xgboost_input_batch)[0]
    risk_level = xgboost_result["risk_level"]

    return {
        "input": {
            "waterLevelCm": sensor_data["water_level_cm"],
            "flowVelocityMps": sensor_data["flow_velocity_mps"],
            "qualityStatus": quality_status,
            "features": _feature_snapshot_to_camel_case(
                xgboost_result.get("feature_snapshot", {}),
            ),
        },
        "xgboostResult": {
            "riskScore": xgboost_result["risk_score"],
            "riskLevel": risk_level,
            "finalDecision": map_risk_level_to_backend_decision(risk_level),
            "modelVersion": xgboost_result.get("model_version"),
        },
        "createdAt": datetime.now(KST).isoformat(),
    }


def _yolo_result_to_camel_case(yolo_result: dict) -> dict:
    yolo_status = yolo_result["yolo_status"]
    return {
        "obstructionRatio": yolo_result["obstruction_ratio"],
        "confidenceScore": yolo_result["confidence_score"],
        "yoloStatus": _normalize_yolo_status(yolo_status),
        "rawYoloStatus": yolo_status,
    }


def _yolo_result_to_snake_case(yolo_result: dict) -> dict:
    if "obstruction_ratio" in yolo_result:
        return yolo_result

    raw_status = yolo_result.get("rawYoloStatus") or yolo_result.get("yoloStatus")
    return {
        "obstruction_ratio": yolo_result["obstructionRatio"],
        "confidence_score": yolo_result["confidenceScore"],
        "yolo_status": _denormalize_yolo_status(raw_status),
    }


def _feature_snapshot_to_camel_case(feature_snapshot: dict) -> dict:
    return {
        "obstructionRatio": feature_snapshot.get("obstruction_ratio"),
        "confidenceScore": feature_snapshot.get("confidence_score"),
        "waterLevel": feature_snapshot.get("water_level"),
        "flowVelocity": feature_snapshot.get("flow_velocity"),
    }


def _normalize_yolo_status(value: str) -> str:
    if value == "good":
        return "clear"
    if value == "dirty":
        return "partially_blocked"
    if value in {"blocked", "unknown"}:
        return value
    return "unknown"


def _denormalize_yolo_status(value: str) -> str:
    if value == "clear":
        return "good"
    if value == "partially_blocked":
        return "dirty"
    if value in {"blocked", "unknown", "good", "dirty"}:
        return value
    return "unknown"
