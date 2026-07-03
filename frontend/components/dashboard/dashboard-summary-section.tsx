import { AlertCircle, RotateCcw } from "lucide-react";
import type { DashboardSummaryDto } from "@/lib/api/types";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { Button } from "@/components/ui/button";

type DashboardSummarySectionProps = {
    summary?: DashboardSummaryDto;
    isLoading: boolean;
    onRetry: () => void;
};

export function DashboardSummarySection({
    summary,
    isLoading,
    onRetry,
}: DashboardSummarySectionProps) {
    if (isLoading) {
        return <DashboardSummarySkeleton />;
    }

    if (summary) {
        return <DashboardSummaryBar summary={summary} />;
    }

    return <DashboardSummaryErrorState onRetry={onRetry} />;
}

function DashboardSummaryBar({ summary }: { summary: DashboardSummaryDto }) {
    const items = [
        {
            label: "전체",
            value: summary.totalCount,
            className: "text-slate-900 dark:text-slate-100",
            layoutClassName: "col-span-2 sm:col-span-2 lg:col-span-1",
        },
        {
            label: "위험",
            value: summary.dangerCount,
            className: "text-red-600 dark:text-red-400",
            layoutClassName: "sm:col-span-4 lg:col-span-2",
        },
        {
            label: "주의",
            value: summary.cautionCount,
            className: "text-amber-600 dark:text-amber-400",
            layoutClassName: "sm:col-span-2 lg:col-span-1",
        },
        {
            label: "양호",
            value: summary.goodCount,
            className: "text-emerald-600 dark:text-emerald-400",
            layoutClassName: "sm:col-span-2 lg:col-span-1",
        },
        {
            label: "판단불가",
            value: summary.unknownCount,
            className: "text-slate-500 dark:text-slate-300",
            layoutClassName: "sm:col-span-2 lg:col-span-1",
        },
    ];

    return (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                <div className="min-w-0 lg:w-52 lg:shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        대시보드 현황
                    </p>
                    <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
                        {summary.latestUpdatedAt
                            ? `최신 업데이트 ${formatDateTimeForDisplay(summary.latestUpdatedAt)}`
                            : "최신 업데이트 대기 중"}
                    </p>
                </div>
                <dl className="grid w-full grid-cols-2 gap-2 sm:grid-cols-6 lg:flex-1">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-lg bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/80 ${item.layoutClassName}`}
                        >
                            <dt className="text-xs text-slate-500 dark:text-slate-400">
                                {item.label}
                            </dt>
                            <dd className={`mt-0.5 text-lg font-bold ${item.className}`}>
                                {item.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}

function DashboardSummarySkeleton() {
    const layoutClassNames = [
        "col-span-2 sm:col-span-2 lg:col-span-1",
        "sm:col-span-4 lg:col-span-2",
        "sm:col-span-2 lg:col-span-1",
        "sm:col-span-2 lg:col-span-1",
        "sm:col-span-2 lg:col-span-1",
    ];

    return (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                <div className="lg:w-52 lg:shrink-0">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-44 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-6 lg:flex-1">
                    {Array.from({ length: 5 }, (_, index) => (
                        <div
                            key={index}
                            className={`rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/80 ${layoutClassNames[index]}`}
                        >
                            <div className="mx-auto h-3 w-10 animate-pulse rounded bg-slate-100" />
                            <div className="mx-auto mt-2 h-5 w-8 animate-pulse rounded bg-slate-200" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function DashboardSummaryErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <section className="mb-4 rounded-xl border border-red-100 bg-red-50/60 px-5 py-4 shadow-sm dark:border-red-950/60 dark:bg-red-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-500 shadow-sm">
                        <AlertCircle className="size-5" />
                    </span>
                    <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-300">
                            대시보드 현황을 불러오지 못했습니다.
                        </p>
                        <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-300/80">
                            현황 데이터가 도착하면 숫자가 표시됩니다.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={onRetry}
                    size="sm"
                    variant="outline"
                    className="border-red-200 bg-white text-red-600 hover:bg-red-50"
                >
                    <RotateCcw className="size-3.5" />
                    다시 시도
                </Button>
            </div>
        </section>
    );
}
