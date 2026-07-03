import { Info } from "lucide-react";
import { DrainDetailPanel } from "@/components/dashboard/drain-detail-panel";
import { DrainMapPanel } from "@/components/dashboard/drain-map-panel";
import {
    DrainRiskList,
    type DrainRealtimeStatus,
    type DrainRiskListStatus,
} from "@/components/dashboard/drain-risk-list";
import { MobileDrainInlineSummary } from "@/components/dashboard/mobile-drain-inline-summary";
import { PlaceholderState } from "@/components/placeholder-state";
import { PLACEHOLDER_IMAGES } from "@/lib/placeholders";
import type { DrainFacility } from "@/lib/mock-data";

type DashboardMainContentProps = {
    mapDrains: DrainFacility[];
    hasDashboardData: boolean;
    drains: DrainFacility[];
    selectedId: string | null;
    selectedDrain?: DrainFacility;
    isLoading: boolean;
    riskListStatus: DrainRiskListStatus;
    realtimeStatus: DrainRealtimeStatus;
    onSelectDrain: (id: string) => void;
    onRetry: () => void;
};

export function DashboardMainContent({
    mapDrains,
    hasDashboardData,
    drains,
    selectedId,
    selectedDrain,
    isLoading,
    riskListStatus,
    realtimeStatus,
    onSelectDrain,
    onRetry,
}: DashboardMainContentProps) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <section className="lg:col-span-6 xl:col-span-7 xl:h-[clamp(32rem,calc(100dvh-11rem),42rem)] 2xl:h-[clamp(34rem,calc(100dvh-10rem),46rem)]">
                <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            도시 배수 시설 위험도 지도
                        </h2>
                        {!hasDashboardData && (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                데이터 불러오는 중
                            </span>
                        )}
                    </div>
                    <div className="min-h-0 flex-1">
                        {hasDashboardData ? (
                            <DrainMapPanel
                                drains={mapDrains}
                                selectedId={selectedId}
                                onSelect={onSelectDrain}
                                labelLocation={selectedDrain?.road}
                            />
                        ) : (
                            <MapLoadingState />
                        )}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                        <Info className="size-3.5" />
                        지도에서 배수 시설을 클릭하면 상세 정보를 확인할 수 있습니다.
                    </p>
                </div>
            </section>

            <section className="lg:col-span-6 xl:col-span-5 xl:h-[clamp(32rem,calc(100dvh-11rem),42rem)] 2xl:col-span-3 2xl:h-[clamp(34rem,calc(100dvh-10rem),46rem)]">
                <div className="h-full shadow-sm">
                    <DrainRiskList
                        drains={drains}
                        selectedId={selectedId}
                        onSelect={onSelectDrain}
                        status={riskListStatus}
                        realtimeStatus={realtimeStatus}
                        onRetry={onRetry}
                    />
                </div>
            </section>

            <section className="hidden lg:col-span-12 lg:block xl:hidden">
                {selectedDrain ? (
                    <MobileDrainInlineSummary drain={selectedDrain} />
                ) : !isLoading && drains.length === 0 ? (
                    <PlaceholderState
                        image={PLACEHOLDER_IMAGES.facility}
                        title="선택된 시설이 없습니다"
                        description="지도 또는 목록에서 시설을 선택하면 요약 정보를 확인할 수 있습니다."
                        statusLabel="시설 미선택"
                        className="min-h-[180px]"
                    />
                ) : null}
            </section>

            <section className="hidden xl:col-span-12 xl:block 2xl:col-span-2 2xl:h-[clamp(34rem,calc(100dvh-10rem),46rem)]">
                {selectedDrain ? (
                    <div className="h-full shadow-sm">
                        <DrainDetailPanel
                            drain={selectedDrain}
                            imageUrl={selectedDrain.latestImageUrl ?? undefined}
                            showImageRefreshPlaceholder
                        />
                    </div>
                ) : !isLoading && drains.length === 0 ? (
                    <PlaceholderState
                        image={PLACEHOLDER_IMAGES.facility}
                        title="상세 정보를 불러올 수 없습니다"
                        description="백엔드 연결을 확인한 뒤 다시 시도해주세요."
                        statusLabel="연결 오류"
                        className="min-h-[420px]"
                    />
                ) : null}
            </section>
        </div>
    );
}

function MapLoadingState() {
    return (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500 sm:min-h-[320px] md:min-h-[420px]">
            배수 시설 데이터를 불러오고 있습니다.
        </div>
    );
}
