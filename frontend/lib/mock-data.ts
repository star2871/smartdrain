// Mock data layer for the city flood management dashboard.
// Designed to be easy to swap with a real API later.

import { RISK_RANK, STATUS_META, type RiskLevel } from "@/lib/risk";

export type RiskStatus = RiskLevel;
export { RISK_RANK, STATUS_META };

export interface DrainFacility {
    id: string;
    road: string;
    fullAddress: string;
    status: RiskStatus;
    blockage: number | null; // 막힘 정도 (%)
    waterLevelCm: number | null; // 수위 (cm)
    flowVelocityMps: number | null; // 유속 (m/s)
    updatedAt: string;
    latestImageUrl?: string | null;
    latestImageCapturedAt?: string | null;
    judgement: string; // 판정 결과
    latitude: number | null;
    longitude: number | null;
    // normalized position on the mock map (0-100)
    x: number;
    y: number;
}

export interface RiskHistoryItem {
    time: string;
    status: RiskStatus;
    score: number;
}

export interface SensorPoint {
    time: string; // "HH:MM"
    level: number | null; // 수위 (cm)
    flow: number | null; // 유속 (m/s)
}

export const DRAINS: DrainFacility[] = [
    {
        id: "DR-004",
        road: "테헤란로 123",
        fullAddress: "서울특별시 강남구 테헤란로 123 (역삼동 123-45)",
        status: "danger",
        blockage: 85,
        waterLevelCm: 132,
        flowVelocityMps: 1.35,
        updatedAt: "2024-05-23 14:30",
        judgement: "침수 가능성 높음",
        latitude: 37.4991,
        longitude: 127.0328,
        x: 52,
        y: 50,
    },
    {
        id: "DR-011",
        road: "역삼로 88",
        fullAddress: "서울특별시 강남구 역삼로 88",
        status: "caution",
        blockage: 52,
        waterLevelCm: 78,
        flowVelocityMps: 0.92,
        updatedAt: "2024-05-23 14:25",
        judgement: "지속 관찰 필요",
        latitude: 37.4969,
        longitude: 127.0306,
        x: 30,
        y: 38,
    },
    {
        id: "DR-015",
        road: "삼성로 45",
        fullAddress: "서울특별시 강남구 삼성로 45",
        status: "caution",
        blockage: 41,
        waterLevelCm: 62,
        flowVelocityMps: 0.71,
        updatedAt: "2024-05-23 14:20",
        judgement: "지속 관찰 필요",
        latitude: 37.5001,
        longitude: 127.0336,
        x: 60,
        y: 62,
    },
    {
        id: "DR-018",
        road: "선릉로 52",
        fullAddress: "서울특별시 강남구 선릉로 52",
        status: "good",
        blockage: 18,
        waterLevelCm: 38,
        flowVelocityMps: 0.42,
        updatedAt: "2024-05-23 14:18",
        judgement: "정상 범위",
        latitude: 37.4993,
        longitude: 127.0294,
        x: 18,
        y: 52,
    },
    {
        id: "DR-027",
        road: "삼성로 101",
        fullAddress: "서울특별시 강남구 삼성로 101",
        status: "good",
        blockage: 12,
        waterLevelCm: 26,
        flowVelocityMps: 0.31,
        updatedAt: "2024-05-23 14:15",
        judgement: "정상 범위",
        latitude: 37.5011,
        longitude: 127.0318,
        x: 42,
        y: 72,
    },
    {
        id: "DR-033",
        road: "학동로 77",
        fullAddress: "서울특별시 강남구 학동로 77",
        status: "good",
        blockage: 9,
        waterLevelCm: 18,
        flowVelocityMps: 0.22,
        updatedAt: "2024-05-23 14:12",
        judgement: "정상 범위",
        latitude: 37.5017,
        longitude: 127.0300,
        x: 24,
        y: 78,
    },
    {
        id: "DR-041",
        road: "도곡로 12",
        fullAddress: "서울특별시 강남구 도곡로 12",
        status: "good",
        blockage: 14,
        waterLevelCm: 29,
        flowVelocityMps: 0.34,
        updatedAt: "2024-05-23 14:10",
        judgement: "정상 범위",
        latitude: 37.5009,
        longitude: 127.0290,
        x: 14,
        y: 70,
    },
    {
        id: "DR-052",
        road: "언주로 200",
        fullAddress: "서울특별시 강남구 언주로 200",
        status: "caution",
        blockage: 38,
        waterLevelCm: 57,
        flowVelocityMps: 0.66,
        updatedAt: "2024-05-23 14:08",
        judgement: "지속 관찰 필요",
        latitude: 37.4961,
        longitude: 127.0346,
        x: 70,
        y: 30,
    },
    {
        id: "DR-066",
        road: "봉은사로 50",
        fullAddress: "서울특별시 강남구 봉은사로 50",
        status: "good",
        blockage: 11,
        waterLevelCm: 22,
        flowVelocityMps: 0.27,
        updatedAt: "2024-05-23 14:05",
        judgement: "정상 범위",
        latitude: 37.4997,
        longitude: 127.0354,
        x: 78,
        y: 58,
    },
    {
        id: "DR-070",
        road: "테헤란로 411",
        fullAddress: "서울특별시 강남구 테헤란로 411",
        status: "good",
        blockage: 16,
        waterLevelCm: 33,
        flowVelocityMps: 0.39,
        updatedAt: "2024-05-23 14:02",
        judgement: "정상 범위",
        latitude: 37.4983,
        longitude: 127.0362,
        x: 86,
        y: 44,
    },
];

