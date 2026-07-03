import type {
    AnalysisResultDto,
    ApiListResponse,
    ApiResponse,
    DashboardSummaryDto,
    DrainAnalysisHistoryResponse,
    DrainDetailDto,
    DrainListItemDto,
    RiskHistoryDto,
    SensorHistoryDto,
    XgboostResultDto,
    YoloResultDto,
} from "@/lib/api/types";
import type { RiskLevel } from "@/lib/risk";

type ApiResponseOptions = {
    allowNullData?: boolean;
};

export function parseApiResponse<T>(
    value: unknown,
    isData: (data: unknown) => data is T,
    fallbackMessage: string,
    options: ApiResponseOptions = {},
): ApiResponse<T> {
    if (!isRecord(value) || typeof value.success !== "boolean") {
        return createInvalidResponse(fallbackMessage);
    }

    if (!value.success) {
        return {
            success: false,
            data: null,
            message: getOptionalString(value.message),
            error: parseApiError(value.error),
            timestamp: getOptionalString(value.timestamp),
        };
    }

    if (value.data === null && options.allowNullData) {
        return {
            success: true,
            data: null,
            message: getOptionalString(value.message),
            timestamp: getOptionalString(value.timestamp),
        };
    }

    if (!isData(value.data)) {
        return createInvalidResponse(fallbackMessage);
    }

    return {
        success: true,
        data: value.data,
        message: getOptionalString(value.message),
        timestamp: getOptionalString(value.timestamp),
    };
}

export function parseApiListResponse<T>(
    value: unknown,
    isItem: (item: unknown) => item is T,
    fallbackMessage: string,
): ApiListResponse<T> {
    return parseApiResponse(
        value,
        (data): data is { items: T[]; totalCount: number } =>
            isRecord(data) &&
            Array.isArray(data.items) &&
            data.items.every(isItem) &&
            isFiniteNumber(data.totalCount),
        fallbackMessage,
    );
}

export function isDrainListItemDto(value: unknown): value is DrainListItemDto {
    if (!isRecord(value)) return false;

    return (
        isNonEmptyString(value.id) &&
        isString(value.roadAddress) &&
        isNullableNumber(value.latitude) &&
        isNullableNumber(value.longitude) &&
        isNullableRiskLevel(value.riskLevel) &&
        isNullableNumber(value.riskScore) &&
        isNullableNumber(value.obstructionRatio) &&
        isNullableNumber(value.waterLevelCm) &&
        isNullableNumber(value.flowVelocityMps) &&
        isNullableString(value.finalDecision) &&
        isNullableString(value.updatedAt) &&
        isOptionalString(value.fullAddress) &&
        isOptionalNullableString(value.latestImageUrl) &&
        isOptionalNullableString(value.latestImageCapturedAt)
    );
}

export function isDrainDetailDto(value: unknown): value is DrainDetailDto {
    if (!isRecord(value)) return false;

    const detailFields: Record<string, unknown> = value;
    if (!isDrainListItemDto(value)) return false;

    return (
        isOptionalNullableString(detailFields.imageUrl) &&
        isOptionalValue(detailFields.sensorSummary, isSensorSummaryDto) &&
        isOptionalArray(detailFields.sensorHistory, isSensorHistoryDto) &&
        isOptionalValue(detailFields.yoloResult, isYoloResultDto) &&
        isOptionalValue(detailFields.xgboostResult, isXgboostResultDto) &&
        isOptionalArray(detailFields.riskHistory, isRiskHistoryDto)
    );
}

export function isSensorHistoryDto(value: unknown): value is SensorHistoryDto {
    if (!isRecord(value)) return false;

    return (
        isNullableString(value.measuredAt) &&
        isNullableNumber(value.waterLevelCm) &&
        isNullableNumber(value.flowVelocityMps)
    );
}

export function isRiskHistoryDto(value: unknown): value is RiskHistoryDto {
    if (!isRecord(value)) return false;

    return (
        isNullableString(value.changedAt) &&
        isNullableRiskLevel(value.riskLevel) &&
        isNullableNumber(value.riskScore)
    );
}

export function isDashboardSummaryDto(
    value: unknown,
): value is DashboardSummaryDto {
    if (!isRecord(value)) return false;

    return (
        isFiniteNumber(value.totalCount) &&
        isFiniteNumber(value.goodCount) &&
        isFiniteNumber(value.cautionCount) &&
        isFiniteNumber(value.dangerCount) &&
        isFiniteNumber(value.unknownCount) &&
        isOptionalString(value.latestUpdatedAt)
    );
}

