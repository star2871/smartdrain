import {
    AlertTriangle,
    Gauge,
    Globe,
    type LucideIcon,
    Waves,
} from "lucide-react";
import { MetricProgress } from "@/components/metric-progress";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { formatFinalDecisionLabel } from "@/lib/final-decision-label";
import type { DrainFacility, RiskStatus } from "@/lib/mock-data";
import { STATUS_META } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type AnalysisSummaryCardProps = {
    drain: DrainFacility;
    obstructionPercent: number | null;
    finalDecision?: string | null;
    evaluatedAt?: string | null;
};

export function AnalysisSummaryCard({
    drain,
    obstructionPercent,
    finalDecision,
    evaluatedAt,
}: AnalysisSummaryCardProps) {
    const meta = STATUS_META[drain.status];

    return (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Detail dashboard
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                        현재 분석 요약
                    </h2>
                </div>
                <StatusBadge status={drain.status} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryMetricTile
                    icon={Globe}
                    label="막힘 정도"
                    value={obstructionPercent == null ? "-" : `${obstructionPercent}%`}
                    metaText={meta.text}
                    progress={obstructionPercent ?? undefined}
                    barClass={meta.bar}
                />
                <SummaryMetricTile
                    icon={Waves}
                    label="수위"
                    value={
                        drain.waterLevelCm == null
                            ? "-"
                            : `${drain.waterLevelCm} cm`
                    }
                    metaText={meta.text}
                />
                <SummaryMetricTile
                    icon={Gauge}
                    label="유속"
                    value={
                        drain.flowVelocityMps == null
                            ? "-"
                            : `${drain.flowVelocityMps} m/s`
                    }
                    metaText={meta.text}
                />
                <FinalDecisionTile
                    decision={finalDecision ?? drain.judgement}
                    evaluatedAt={evaluatedAt ?? drain.updatedAt}
                    status={drain.status}
                />
            </div>
        </section>
    );
}

function SummaryMetricTile({
    icon: Icon,
    label,
    value,
    metaText,
    progress,
    barClass,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    metaText: string;
    progress?: number;
    barClass?: string;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Icon className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
                {label}
            </div>
            <p className={cn("mt-2 whitespace-nowrap text-xl font-bold", metaText)}>
                {value}
            </p>
            {progress != null && barClass ? (
                <MetricProgress value={progress} barClass={barClass} className="mt-3" />
            ) : null}
        </div>
    );
}

function FinalDecisionTile({
    decision,
    evaluatedAt,
    status,
}: {
    decision: string;
    evaluatedAt: string;
    status: RiskStatus;
}) {
    const meta = STATUS_META[status];

    return (
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <AlertTriangle className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
                최종 판단
            </div>
            <p className={cn("mt-2 break-keep text-sm font-bold leading-5", meta.text)}>
                {formatFinalDecisionLabel(decision)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500" title={formatDateTimeForDisplay(evaluatedAt)}>
                {formatDateTimeForDisplay(evaluatedAt)}
            </p>
        </div>
    );
}
