"""
FastAPI 애플리케이션을 생성하고 라우터를 등록하는 진입점 파일입니다.

주요 역할:
- FastAPI 앱 인스턴스 생성
- CORS 미들웨어 설정
- 헬스 체크 API와 주요 라우터 등록
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import ai_callback, analysis, dashboard, demo, drains, sensor_data, websocket
from app.schemas.api_response import api_error_response, api_response
from app.services.analysis_scheduler import start_analysis_scheduler, stop_analysis_scheduler
from app.services.demo_simulator import start_demo_simulator, stop_demo_simulator


app = FastAPI(title=settings.PROJECT_NAME)

PROJECT_ROOT_DIR = Path(__file__).resolve().parents[2]
MOCK_IMAGE_SOURCE_DIR = PROJECT_ROOT_DIR / "mock_data" / "ai_image_samples"

app.mount(
    "/api/mock-images",
    StaticFiles(directory=str(MOCK_IMAGE_SOURCE_DIR), check_dir=False),
    name="mock-images",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check() -> dict[str, object]:
    return api_response({"status": "ok", "service": settings.PROJECT_NAME})


@app.on_event("startup")
async def startup_event() -> None:
    start_analysis_scheduler(app)
    start_demo_simulator(app)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await stop_demo_simulator(app)
    await stop_analysis_scheduler(app)


def _error_code(status_code: int, detail: object) -> str:
    detail_text = detail if isinstance(detail, str) else ""
    if status_code == 404 and detail_text == "Drain not found":
        return "DRAIN_NOT_FOUND"
    if status_code == 404 and detail_text == "Sensor data not found":
        return "SENSOR_DATA_UNAVAILABLE"
    if status_code == 404 and detail_text in {"YOLO result not found", "Risk result not found"}:
        return "ANALYSIS_UNAVAILABLE"
    if status_code == 404 and detail_text == "Analysis request not found":
        return "ANALYSIS_REQUEST_NOT_FOUND"
    if status_code in {409, 503} and detail_text in {
        "AI server is disabled",
        "AI server request timed out",
        "AI server connection failed",
        "AI server rejected analysis request",
        "YOLO result not found",
    }:
        return "ANALYSIS_UNAVAILABLE"
    if status_code == 503 and detail_text.startswith("AI server returned"):
        return "ANALYSIS_UNAVAILABLE"
    if status_code == 422:
        return "VALIDATION_ERROR"
    if status_code >= 500:
        return "INTERNAL_SERVER_ERROR"
    return "INVALID_REQUEST"


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    message = exc.detail if isinstance(exc.detail, str) else "Invalid request"
    return JSONResponse(
        status_code=exc.status_code,
        content=api_error_response(
            code=_error_code(exc.status_code, exc.detail),
            message=message,
            detail={} if isinstance(exc.detail, str) else exc.detail,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=api_error_response(
            code="VALIDATION_ERROR",
            message="Validation error",
            detail={"errors": jsonable_encoder(exc.errors())},
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=api_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="Internal server error",
        ),
    )


app.include_router(drains.router)
app.include_router(sensor_data.router)
app.include_router(analysis.router)
app.include_router(ai_callback.router)
app.include_router(dashboard.router)
app.include_router(demo.router)
app.include_router(websocket.router)
