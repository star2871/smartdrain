import { RISK_RANK } from "@/lib/risk";
import type {
    AnalysisResultDto,
    DashboardSummaryDto,
    DrainDetailDto,
    DrainStatusUpdatedEventDto,
    DrainListItemDto,
    RiskHistoryDto,
    SensorHistoryDto,
    YoloResultUpdatedEventDto,
} from "@/lib/api/types";
import type {
    DrainFacility,
    RiskHistoryItem,
    SensorPoint,
} from "@/lib/mock-data";

function clampPercent(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
}

function ratioToPercent(value: number) {
    return clampPercent(value <= 1 ? value * 100 : value);
}

export function drainListItemDtoToFacility(
    dto: DrainListItemDto,
    mapPosition: { x: number; y: number } = { x: 50, y: 50 },
): DrainFacility {
    const obstructionPercent =
        dto.obstructionRatio == null ? null : ratioToPercent(dto.obstructionRatio);
    return {
        id: dto.id,
        road: dto.roadAddress,
        fullAddress: dto.fullAddress ?? dto.roadAddress,
        status: dto.riskLevel ?? "unknown",
        blockage: obstructionPercent,
        waterLevelCm: dto.waterLevelCm,
        flowVelocityMps: dto.flowVelocityMps,
        updatedAt: dto.updatedAt ?? "",
        latestImageUrl: dto.latestImageUrl ?? null,
        latestImageCapturedAt: dto.latestImageCapturedAt ?? null,
        judgement: dto.finalDecision ?? "-",
        latitude: dto.latitude,
        longitude: dto.longitude,
        x: mapPosition.x,
        y: mapPosition.y,
    };
}

export function drainDetailDtoToFacility(dto: DrainDetailDto): DrainFacility {
    return drainListItemDtoToFacility(dto);
}

export function drainListDtoToFacilities(
    items: DrainListItemDto[],
): DrainFacility[] {
    return items.map((item, index) =>
        drainListItemDtoToFacility(item, getMockMapPosition(index)),
    );
}

export function riskHistoryDtoToItem(
    item: RiskHistoryDto,
): RiskHistoryItem {
    return {
        time: item.changedAt ?? "",
        status: item.riskLevel ?? "unknown",
        score: 0,
    };
}

export function riskHistoryDtoToItems(
    items: RiskHistoryDto[] = [],
): RiskHistoryItem[] {
    return items.map(riskHistoryDtoToItem);
}

export function sensorHistoryDtoToPoint(item: SensorHistoryDto): SensorPoint {
    return {
        time: formatChartTime(item.measuredAt),
        level: item.waterLevelCm,
        flow: item.flowVelocityMps,
    };
}

export function sensorHistoryDtoToPoints(
    items: SensorHistoryDto[] = [],
): SensorPoint[] {
    return [...items]
        .sort(
            (a, b) =>
                toTimestamp(a.measuredAt) - toTimestamp(b.measuredAt),
        )
        .map(sensorHistoryDtoToPoint);
}

export function dashboardSummaryFromDrains(
    drains: DrainFacility[],
): DashboardSummaryDto {
    return {
        totalCount: drains.length,
        goodCount: drains.filter((drain) => drain.status === "good").length,
        cautionCount: drains.filter((drain) => drain.status === "caution")
            .length,
        dangerCount: drains.filter((drain) => drain.status === "danger")
            .length,
        unknownCount: drains.filter((drain) => drain.status === "unknown")
            .length,
        latestUpdatedAt: drains
            .map((drain) => drain.updatedAt)
            .sort((a, b) => b.localeCompare(a))[0],
    };
}

export function mergeAnalysisIntoDetail(
    detail: DrainDetailDto,
    analysis?: AnalysisResultDto | null,
): DrainDetailDto {
    if (!analysis) return detail;
    return {
        ...detail,
        sensorSummary: analysis.sensorSummary ?? detail.sensorSummary,
        yoloResult: analysis.yoloResult ?? detail.yoloResult,
        xgboostResult: analysis.xgboostResult ?? detail.xgboostResult,
        updatedAt: analysis.updatedAt ?? detail.updatedAt,
    };
}

export function sortFacilitiesByRisk(drains: DrainFacility[]): DrainFacility[] {
    return [...drains].sort((a, b) => {
        const riskDiff = RISK_RANK[b.status] - RISK_RANK[a.status];
        if (riskDiff !== 0) return riskDiff;
        return (b.blockage ?? 0) - (a.blockage ?? 0);
    });
}

export function mergeDrainStatusEventIntoFacility(
    drain: DrainFacility,
    event: DrainStatusUpdatedEventDto,
): DrainFacility {
    if (drain.id !== event.payload.drainId) return drain;

    const {
        riskLevel,
        obstructionRatio,
        waterLevelCm,
        flowVelocityMps,
        finalDecision,
        updatedAt,
    } = event.payload;

    return {
        ...drain,
        status: riskLevel,
        blockage:
            obstructionRatio == null
                ? drain.blockage
                : ratioToPercent(obstructionRatio),
        waterLevelCm: waterLevelCm ?? drain.waterLevelCm,
        flowVelocityMps: flowVelocityMps ?? drain.flowVelocityMps,
        judgement: finalDecision ?? drain.judgement,
        updatedAt,
    };
}

export function mergeYoloEventIntoFacility(
    drain: DrainFacility,
    event: YoloResultUpdatedEventDto,
): DrainFacility {
    if (drain.id !== event.payload.drainId) return drain;

    return {
        ...drain,
        blockage:
            event.payload.obstructionRatio == null
                ? drain.blockage
                : ratioToPercent(event.payload.obstructionRatio),
        latestImageUrl: event.payload.imageUrl,
        latestImageCapturedAt: event.payload.capturedAt,
        updatedAt: event.payload.updatedAt,
    };
}

function formatChartTime(value: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}:${second}`;
}

function toTimestamp(value: string | null) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getMockMapPosition(index: number) {
    const positions = [
        { x: 52, y: 50 },
        { x: 30, y: 38 },
        { x: 60, y: 62 },
        { x: 18, y: 52 },
        { x: 42, y: 72 },
        { x: 24, y: 78 },
        { x: 14, y: 70 },
        { x: 70, y: 30 },
        { x: 78, y: 58 },
        { x: 86, y: 44 },
    ];
    return positions[index % positions.length];
}
