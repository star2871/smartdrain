"use client";

import { Info } from "lucide-react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { type SensorPoint } from "@/lib/mock-data";
import { PlaceholderState } from "@/components/placeholder-state";
import { PLACEHOLDER_IMAGES } from "@/lib/placeholders";

type SensorSummary = {
    currentLevel: number | null;
    currentFlow: number | null;
};

export type SensorTrendChartProps = {
    points: SensorPoint[];
    summary: SensorSummary;
    isFallback?: boolean;
};

export function SensorTrendChart({
    points,
    summary,
    isFallback = false,
}: SensorTrendChartProps) {
    const hasSensorPoints = points.length > 0;
    const isSinglePoint = points.length === 1;
    const waterLevelDomain = getAxisDomain(
        points.map((point) => point.level),
        25,
    );
    const flowVelocityDomain = getAxisDomain(
        points.map((point) => point.flow),
        1.5,
    );

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        최근 센서 데이터
                    </h2>
                    <Info className="size-3.5 text-slate-400 dark:text-slate-500" />
                </div>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    측정 시각순
                </span>
            </div>

            {/* legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <LegendItem color="#0e7490" label="수위 (cm, 왼쪽 축)" />
                <LegendItem color="#059669" label="유속 (m/s, 오른쪽 축)" />
            </div>

            {isFallback ? (
                <PlaceholderState
                    image={PLACEHOLDER_IMAGES.chart}
                    title="실시간 센서 데이터 연결 대기"
                    description="백엔드 센서 이력이 도착하면 수위와 유속 차트가 표시됩니다."
                    statusLabel="데이터 수신 대기"
                    className="mt-2 h-[280px]"
                />
            ) : !hasSensorPoints ? (
                <PlaceholderState
                    image={PLACEHOLDER_IMAGES.chart}
                    title="측정 데이터가 없습니다"
                    description="센서 측정값이 수집되면 수위와 유속 추세가 표시됩니다."
                    statusLabel="측정 이력 없음"
                    className="mt-2 h-[280px]"
                />
            ) : (
                <div className="mt-2 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={points}
                            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--chart-grid)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
                                tickLine={false}
                                axisLine={{ stroke: "var(--chart-grid)" }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                yAxisId="waterLevel"
                                orientation="left"
                                width={44}
                                tick={{ fontSize: 11, fill: "#0e7490" }}
                                tickLine={false}
                                axisLine={{ stroke: "#0e7490" }}
                                domain={waterLevelDomain}
                            />
                            <YAxis
                                yAxisId="flowVelocity"
                                orientation="right"
                                width={44}
                                tick={{ fontSize: 11, fill: "#059669" }}
                                tickLine={false}
                                axisLine={{ stroke: "#059669" }}
                                domain={flowVelocityDomain}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Line
                                yAxisId="waterLevel"
                                type="monotone"
                                dataKey="level"
                                name="수위"
                                stroke="#0e7490"
                                strokeWidth={2}
                                dot={isSinglePoint ? { r: 4 } : false}
                                isAnimationActive={false}
                            />
                            <Line
                                yAxisId="flowVelocity"
                                type="monotone"
                                dataKey="flow"
                                name="유속"
                                stroke="#059669"
                                strokeWidth={2}
                                dot={isSinglePoint ? { r: 4 } : false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {!isFallback && hasSensorPoints && (
                <>
                    {isSinglePoint && (
                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                            측정 데이터 1건 — 추세를 표시하려면 추가 측정이 필요합니다.
                        </p>
                    )}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SummaryCard
                            label="현재 수위"
                            value={formatMeasurement(summary.currentLevel, "cm")}
                        />
                        <SummaryCard
                            label="현재 유속"
                            value={formatMeasurement(summary.currentFlow, "m/s")}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

function LegendItem({
    color,
    label,
}: {
    color: string;
    label: string;
}) {
    return (
        <span className="flex items-center gap-1.5">
            <span
                className="inline-block h-0 w-4"
                style={{
                    borderTop: `2px solid ${color}`,
                }}
            />
            {label}
        </span>
    );
}

function SummaryCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="whitespace-nowrap text-lg font-bold text-slate-900 dark:text-slate-100">
                    {value}
                </span>
            </div>
        </div>
    );
}

function formatMeasurement(value: number | null, unit: string) {
    return value == null ? "-" : `${value} ${unit}`;
}

function getAxisDomain(values: Array<number | null>, defaultMaximum: number) {
    const maximum = values.reduce<number>(
        (currentMaximum, value) =>
            value == null ? currentMaximum : Math.max(currentMaximum, value),
        0,
    );

    return [0, Math.max(defaultMaximum, maximum)] as const;
}

function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: {
        dataKey: string;
        name: string;
        value: number;
        color: string;
    }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-100">{label}</p>
            {payload.map((entry) => (
                <p
                    key={entry.dataKey}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                >
                    <span
                        className="size-2 rounded-full"
                        style={{ background: entry.color }}
                    />
                    {entry.name}:{" "}
                    <span className="font-semibold">
                        {entry.value}{entry.dataKey === "level" ? " cm" : " m/s"}
                    </span>
                </p>
            ))}
        </div>
    );
}