export function isAnalysisResultDto(value: unknown): value is AnalysisResultDto {
    if (!isRecord(value)) return false;

    return (
        isOptionalValue(value.sensorSummary, isSensorSummaryDto) &&
        isOptionalValue(value.yoloResult, isYoloResultDto) &&
        isOptionalValue(value.xgboostResult, isXgboostResultDto) &&
        isOptionalNullableString(value.updatedAt)
    );
}

export function isDrainAnalysisHistoryResponse(
    value: unknown,
): value is DrainAnalysisHistoryResponse {
    if (!isRecord(value)) return false;

    return (
        isNonEmptyString(value.drainId) &&
        Array.isArray(value.yoloResults) &&
        value.yoloResults.every(isYoloResultDto) &&
        Array.isArray(value.xgboostResults) &&
        value.xgboostResults.every(isXgboostResultDto)
    );
}

function isSensorSummaryDto(
    value: unknown,
): value is NonNullable<AnalysisResultDto["sensorSummary"]> {
    if (!isRecord(value)) return false;

    return (
        isNullableNumber(value.waterLevelCm) &&
        isNullableNumber(value.flowVelocityMps) &&
        isNullableString(value.measuredAt)
    );
}

function isYoloResultDto(value: unknown): value is YoloResultDto {
    if (!isRecord(value)) return false;

    return (
        isOptionalNumber(value.id) &&
        isOptionalString(value.drainId) &&
        isOptionalNullableString(value.imageUrl) &&
        isNullableNumber(value.obstructionRatio) &&
        isNullableNumber(value.confidenceScore) &&
        isYoloStatus(value.yoloStatus) &&
        isOptionalNullableString(value.capturedAt) &&
        isOptionalNullableString(value.analyzedAt) &&
        isOptionalNullableString(value.createdAt)
    );
}

function isXgboostResultDto(value: unknown): value is XgboostResultDto {
    if (!isRecord(value)) return false;

    return (
        isOptionalNumber(value.id) &&
        isOptionalString(value.drainId) &&
        isOptionalNullableNumber(value.sensorDataId) &&
        isOptionalNullableNumber(value.yoloResultId) &&
        isNullableNumber(value.riskScore) &&
        isRiskLevel(value.riskLevel) &&
        isNullableString(value.finalDecision) &&
        isOptionalString(value.predictedAt) &&
        isOptionalString(value.evaluatedAt) &&
        isOptionalString(value.createdAt)
    );
}

function createInvalidResponse<T>(message: string): ApiResponse<T> {
    return {
        success: false,
        data: null,
        message,
        error: {
            code: "INVALID_RESPONSE",
            message,
        },
    };
}

function parseApiError(value: unknown) {
    if (!isRecord(value)) return undefined;
    if (!isString(value.code) || !isString(value.message)) return undefined;

    return {
        code: value.code,
        message: value.message,
        detail: value.detail,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.trim().length > 0;
}

function getOptionalString(value: unknown) {
    return isString(value) ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
    return value === undefined || isFiniteNumber(value);
}

function isOptionalNullableNumber(
    value: unknown,
): value is number | null | undefined {
    return value === undefined || isNullableNumber(value);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || isString(value);
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || isString(value);
}

function isOptionalNullableString(
    value: unknown,
): value is string | null | undefined {
    return value === undefined || isNullableString(value);
}

function isOptionalValue<T>(
    value: unknown,
    isValue: (item: unknown) => item is T,
): value is T | undefined {
    return value === undefined || isValue(value);
}

function isOptionalArray<T>(
    value: unknown,
    isItem: (item: unknown) => item is T,
): value is T[] | undefined {
    return value === undefined || (Array.isArray(value) && value.every(isItem));
}

function isRiskLevel(value: unknown): value is RiskLevel {
    return (
        value === "good" ||
        value === "caution" ||
        value === "danger" ||
        value === "unknown"
    );
}

function isNullableRiskLevel(value: unknown): value is RiskLevel | null {
    return value === null || isRiskLevel(value);
}

function isYoloStatus(value: unknown) {
    return (
        value === "clear" ||
        value === "partially_blocked" ||
        value === "blocked" ||
        value === "unknown"
    );
}
