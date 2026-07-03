"use client";

import { Fragment, memo, useCallback, useMemo, useState } from "react";
import { AlertCircle, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, type DrainFacility } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";
import { MetricProgress } from "@/components/metric-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { MobileDrainInlineSummary } from "@/components/dashboard/mobile-drain-inline-summary";
import { formatFinalDecisionLabel } from "@/lib/final-decision-label";

const SORT_OPTIONS = [
  { value: "risk", label: "위험도순" },
  { value: "recent", label: "최신순" },
  { value: "id", label: "시설 ID순" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];
export type DrainRiskListStatus = "loading" | "success" | "empty" | "error";
export type DrainRealtimeStatus =
  | "waiting"
  | "connected"
  | "reconnecting"
  | "error";

export function DrainRiskList({
  drains,
  selectedId,
  onSelect,
  status = drains.length > 0 ? "success" : "empty",
  realtimeStatus = "waiting",
  onRetry,
}: {
  drains: DrainFacility[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  status?: DrainRiskListStatus;
  realtimeStatus?: DrainRealtimeStatus;
  onRetry?: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("risk");
  const isListReady = status === "success";
  const handleSelect = useCallback(
    (id: string) => {
      onSelect?.(id);
    },
    [onSelect],
  );

  const ordered = useMemo(() => {
    const list = [...drains];
    if (sort === "recent")
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sort === "id") return list.sort((a, b) => a.id.localeCompare(b.id));
    return list; // already risk-sorted from parent
  }, [drains, sort]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:px-5 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            위험 시설 목록
          </h2>
          <RealtimeStatusChip status={realtimeStatus} />
        </div>
        <div className="mt-3 flex justify-end">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            disabled={!isListReady}
          >
            <SelectTrigger className="h-8 w-30 border-slate-200 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <SelectValue placeholder="정렬">
                {SORT_OPTIONS.find((o) => o.value === sort)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === "loading" && <DrainRiskListSkeleton />}
      {status === "empty" && <DrainRiskListEmptyState />}
      {status === "error" && <DrainRiskListErrorState onRetry={onRetry} />}
      {status === "success" && (
        <ul className="dashboard-scrollbar flex-1 overflow-y-auto px-1.5 py-1.5 [scrollbar-gutter:stable]">
          {ordered.map((drain, idx) => (
            <Fragment key={drain.id}>
              <DrainRiskListItem
                drain={drain}
                rank={idx + 1}
                selected={drain.id === selectedId}
                onSelect={handleSelect}
              />
              {drain.id === selectedId && (
                <li className="px-2 py-2 lg:hidden">
                  <MobileDrainInlineSummary drain={drain} />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}

const DrainRiskListItem = memo(function DrainRiskListItem({
  drain,
  rank,
  selected,
  onSelect,
}: {
  drain: DrainFacility;
  rank: number;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  const meta = STATUS_META[drain.status];

  return (
    <li className="px-2 py-1.5 md:px-3">
      <button
        onClick={() => onSelect?.(drain.id)}
        className={cn(
          "w-full rounded-xl border border-transparent bg-transparent px-3 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/70 md:px-4 md:py-3.5",
          selected &&
            "border-cyan-200 bg-cyan-50/70 shadow-cyan-100 ring-1 ring-cyan-100 hover:border-cyan-200 hover:bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30 dark:ring-cyan-950/70 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/30",
        )}
        aria-pressed={selected}
      >
        <div className="flex items-start gap-2.5 md:items-center md:gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white md:mt-0",
              meta.dot,
            )}
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 md:items-center">
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {drain.id}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900 break-words dark:text-slate-100 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1] md:[-webkit-line-clamp:2] overflow-hidden" title={drain.road}>
                {drain.road}
              </span>
              <StatusBadge status={drain.status} className="ml-auto shrink-0" />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400 md:text-xs" title={formatFinalDecisionLabel(drain.judgement)}>
              판정 결과{" "}
              <span className={cn("font-semibold", meta.text)}>
                {formatFinalDecisionLabel(drain.judgement)}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70 md:flex-nowrap md:gap-4">
          <div className="flex flex-1 items-center gap-2">
            <span className="w-14 shrink-0 text-[11px] text-slate-500 dark:text-slate-400 md:text-xs">
              막힘 정도
            </span>
            <MetricProgress
              value={drain.blockage ?? 0}
              barClass={meta.bar}
              className="flex-1"
            />
            <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-slate-700 dark:text-slate-200 md:text-xs">
              {drain.blockage == null ? "-" : `${drain.blockage}%`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 md:text-xs">
              수위
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 md:text-xs">
              {drain.waterLevelCm == null ? "-" : `${drain.waterLevelCm} cm`}
            </span>
          </div>
        </div>

        <p className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500 md:text-xs">
          <span>최근 업데이트</span>
          <span className="text-slate-500 dark:text-slate-300">
            {formatDateTimeForDisplay(drain.updatedAt)}
          </span>
        </p>
      </button>
    </li>
  );
}, areRiskListItemPropsEqual);

function areRiskListItemPropsEqual(
  prev: Readonly<{
    drain: DrainFacility;
    rank: number;
    selected: boolean;
    onSelect?: (id: string) => void;
  }>,
  next: Readonly<{
    drain: DrainFacility;
    rank: number;
    selected: boolean;
    onSelect?: (id: string) => void;
  }>,
) {
  return (
    prev.drain === next.drain &&
    prev.rank === next.rank &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect
  );
}

function RealtimeStatusChip({ status }: { status: DrainRealtimeStatus }) {
  const meta: Record<
    DrainRealtimeStatus,
    { label: string; className: string }
  > = {
    connected: {
      label: "실시간 연결됨",
      className: "border-emerald-200 bg-emerald-50 text-emerald-600",
    },
    waiting: {
      label: "실시간 연결 대기",
      className: "border-slate-200 bg-slate-100 text-slate-600",
    },
    reconnecting: {
      label: "재연결 중",
      className: "border-amber-200 bg-amber-50 text-amber-600",
    },
    error: {
      label: "연결 실패",
      className: "border-red-200 bg-red-50 text-red-600",
    },
  };

  return (
    <Badge className={cn("gap-1.5", meta[status].className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta[status].label}
    </Badge>
  );
}

function DrainRiskListSkeleton() {
  return (
    <div className="flex-1 divide-y divide-slate-100 overflow-hidden">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="px-5 py-4">
          <div className="flex animate-pulse items-center gap-3">
            <span className="size-6 rounded-md bg-slate-200" />
            <span className="h-4 w-16 rounded bg-slate-200" />
            <span className="h-4 flex-1 rounded bg-slate-100" />
            <span className="h-5 w-12 rounded-md bg-slate-100" />
          </div>
          <div className="mt-3 flex animate-pulse items-center gap-2">
            <span className="h-3 w-14 rounded bg-slate-100" />
            <span className="h-2 flex-1 rounded-full bg-slate-100" />
            <span className="h-3 w-8 rounded bg-slate-100" />
          </div>
          <div className="mt-2 h-3 w-36 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function DrainRiskListEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10 text-center">
      <div>
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Inbox className="size-5" />
        </span>
        <p className="mt-3 text-sm font-bold text-slate-800">
          현재 표시할 위험 시설이 없습니다.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          모든 시설이 정상 상태이거나 조회된 시설이 없습니다.
        </p>
      </div>
    </div>
  );
}

function DrainRiskListErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full rounded-lg border border-red-100 bg-red-50/60 p-4 text-center dark:border-red-950/60 dark:bg-red-950/30">
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-white text-red-500 shadow-sm">
          <AlertCircle className="size-5" />
        </span>
        <p className="mt-3 text-sm font-bold text-red-700 dark:text-red-300">
          시설 목록을 불러오지 못했습니다.
        </p>
        <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/80">
          서버 연결을 확인한 뒤 다시 시도해주세요.
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            variant="outline"
            className="mt-4 border-red-200 bg-white text-red-600 hover:bg-red-50"
          >
            <RotateCcw className="size-3.5" />
            다시 시도
          </Button>
        )}
      </div>
    </div>
  );
}