export function getDrainById(id: string): DrainFacility | undefined {
    return DRAINS.find((d) => d.id === id);
}

export function sortByRisk(drains: DrainFacility[]): DrainFacility[] {
    return [...drains].sort((a, b) => {
        const r = RISK_RANK[b.status] - RISK_RANK[a.status];
        if (r !== 0) return r;
        return (b.blockage ?? 0) - (a.blockage ?? 0);
    });
}

export const LEGEND_COUNTS = {
    danger: DRAINS.filter((d) => d.status === "danger").length,
    caution: DRAINS.filter((d) => d.status === "caution").length,
    good: DRAINS.filter((d) => d.status === "good").length,
    unknown: DRAINS.filter((d) => d.status === "unknown").length,
};

export const RISK_HISTORY: RiskHistoryItem[] = [
    { time: "2024-05-23 14:20", status: "danger", score: 82 },
    { time: "2024-05-23 09:10", status: "caution", score: 46 },
    { time: "2024-05-22 18:40", status: "good", score: 18 },
    { time: "2024-05-22 12:20", status: "caution", score: 42 },
    { time: "2024-05-21 08:30", status: "good", score: 15 },
    { time: "2024-05-20 17:50", status: "good", score: 12 },
    { time: "2024-05-20 09:20", status: "good", score: 10 },
];

export const SENSOR_THRESHOLDS = {
    dangerLevel: 1.5,
    warningLevel: 0.8,
};

export const SENSOR_SUMMARY = {
    currentLevel: 1.32,
    currentFlow: 1.35,
    maxLevel: 1.78,
    maxLevelTime: "13:42",
    maxFlow: 2.1,
    maxFlowTime: "13:47",
};

// Generates a smooth 24h sensor series (00:00 -> 24:00 in 30-min steps)
// This fixture is only used for isolated mock-response development.
export function generate24hSeries(seed = 0): SensorPoint[] {
    const points: SensorPoint[] = [];
    for (let i = 0; i <= 48; i++) {
        const hour = i * 0.5;
        const hh = String(Math.floor(hour)).padStart(2, "0");
        const mm = hour % 1 === 0 ? "00" : "30";
        // bell-ish curve centred near 16:00
        const wave = Math.sin(((hour - 4) / 24) * Math.PI);
        const base = Math.max(0, wave);
        const jitter = Math.sin((hour + seed) * 1.7) * 0.05;
        const level = +(0.55 + base * 1.55 + jitter).toFixed(2);
        const flow = +(0.25 + base * 1.7 + jitter * 1.2).toFixed(2);
        points.push({
            time: `${hh}:${mm}`,
            level: Math.max(0, level),
            flow: Math.max(0, flow),
        });
    }
    return points;
}

export function generate7dSeries(): SensorPoint[] {
    const days = [
        "05-17",
        "05-18",
        "05-19",
        "05-20",
        "05-21",
        "05-22",
        "05-23",
    ];
    const levels = [0.42, 0.55, 0.71, 0.48, 0.83, 1.12, 1.32];
    const flows = [0.38, 0.51, 0.79, 0.44, 0.91, 1.34, 1.35];
    return days.map((d, i) => ({ time: d, level: levels[i], flow: flows[i] }));
}
