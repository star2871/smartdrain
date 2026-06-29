import logging
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from ai_service.analysis.callback_payloads import build_accepted_response
from ai_service.analysis.job_id import build_job_id
from ai_service.analysis.preview_service import run_preview_analysis
from ai_service.analysis.service import run_analysis_job
from ai_service.analysis.validator import (
    validate_analysis_image_source,
    validate_analysis_request,
)

from .callback_sender import send_json_callback
from .config import get_http_settings

LOGGER = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_PREVIEW_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PREVIEW_IMAGE_BYTES = 10 * 1024 * 1024


@router.post("/ai/analysis/run")
def run_analysis(payload: dict, background_tasks: BackgroundTasks) -> dict:
    try:
        validate_analysis_request(payload)
        validate_analysis_image_source(payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_INPUT",
                    "message": str(exc),
                    "detail": {},
                },
            },
        ) from exc

    request_id = payload["request_id"]
    job_id = build_job_id(request_id)
    background_tasks.add_task(process_analysis_callbacks, payload)
    return build_accepted_response(request_id, job_id)


@router.post("/ai/analysis/preview")
async def preview_analysis(
    image: UploadFile = File(...),
    water_level_cm: float = Form(...),
    flow_velocity_mps: float = Form(...),
    quality_status: str = Form("valid"),
) -> dict:
    if image.content_type not in ALLOWED_PREVIEW_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_IMAGE_TYPE",
                    "message": "Only jpeg, png, and webp images are supported.",
                    "detail": {"content_type": image.content_type},
                },
            },
        )

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty.")
    if len(image_bytes) > MAX_PREVIEW_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image file is too large.")

    suffix = _preview_image_suffix(image.filename, image.content_type)
    start_time = time.perf_counter()
    temp_path = _write_preview_temp_file(image_bytes, suffix)
    try:
        result = run_preview_analysis(
            temp_path,
            water_level_cm=water_level_cm,
            flow_velocity_mps=flow_velocity_mps,
            quality_status=quality_status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        LOGGER.exception("AI preview analysis failed: filename=%s", image.filename)
        raise HTTPException(status_code=500, detail="AI preview analysis failed.") from exc
    finally:
        temp_path.unlink(missing_ok=True)

    result.update(
        {
            "fileName": image.filename,
            "contentType": image.content_type,
            "imageSizeBytes": len(image_bytes),
            "elapsedMs": round((time.perf_counter() - start_time) * 1000),
        }
    )
    return result


def process_analysis_callbacks(payload: dict) -> None:
    request_id = payload.get("request_id")
    job_id = build_job_id(request_id) if request_id else None
    drain_id = payload.get("drain_id")

    try:
        result = run_analysis_job(payload)
    except Exception:
        LOGGER.exception(
            "AI analysis background task failed: request_id=%s job_id=%s drain_id=%s",
            request_id,
            job_id,
            drain_id,
        )
        return

    settings = get_http_settings()
    yolo_sent = send_json_callback(
        settings.yolo_callback_url,
        result["yolo_callback_payload"],
        settings.callback_timeout_seconds,
        settings.callback_retry_count,
        callback_name="yolo",
        request_id=request_id,
        job_id=job_id,
    )
    _log_callback_result("yolo", yolo_sent, request_id, job_id, drain_id)

    xgboost_sent = send_json_callback(
        settings.xgboost_callback_url,
        result["xgboost_callback_payload"],
        settings.callback_timeout_seconds,
        settings.callback_retry_count,
        callback_name="xgboost",
        request_id=request_id,
        job_id=job_id,
    )
    _log_callback_result("xgboost", xgboost_sent, request_id, job_id, drain_id)


def _log_callback_result(
    callback_name: str,
    sent: bool,
    request_id: str | None,
    job_id: str | None,
    drain_id: object,
) -> None:
    if sent:
        LOGGER.info(
            "AI callback delivered: callback=%s request_id=%s job_id=%s drain_id=%s",
            callback_name,
            request_id,
            job_id,
            drain_id,
        )
        return

    LOGGER.error(
        "AI callback delivery exhausted: callback=%s request_id=%s job_id=%s drain_id=%s",
        callback_name,
        request_id,
        job_id,
        drain_id,
    )


def _write_preview_temp_file(image_bytes: bytes, suffix: str) -> Path:
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        temp_file.write(image_bytes)
        return Path(temp_file.name)
    finally:
        temp_file.close()


def _preview_image_suffix(filename: str | None, content_type: str | None) -> str:
    if filename:
        suffix = Path(filename).suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
            return suffix
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    return ".jpg"
