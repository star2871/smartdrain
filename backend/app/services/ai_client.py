"""
AI 서버와 통신하는 HTTP client 서비스 파일입니다.

주요 역할:
- AI 서버 비동기 분석 시작 API 호출
- timeout 및 HTTP 오류 처리
- AI 서버 응답을 백엔드 스키마로 변환
"""

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.analysis_async import AiAnalysisRunResponse


async def request_ai_analysis(payload: dict[str, Any]) -> AiAnalysisRunResponse:
    if not settings.AI_SERVER_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server is disabled",
        )

    url = f"{settings.AI_SERVER_BASE_URL.rstrip('/')}/ai/analysis/run"
    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVER_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server request timed out",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI server returned {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server connection failed",
        ) from exc

    data = response.json()
    if not data.get("accepted"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server rejected analysis request",
        )
    return AiAnalysisRunResponse.model_validate(data)


async def request_ai_preview_analysis(
    image_bytes: bytes,
    filename: str,
    content_type: str,
    water_level_cm: float,
    flow_velocity_mps: float,
    quality_status: str = "valid",
) -> dict[str, Any]:
    if not settings.AI_SERVER_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server is disabled",
        )

    url = f"{settings.AI_SERVER_BASE_URL.rstrip('/')}/ai/analysis/preview"
    data = {
        "water_level_cm": str(water_level_cm),
        "flow_velocity_mps": str(flow_velocity_mps),
        "quality_status": quality_status,
    }
    files = {
        "image": (filename, image_bytes, content_type),
    }

    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVER_TIMEOUT_SECONDS) as client:
            response = await client.post(url, data=data, files=files)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server request timed out",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI server returned {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI server connection failed",
        ) from exc

    return response.json()
