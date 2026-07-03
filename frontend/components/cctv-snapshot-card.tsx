"use client";

import { memo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLACEHOLDER_IMAGES } from "@/lib/placeholders";
import { FallbackImage } from "@/components/fallback-image";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import type { YoloStatus } from "@/lib/api/types";
import { formatDateTimeForDisplay } from "@/lib/date-format";

export type CctvSnapshot = {
    id?: number;
    imageUrl: string;
    capturedAt: string;
    obstructionRatio?: number | null;
    confidenceScore?: number | null;
    yoloStatus?: YoloStatus;
};

type CctvSnapshotCardProps = {
    snapshots: CctvSnapshot[];
    locationName: string;
};

export const CctvSnapshotCard = memo(function CctvSnapshotCard({
    snapshots,
    locationName,
}: CctvSnapshotCardProps) {
    const [active, setActive] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const safeSnapshots =
        snapshots.length > 0
            ? snapshots
            : [
                  {
                      imageUrl: PLACEHOLDER_IMAGES.cctv,
                      capturedAt: "분석 데이터 없음",
                  },
              ];
    const activeIndex = Math.min(active, safeSnapshots.length - 1);
    const current = safeSnapshots[activeIndex];
    const hasMultipleSnapshots = safeSnapshots.length > 1;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                    CCTV (상단뷰)
                </h2>
                <span className="text-xs text-slate-400">
                    최근 캡처 · {formatDateTimeForDisplay(current.capturedAt)}
                </span>
            </div>

            {/* main snapshot */}
            <div className="relative mt-3 h-[260px] overflow-hidden rounded-lg border border-slate-200 bg-slate-900 md:h-[320px] xl:h-[300px]">
                <FallbackImage
                    src={current.imageUrl}
                    fallbackSrc={PLACEHOLDER_IMAGES.cctv}
                    alt={`${locationName} 빗물받이 상단뷰 CCTV 스냅샷`}
                    className="size-full object-cover"
                />
                <button
                    type="button"
                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md bg-black/45 text-white hover:bg-black/60"
                    aria-label="확대"
                    onClick={() => setIsPreviewOpen(true)}
                >
                    <Maximize2 className="size-4" />
                </button>
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-2 rounded-md bg-black/55 px-3 py-2 text-xs font-semibold text-white">
                    <span>{getYoloStatusLabel(current.yoloStatus)}</span>
                    <span className="text-white/60">|</span>
                    <span>막힘 {formatRatioPercent(current.obstructionRatio)}</span>
                    <span className="text-white/60">|</span>
                    <span>
                        신뢰도 {formatRatioPercent(current.confidenceScore)}
                    </span>
                </div>
            </div>

            <ImagePreviewDialog
                open={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                src={current.imageUrl}
                fallbackSrc={PLACEHOLDER_IMAGES.cctv}
                alt={`${locationName} 빗물받이 상단뷰 CCTV 스냅샷 확대 이미지`}
            />

            {/* thumbnails */}
            <div className="mt-3 flex items-center gap-2">
                <button
                    onClick={() => setActive((p) => Math.max(0, p - 1))}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    disabled={!hasMultipleSnapshots || activeIndex === 0}
                    aria-label="이전"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <div className="flex h-16 flex-1 gap-2 overflow-x-auto overflow-y-hidden">
                    {safeSnapshots.map((snapshot, i) => (
                        <button
                            key={`${snapshot.id ?? snapshot.capturedAt}-${i}`}
                            onClick={() => setActive(i)}
                            className={cn(
                                "size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                                activeIndex === i
                                    ? "border-cyan-600"
                                    : "border-transparent hover:border-slate-300",
                            )}
                            aria-label={`스냅샷 ${snapshot.capturedAt}`}
                        >
                            <FallbackImage
                                src={snapshot.imageUrl}
                                fallbackSrc={PLACEHOLDER_IMAGES.thumbnail}
                                alt=""
                                className="size-full object-cover"
                            />
                        </button>
                    ))}
                </div>
                <button
                    onClick={() =>
                        setActive((p) =>
                            Math.min(safeSnapshots.length - 1, p + 1),
                        )
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                    disabled={
                        !hasMultipleSnapshots ||
                        activeIndex === safeSnapshots.length - 1
                    }
                    aria-label="다음"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>
        </div>
    );
}, areCctvSnapshotCardPropsEqual);

function formatRatioPercent(value?: number | null) {
    if (value == null) return "-";
    const percent = value <= 1 ? value * 100 : value;
    return `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
}

function getYoloStatusLabel(status?: YoloStatus) {
    if (!status) return "분석 대기";
    const labels: Record<YoloStatus, string> = {
        clear: "정상",
        partially_blocked: "부분 막힘",
        blocked: "막힘",
        unknown: "판단 불가",
    };
    return labels[status];
}

function areCctvSnapshotCardPropsEqual(
    previous: CctvSnapshotCardProps,
    next: CctvSnapshotCardProps,
) {
    if (
        previous.locationName !== next.locationName ||
        previous.snapshots.length !== next.snapshots.length
    ) {
        return false;
    }

    return previous.snapshots.every((snapshot, index) => {
        const nextSnapshot = next.snapshots[index];
        return (
            snapshot.id === nextSnapshot.id &&
            snapshot.imageUrl === nextSnapshot.imageUrl &&
            snapshot.capturedAt === nextSnapshot.capturedAt &&
            snapshot.obstructionRatio === nextSnapshot.obstructionRatio &&
            snapshot.confidenceScore === nextSnapshot.confidenceScore &&
            snapshot.yoloStatus === nextSnapshot.yoloStatus
        );
    });
}
