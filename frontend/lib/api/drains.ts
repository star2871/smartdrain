import { apiClient } from "@/lib/api/client";
import {
    isAnalysisResultDto,
    isDashboardSummaryDto,
    isDrainAnalysisHistoryResponse,
    isDrainDetailDto,
    isDrainListItemDto,
    isRiskHistoryDto,
    isSensorHistoryDto,
    parseApiListResponse,
    parseApiResponse,
} from "@/lib/api/response-guards";
import type {
    AnalysisResultDto,
    DashboardSummaryDto,
    DrainAnalysisHistoryResponse,
    DrainDetailDto,
    DrainListItemDto,
    RiskHistoryDto,
    SensorHistoryDto,
} from "@/lib/api/types";

export async function getDrains() {
    const response = await apiClient.get<unknown>("/api/drains");
    return parseApiListResponse<DrainListItemDto>(
        response.data,
        isDrainListItemDto,
        "시설 목록 응답 형식이 올바르지 않습니다.",
    );
}

export async function getDrainDetail(id: string) {
    const response = await apiClient.get<unknown>(
        `/api/drains/${encodeURIComponent(id)}`,
    );
    return parseApiResponse<DrainDetailDto>(
        response.data,
        isDrainDetailDto,
        "시설 상세 응답 형식이 올바르지 않습니다.",
    );
}

export async function getDrainSensorHistory(
    id: string,
    params?: { range?: string; limit?: number },
) {
    const response = await apiClient.get<unknown>(
        `/api/drains/${encodeURIComponent(id)}/sensors`,
        { params },
    );
    return parseApiListResponse<SensorHistoryDto>(
        response.data,
        isSensorHistoryDto,
        "센서 이력 응답 형식이 올바르지 않습니다.",
    );
}

export async function getDrainRiskHistory(
    id: string,
    params?: { days?: number; limit?: number },
) {
    const response = await apiClient.get<unknown>(
        `/api/drains/${encodeURIComponent(id)}/risk-history`,
        { params },
    );
    return parseApiListResponse<RiskHistoryDto>(
        response.data,
        isRiskHistoryDto,
        "위험도 이력 응답 형식이 올바르지 않습니다.",
    );
}

export async function getDashboardSummary() {
    const response = await apiClient.get<unknown>(
        "/api/dashboard/summary",
    );
    return parseApiResponse<DashboardSummaryDto>(
        response.data,
        isDashboardSummaryDto,
        "대시보드 요약 응답 형식이 올바르지 않습니다.",
    );
}

export async function getLatestAnalysis(id: string) {
    const response = await apiClient.get<unknown>(
        `/api/drains/${encodeURIComponent(id)}/analysis/latest`,
    );
    return parseApiResponse<AnalysisResultDto>(
        response.data,
        isAnalysisResultDto,
        "최신 분석 응답 형식이 올바르지 않습니다.",
        { allowNullData: true },
    );
}

export async function getDrainAnalysisHistory(
    id: string,
    params?: { limit?: number },
) {
    const response = await apiClient.get<unknown>(
        `/api/drains/${encodeURIComponent(id)}/analysis/history`,
        { params },
    );
    return parseApiResponse<DrainAnalysisHistoryResponse>(
        response.data,
        isDrainAnalysisHistoryResponse,
        "분석 이력 응답 형식이 올바르지 않습니다.",
        { allowNullData: true },
    );
}
