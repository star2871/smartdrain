"use client";

import { useState } from "react";
import { Brain, Eye, Images, ShieldCheck, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { XgboostResultDto, YoloResultDto } from "@/lib/api/types";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { formatFinalDecisionLabel } from "@/lib/final-decision-label";
import { STATUS_META } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type AnalysisTab = "summary" | "yolo" | "xgboost" | "history";

type AiAnalysisTabsProps = {
    summary: React.ReactNode;
    yoloResult?: YoloResultDto;
    xgboostResult?: XgboostResultDto;
    yoloResults: YoloResultDto[];
    xgboostResults: XgboostResultDto[];
};

export function AiAnalysisTabs({
    summary,
    yoloResult,
    xgboostResult,
    yoloResults,
    xgboostResults,
}: AiAnalysisTabsProps) {
    const [activeTab, setActiveTab] = useState<AnalysisTab>("summary");
    const tabs: { id: AnalysisTab; label: string; icon: LucideIcon }[] = [
        { id: "summary", label: "요약", icon: ShieldCheck },
        { id: "yolo", label: "YOLO", icon: Eye },
        { id: "xgboost", label: "XGBoost", icon: Brain },
        { id: "history", label: "이력", icon: Images },
    ];

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    AI 모델 판단 정보
                </h2>
                <div className="grid grid-cols-4 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors dark:text-slate-400",
                                activeTab === tab.id &&
                                    "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100",
                            )}
                        >
                            <tab.icon className="size-3.5 shrink-0" />
                            <span className="truncate">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === "summary" ? summary : null}
            {activeTab === "yolo" ? <YoloAnalysisPanel result={yoloResult} /> : null}
            {activeTab === "xgboost" ? <XgboostAnalysisPanel result={xgboostResult} /> : null}
            {activeTab === "history" ? (
                <AnalysisHistoryPanel
                    yoloResults={yoloResults}
                    xgboostResults={xgboostResults}
                />
            ) : null}
        </div>
    );
}

function YoloAnalysisPanel({ result }: { result?: YoloResultDto }) {
    if (!result) return <EmptyAnalysisState label="YOLO 분석 정보가 없습니다." />;

    return (
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AnalysisInfoRow label="YOLO Result ID" value={formatNullable(result.id)} />
            <AnalysisInfoRow label="분석 상태" value={getYoloStatusLabel(result.yoloStatus)} />
            <AnalysisInfoRow label="막힘률" value={formatRatioPercent(result.obstructionRatio)} />
            <AnalysisInfoRow label="신뢰도" value={formatRatioPercent(result.confidenceScore)} />
            <AnalysisInfoRow label="촬영 시각" value={formatDateTimeForDisplay(result.capturedAt)} />
            <AnalysisInfoRow label="분석 시각" value={formatDateTimeForDisplay(result.analyzedAt)} />
        </dl>
    );
}

function XgboostAnalysisPanel({ result }: { result?: XgboostResultDto }) {
    if (!result) return <EmptyAnalysisState label="XGBoost 판단 정보가 없습니다." />;
    const evaluatedAt = formatDateTimeForDisplay(result.evaluatedAt ?? result.predictedAt);

    return (
        <dl className="grid grid-cols-2 gap-3">
            <AnalysisInfoRow fixedHeight label="XGBoost Result ID" value={formatNullable(result.id)} />
            <AnalysisInfoRow fixedHeight label="위험 상태" value={<StatusBadge status={result.riskLevel} />} />
            <AnalysisInfoRow fixedHeight label="참조 Sensor ID" value={formatNullable(result.sensorDataId)} />
            <AnalysisInfoRow fixedHeight label="참조 YOLO ID" value={formatNullable(result.yoloResultId)} />
            <AnalysisInfoRow
                fixedHeight
                label="판단 시각"
                value={evaluatedAt}
                valueClassName="truncate whitespace-nowrap"
                valueTitle={evaluatedAt}
            />
            <AnalysisInfoRow
                fixedHeight
                label="관리자 조치 판단"
                value={formatFinalDecisionLabel(result.finalDecision)}
                valueClassName="line-clamp-2 leading-5"
                valueTitle={formatFinalDecisionLabel(result.finalDecision)}
            />
        </dl>
    );
}

function AnalysisHistoryPanel({
    yoloResults,
    xgboostResults,
}: {
    yoloResults: YoloResultDto[];
    xgboostResults: XgboostResultDto[];
}) {
    if (yoloResults.length === 0 && xgboostResults.length === 0) {
        return <EmptyAnalysisState label="분석 이력이 없습니다." />;
    }

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HistoryList
                title="YOLO 이미지 이력"
                items={yoloResults.map((item) => ({
                    key: `yolo-${item.id ?? item.analyzedAt}`,
                    title: `${formatRatioPercent(item.obstructionRatio)} / ${getYoloStatusLabel(item.yoloStatus)}`,
                    meta: formatDateTimeForDisplay(item.analyzedAt ?? item.createdAt),
                }))}
            />
            <HistoryList
                title="XGBoost 판단 이력"
                items={xgboostResults.map((item) => ({
                    key: `xgboost-${item.id ?? item.evaluatedAt}`,
                    title: `${STATUS_META[item.riskLevel].label} / ${formatFinalDecisionLabel(item.finalDecision)}`,
                    meta: formatDateTimeForDisplay(item.evaluatedAt ?? item.createdAt),
                }))}
            />
        </div>
    );
}

function AnalysisInfoRow({
    label,
    value,
    fixedHeight = false,
    valueClassName,
    valueTitle,
}: {
    label: string;
    value: React.ReactNode;
    fixedHeight?: boolean;
    valueClassName?: string;
    valueTitle?: string;
}) {
    return (
        <div
            className={cn(
                "min-w-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/70",
                fixedHeight && "h-[76px]",
            )}
        >
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
            <dd
                className={cn(
                    "mt-1 min-w-0 overflow-hidden text-sm font-semibold text-slate-800 dark:text-slate-100",
                    valueClassName,
                )}
                title={valueTitle}
            >
                {value}
            </dd>
        </div>
    );
}

function EmptyAnalysisState({ label }: { label: string }) {
    return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
            {label}
        </div>
    );
}

function HistoryList({ title, items }: { title: string; items: { key: string; title: string; meta: string }[] }) {
    return (
        <div>
            <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            <ul className="dashboard-scrollbar max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                    <li key={item.key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/70">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.meta}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function formatRatioPercent(value?: number | null) {
    if (value == null) return "-";
    return `${Math.min(100, Math.max(0, Math.round(value <= 1 ? value * 100 : value)))}%`;
}

function formatNullable(value?: number | string | null) {
    return value == null || value === "" ? "-" : String(value);
}

function getYoloStatusLabel(status: YoloResultDto["yoloStatus"]) {
    const labels: Record<YoloResultDto["yoloStatus"], string> = {
        clear: "정상",
        partially_blocked: "부분 막힘",
        blocked: "막힘",
        unknown: "판단 불가",
    };
    return labels[status];
}
