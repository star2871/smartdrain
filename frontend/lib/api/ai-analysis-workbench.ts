import { apiClient } from "@/lib/api/client";
import type { AiPreviewAnalysisResultDto, ApiResponse } from "@/lib/api/types";

type PreviewAnalysisRequest = {
    image: File;
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
