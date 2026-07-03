"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  Maximize2,
  ShieldCheck,
  TrendingUp,
  Waves,
  X,
} from "lucide-react";
import { STATUS_META, type DrainFacility } from "@/lib/mock-data";
import { StatusBadge } from "@/components/status-badge";
import { MetricProgress } from "@/components/metric-progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLACEHOLDER_IMAGES } from "@/lib/placeholders";
import { FallbackImage } from "@/components/fallback-image";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { formatDateTimeForDisplay } from "@/lib/date-format";
import { getDrainDetailHref } from "@/lib/drain-route";
import { formatFinalDecisionLabel } from "@/lib/final-decision-label";

export function DrainSummaryPanel({
  drain,
  onClose,
  imageUrl = PLACEHOLDER_IMAGES.facility,
  showImageRefreshPlaceholder = false,
}: {
  drain: DrainFacility;
  onClose?: () => void;
  imageUrl?: string;
  showImageRefreshPlaceholder?: boolean;
}) {
  const meta = STATUS_META[drain.status];
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const snapshotImageKey = `${drain.id}:${imageUrl}`;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:px-5 md:py-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          상세 정보
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="패널 닫기"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="dashboard-scrollbar flex-1 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable] md:px-5 md:py-4">
        <p className="text-sm font-semibold text-slate-900 break-words dark:text-slate-100">
          <span className="[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1] md:[-webkit-line-clamp:2] overflow-hidden">
            {drain.road}
          </span>{" "}
          <span className="font-normal text-slate-500 whitespace-nowrap dark:text-slate-400">
            (빗물받이)
          </span>
        </p>

        {/* Priority summary */}
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                상태
              </span>
              <StatusBadge status={drain.status} className="whitespace-nowrap" />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatDateTimeForDisplay(drain.updatedAt)}
            </span>
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              판정 결과
            </p>
            <p
              className={cn("mt-1 line-clamp-3 text-sm font-bold leading-5", meta.text)}
              title={formatFinalDecisionLabel(drain.judgement)}
            >
              {formatFinalDecisionLabel(drain.judgement)}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              막힘 정도
            </span>
            <span className={cn("font-semibold", meta.text)}>
              {drain.blockage == null ? "-" : `${drain.blockage}%`}
            </span>
          </div>
          <MetricProgress
            value={drain.blockage ?? 0}
            barClass={meta.bar}
            className="mt-2"
            trackClass="bg-white"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">수위</span>
            <span className={cn("font-semibold", meta.text)}>
              {drain.waterLevelCm == null ? "-" : `${drain.waterLevelCm} cm`}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">유속</span>
            <span className={cn("font-semibold", meta.text)}>
              {drain.flowVelocityMps == null ? "-" : `${drain.flowVelocityMps} m/s`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          보조 정보 {isExpanded ? "접기" : "펼치기"}
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>

        {/* CCTV snapshot */}
        <div
          className={cn(
            "space-y-3 lg:mt-3",
            isExpanded ? "mt-3" : "mt-0 hidden lg:block",
          )}
        >
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 md:aspect-[4/3]">
            <SnapshotImage
              key={showImageRefreshPlaceholder ? snapshotImageKey : undefined}
              src={imageUrl}
              fallbackSrc={PLACEHOLDER_IMAGES.facility}
              alt={`${drain.road} 빗물받이 CCTV 스냅샷`}
              showRefreshPlaceholder={showImageRefreshPlaceholder}
            />
            <button
              type="button"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/45 text-white hover:bg-black/60"
              onClick={() => setIsPreviewOpen(true)}
              aria-label="CCTV 이미지 확대"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          {/* Info rows */}
          <dl className="space-y-2.5">
            <InfoRow icon={MapPin} label="주소" value={drain.fullAddress} />
            <InfoRow
              icon={Clock}
              label="최근 업데이트"
              value={formatDateTimeForDisplay(drain.updatedAt)}
            />
            <InfoRow icon={ShieldCheck} label="상태">
              <StatusBadge status={drain.status} />
            </InfoRow>
            <InfoRow icon={Waves} label="막힘 정도">
              <span className={cn("font-semibold", meta.text)}>
                {drain.blockage == null ? "-" : `${drain.blockage}%`}
              </span>
            </InfoRow>
            <InfoRow icon={TrendingUp} label="수위">
              <span className={cn("font-semibold", meta.text)}>
                {drain.waterLevelCm == null ? "-" : `${drain.waterLevelCm} cm`}
              </span>
            </InfoRow>
            <InfoRow icon={Gauge} label="유속">
              <span className={cn("font-semibold", meta.text)}>
                {drain.flowVelocityMps == null ? "-" : `${drain.flowVelocityMps} m/s`}
              </span>
            </InfoRow>
          </dl>
        </div>
      </div>

      <ImagePreviewDialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        src={imageUrl}
        fallbackSrc={PLACEHOLDER_IMAGES.facility}
        alt={`${drain.road} 빗물받이 CCTV 스냅샷 확대 이미지`}
      />

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <Button
          nativeButton={false}
          className="w-full bg-cyan-700 text-white hover:bg-cyan-800"
          render={
              <Link href={getDrainDetailHref(drain.id)}>
              상세 정보 페이지로 이동
              <ChevronRight className="size-4" />
            </Link>
          }
        />
      </div>
    </div>
  );
}

function SnapshotImage({
  src,
  fallbackSrc,
  alt,
  showRefreshPlaceholder,
}: {
  src: string;
  fallbackSrc: string;
  alt: string;
  showRefreshPlaceholder: boolean;
}) {
  const [isLoading, setIsLoading] = useState(showRefreshPlaceholder);

  return (
    <>
      <FallbackImage
        src={src}
        fallbackSrc={fallbackSrc}
        alt={alt}
        className={cn(
          "size-full object-cover transition-opacity duration-200",
          showRefreshPlaceholder && isLoading ? "opacity-0" : "opacity-100",
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
      {showRefreshPlaceholder && isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center dark:bg-slate-800">
          <span className="block h-2 w-2/3 animate-pulse rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="block h-2 w-1/2 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700/70" />
          <span className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            CCTV 이미지 갱신 중
          </span>
        </div>
      )}
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
        <Icon className="size-4 text-slate-400 dark:text-slate-500" />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-right text-sm text-slate-800 dark:text-slate-100">
        {children ?? (
          <span className="block break-keep font-medium" title={value}>
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}
