import type { RiskLevel } from "@/lib/risk";

export type YoloStatus = "clear" | "partially_blocked" | "blocked" | "unknown";

export type ApiResponse<T> = {
    success: boolean;
    data: T | null;
    message?: string;
    error?: {
        code: string;
        message: string;
        detail?: unknown;
    };
    timestamp?: string;
};

export type ApiListResponse<T> = ApiResponse<{
    items: T[];
    totalCount: number;
}>;

export type DrainListItemDto = {
    id: string;
    roadAddress: string;
    fullAddress?: string;
    latitude: number | null;
    longitude: number | null;
    riskLevel: RiskLevel | null;
    riskScore: number | null;
    obstructionRatio: number | null;
    waterLevelCm: number | null;
    flowVelocityMps: number | null;
    finalDecision: string | null;
    updatedAt: string | null;
    latestImageUrl?: string | null;
    latestImageCapturedAt?: string | null;
};

export type DrainDetailDto = DrainListItemDto & {
    imageUrl?: string | null;
    sensorSummary?: SensorSummaryDto;
    sensorHistory?: SensorHistoryDto[];
    yoloResult?: YoloResultDto;
    xgboostResult?: XgboostResultDto;
    riskHistory?: RiskHistoryDto[];
};

export type SensorSummaryDto = {
    waterLevelCm: number | null;
    flowVelocityMps: number | null;
    measuredAt: string | null;
};

export type SensorHistoryDto = {
    measuredAt: string | null;
    waterLevelCm: number | null;
    flowVelocityMps: number | null;
};

export type YoloResultDto = {
    id?: number;
    drainId?: string;
    imageUrl?: string | null;
    obstructionRatio: number | null;
    confidenceScore: number | null;
    yoloStatus: YoloStatus;
    capturedAt?: string | null;
    analyzedAt?: string | null;
    createdAt?: string | null;
};

export type XgboostResultDto = {
    id?: number;
    drainId?: string;
    sensorDataId?: number | null;
    yoloResultId?: number | null;
    riskScore: number | null;
    riskLevel: RiskLevel;
    finalDecision: string | null;
    predictedAt?: string;
    evaluatedAt?: string;
    createdAt?: string;
};

export type RiskHistoryDto = {
    changedAt: string | null;
    riskLevel: RiskLevel | null;
    riskScore: number | null;
};

export type AnalysisResultDto = {
    sensorSummary?: SensorSummaryDto;
    yoloResult?: YoloResultDto;
    xgboostResult?: XgboostResultDto;
    updatedAt?: string | null;
};

export type DrainAnalysisHistoryResponse = {
    drainId: string;
    yoloResults: YoloResultDto[];
    xgboostResults: XgboostResultDto[];
};

export type DashboardSummaryDto = {
    totalCount: number;
    goodCount: number;
    cautionCount: number;
    dangerCount: number;
    unknownCount: number;
    latestUpdatedAt?: string;
};

export type DrainStatusUpdatedEventDto = {
    type: "DRAIN_STATUS_UPDATED";
    payload: {
        drainId: string;
        riskLevel: RiskLevel;
        riskScore: number | null;
        waterLevelCm?: number | null;
        flowVelocityMps?: number | null;
        obstructionRatio?: number | null;
        finalDecision?: string | null;
        updatedAt: string;
        sensorDataId?: number | null;
        yoloResultId?: number | null;
        xgboostResultId?: number | null;
    };
};

export type YoloResultUpdatedEventDto = {
    type: "YOLO_RESULT_UPDATED";
    payload: {
        drainId: string;
        yoloResultId: number;
        imageUrl: string | null;
        obstructionRatio: number | null;
        confidenceScore: number | null;
        yoloStatus: YoloStatus;
        capturedAt: string | null;
        analyzedAt: string;
        updatedAt: string;
    };
};

export type XgboostResultUpdatedEventDto = {
    type: "XGBOOST_RESULT_UPDATED";
    payload: {
        drainId: string;
        xgboostResultId: number;
        sensorDataId: number | null;
        yoloResultId: number | null;
        riskLevel: RiskLevel;
        riskScore: number | null;
        finalDecision: string | null;
        evaluatedAt: string;
        updatedAt: string;
    };
};

export type DrainRealtimeEventDto =
    | DrainStatusUpdatedEventDto
    | YoloResultUpdatedEventDto
    | XgboostResultUpdatedEventDto;

export type AiPreviewYoloResultDto = {
    obstructionRatio: number | null;
    confidenceScore: number | null;
    yoloStatus: YoloStatus;
    rawYoloStatus?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    imageSizeBytes?: number | null;
    elapsedMs?: number | null;
};

export type AiPreviewXgboostResultDto = {
    input: {
        waterLevelCm: number;
        flowVelocityMps: number;
        qualityStatus: string;
        features: {
            obstructionRatio: number | null;
            confidenceScore: number | null;
            waterLevel: number | null;
            flowVelocity: number | null;
        };
    };
    xgboostResult: {
        riskScore: number | null;
        riskLevel: RiskLevel;
        finalDecision: string;
        modelVersion?: string | null;
    };
    createdAt: string;
};

export type AiPreviewAnalysisResultDto = AiPreviewXgboostResultDto & {
    yoloResult: AiPreviewYoloResultDto;
    fileName?: string | null;
    contentType?: string | null;
    imageSizeBytes?: number | null;
    elapsedMs?: number | null;
};
