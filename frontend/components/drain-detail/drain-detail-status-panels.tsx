import {
    AlertTriangle,
    Clock,
    Gauge,
    Globe,
    MapPin,
    ShieldCheck,
    Waves,
    type LucideIcon,
} from "lucide-react";
import { memo } from "react";
import { MetricProgress } from "@/components/metric-progress";
import { PlaceholderState } from "@/components/placeholder-state";
import { RiskMap } from "@/components/risk-map";
import { StatusBadge } from "@/components/status-badge";
import type { DrainDetailData } from "@/lib/api/drain-data";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { formatFinalDecisionLabel } from "@/lib/final-decision-label";
import { STATUS_META, type DrainFacility } from "@/lib/mock-data";
import { PLACEHOLDER_IMAGES } from "@/lib/placeholders";
import { cn } from "@/lib/utils";

type LocationMapCardProps = {
    drain: DrainFacility;
    source: DrainDetailData["source"];
};

export const LocationMapCard = memo(function LocationMapCard({
    drain,
    source,
}: LocationMapCardProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">
                위치 지도{" "}
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                    (고정)
                </span>
            </h2>
            <div className="h-[220px] sm:h-[260px]">
                {source === "api" ? (
                    <RiskMap
                        drains={[{ ...drain, x: 50, y: 48 }]}
                        selectedId={drain.id}
                        labelLocation={drain.road}
                        variant="detail"
                    />
                ) : (
                    <PlaceholderState
                        image={PLACEHOLDER_IMAGES.map}
                        title="위치 지도 연결 대기"
                        description="실제 위치 데이터가 도착하면 지도 영역이 표시됩니다."
                        statusLabel="mock fallback"
                        className="h-full min-h-0"
                    />
                )}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="break-words">{drain.fullAddress}</span>
            </p>
        </div>
    );
}, areLocationMapCardPropsEqual);

export function CurrentRiskCard({
    drain,
    compact = false,
}: {
    drain: DrainFacility;
    compact?: boolean;
}) {
    const meta = STATUS_META[drain.status];

    return (
        <div
            className={cn(
                !compact &&
                    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
            )}
        >
            {!compact ? (
                <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
                    현재 위험 상태
                </h2>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <RiskTile icon={ShieldCheck} label="상태">
                    <StatusBadge status={drain.status} />
                </RiskTile>
                <RiskTile icon={Globe} label="막힘 정도">
                    <div className="w-full">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {drain.blockage == null ? "-" : `${drain.blockage}%`}
                            </span>
                            <span className={cn("text-xs font-semibold", meta.text)}>
                                {meta.label}
                            </span>
                        </div>
                        <MetricProgress
                            value={drain.blockage ?? 0}
                            barClass={meta.bar}
                            className="mt-1.5"
                        />
                    </div>
                </RiskTile>
                <RiskTile icon={Waves} label="수위">
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {drain.waterLevelCm == null ? "-" : `${drain.waterLevelCm} cm`}
                    </span>
                </RiskTile>
                <RiskTile icon={Gauge} label="유속">
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {drain.flowVelocityMps == null ? "-" : `${drain.flowVelocityMps} m/s`}
                    </span>
                </RiskTile>
                <RiskTile icon={Clock} label="최근 업데이트">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {formatDateTimeForDisplay(drain.updatedAt)}
                    </span>
                </RiskTile>
                <RiskTile icon={AlertTriangle} label="판정 결과">
                    <span className={cn("text-base font-bold", meta.text)}>
                        {formatFinalDecisionLabel(drain.judgement)}
                    </span>
                </RiskTile>
            </div>
        </div>
    );
}

function RiskTile({
    icon: Icon,
    label,
    children,
}: {
    icon: LucideIcon;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/70">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-400 shadow-sm dark:bg-slate-700 dark:text-slate-500">
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <div className="mt-0.5">{children}</div>
            </div>
        </div>
    );
}

function areLocationMapCardPropsEqual(
    previous: LocationMapCardProps,
    next: LocationMapCardProps,
) {
    return (
        previous.source === next.source &&
        previous.drain.id === next.drain.id &&
        previous.drain.road === next.drain.road &&
        previous.drain.fullAddress === next.drain.fullAddress &&
        previous.drain.status === next.drain.status &&
        previous.drain.latitude === next.drain.latitude &&
        previous.drain.longitude === next.drain.longitude
    );
}
