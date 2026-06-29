import { apiClient } from "@/lib/api/client";
import type {
    AiPreviewAnalysisResultDto,
    AiPreviewXgboostResultDto,
    AiPreviewYoloResultDto,
    ApiResponse,
} from "@/lib/api/types";

type PreviewAnalysisRequest = {
    image: File;
    waterLevelCm: number;
    flowVelocityMps: number;
    qualityStatus?: string;
    token?: string;
};

type PreviewYoloAnalysisRequest = {
    image: File;
    token?: string;
};

type PreviewXgboostAnalysisRequest = {
    yoloResult: AiPreviewYoloResultDto;
    waterLevelCm: number;
    flowVelocityMps: number;
    qualityStatus?: string;
    token?: string;
};

function demoHeaders(token?: string) {
    const trimmed = token?.trim();
    return trimmed
        ? {
            Authorization: `Bearer ${trimmed}`,
            "X-Demo-Control-Token": trimmed,
        }
        : undefined;
}

export async function previewAiAnalysis({
    image,
    waterLevelCm,
    flowVelocityMps,
    qualityStatus = "valid",
    token,
}: PreviewAnalysisRequest) {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("waterLevelCm", String(waterLevelCm));
    formData.append("flowVelocityMps", String(flowVelocityMps));
    formData.append("qualityStatus", qualityStatus);

    const response = await apiClient.post<ApiResponse<AiPreviewAnalysisResultDto>>(
        "/api/demo/ai-analysis/preview",
        formData,
        {
            headers: demoHeaders(token),
            timeout: 45000,
        },
    );
    return response.data;
}

export async function previewAiYoloAnalysis({
    image,
    token,
}: PreviewYoloAnalysisRequest) {
    const formData = new FormData();
    formData.append("image", image);

    const response = await apiClient.post<ApiResponse<AiPreviewYoloResultDto>>(
        "/api/demo/ai-analysis/preview/yolo",
        formData,
        {
            headers: demoHeaders(token),
            timeout: 45000,
        },
    );
    return response.data;
}

export async function previewAiXgboostAnalysis({
    yoloResult,
    waterLevelCm,
    flowVelocityMps,
    qualityStatus = "valid",
    token,
}: PreviewXgboostAnalysisRequest) {
    const response = await apiClient.post<ApiResponse<AiPreviewXgboostResultDto>>(
        "/api/demo/ai-analysis/preview/xgboost",
        {
            yoloResult,
            waterLevelCm,
            flowVelocityMps,
            qualityStatus,
        },
        {
            headers: demoHeaders(token),
            timeout: 45000,
        },
    );
    return response.data;
}
