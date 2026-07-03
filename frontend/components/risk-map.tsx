"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Crosshair,
  Minus,
  Plus,
} from "lucide-react";
import {
  CustomOverlayMap,
  Map,
  MapMarker,
  MarkerClusterer,
  ZoomControl,
  useKakaoLoader,
} from "react-kakao-maps-sdk";
import { cn } from "@/lib/utils";
import { DRAINS, STATUS_META, type DrainFacility } from "@/lib/mock-data";
import type { RiskLevel } from "@/lib/risk";

type MapCenter = {
  lat: number;
  lng: number;
};

type KakaoLoaderOptions = Parameters<typeof useKakaoLoader>[0];
type DrainWithCoordinate = DrainFacility & {
  latitude: number;
  longitude: number;
};

const DEFAULT_CENTER: MapCenter = {
  lat: 37.4979,
  lng: 127.0276,
};

const MARKER_CLUSTER_THRESHOLD = 30;

const MARKER_COLORS: Record<RiskLevel, string> = {
  danger: "#ef4444",
  caution: "#f59e0b",
  good: "#10b981",
  unknown: "#94a3b8",
};

export function RiskMap({
  drains = DRAINS,
  selectedId,
  onSelect,
  labelLocation,
  variant = "dashboard",
}: {
  drains?: DrainFacility[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  labelLocation?: string;
  variant?: "dashboard" | "detail";
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
  const validDrains = useMemo(
    () => drains.filter(hasValidCoordinate),
    [drains],
  );
  const selectedDrain = useMemo(
    () => validDrains.find((drain) => drain.id === selectedId),
    [selectedId, validDrains],
  );
  const legendCounts = useMemo(() => getLegendCounts(drains), [drains]);
  const fallbackReason = getFallbackReason({
    appKey,
    validCount: validDrains.length,
  });

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900",
        variant === "dashboard" && "min-h-[280px] sm:min-h-[320px] md:min-h-[420px]",
      )}
    >
      {!appKey || validDrains.length === 0 ? (
        <FallbackRiskMap
          drains={drains}
          selectedId={selectedId}
          onSelect={onSelect}
          labelLocation={labelLocation}
          reason={fallbackReason}
        />
      ) : (
        <KakaoRiskMap
          appKey={appKey}
          drains={drains}
          validDrains={validDrains}
          selectedDrain={selectedDrain}
          selectedId={selectedId}
          onSelect={onSelect}
          labelLocation={labelLocation}
        />
      )}

      <MapLegend legendCounts={legendCounts} />
    </div>
  );
}

function KakaoRiskMap({
  appKey,
  drains,
  validDrains,
  selectedDrain,
  selectedId,
  onSelect,
  labelLocation,
}: {
  appKey: string;
  drains: DrainFacility[];
  validDrains: DrainWithCoordinate[];
  selectedDrain?: DrainWithCoordinate;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  labelLocation?: string;
}) {
  const loaderOptions = useMemo<KakaoLoaderOptions>(
    () => ({
      appkey: appKey,
      libraries: ["clusterer"],
    }),
    [appKey],
  );
  const [loading, error] = useKakaoLoader(loaderOptions);
  const center = selectedDrain
    ? drainToCenter(selectedDrain)
    : getMapCenter(validDrains);
  const shouldClusterMarkers = validDrains.length >= MARKER_CLUSTER_THRESHOLD;
  const markers = useMemo(
    () =>
      validDrains.map((drain) => (
        <MapMarker
          key={drain.id}
          position={drainToCenter(drain)}
          image={getMarkerImage({
            status: drain.status,
            selected: drain.id === selectedId,
            alt: `${STATUS_META[drain.status].label} 시설 마커`,
          })}
          title={`${drain.id} ${drain.road}`}
          zIndex={drain.id === selectedId ? 20 : 10}
          onClick={() => onSelect?.(drain.id)}
        />
      )),
    [onSelect, selectedId, validDrains],
  );

  if (error) {
    return (
      <FallbackRiskMap
        drains={drains}
        selectedId={selectedId}
        onSelect={onSelect}
        labelLocation={labelLocation}
        reason={getFallbackReason({
          appKey,
          error,
          validCount: validDrains.length,
        })}
      />
    );
  }

  return (
    <>
      <Map
        center={center}
        isPanto
        level={validDrains.length > 1 ? 5 : 3}
        className="absolute inset-0 size-full"
      >
        <ZoomControl position="RIGHT" />
        {shouldClusterMarkers ? (
          <MarkerClusterer
            averageCenter
            minLevel={6}
            minClusterSize={8}
            gridSize={80}
            styles={CLUSTER_STYLES}
            calculator={[10, 50, 100, 500]}
          >
            {markers}
          </MarkerClusterer>
        ) : (
          markers
        )}
        {selectedDrain && (
          <CustomOverlayMap
            position={drainToCenter(selectedDrain)}
            yAnchor={2.1}
            zIndex={30}
          >
            <span className="whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md dark:bg-slate-100 dark:text-slate-900">
              {labelLocation ?? selectedDrain.road}
            </span>
          </CustomOverlayMap>
        )}
      </Map>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          Kakao 지도를 불러오고 있습니다.
        </div>
      )}
    </>
  );
}

function FallbackRiskMap({
  drains,
  selectedId,
  onSelect,
  labelLocation,
  reason,
}: {
  drains: DrainFacility[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  labelLocation?: string;
  reason: string;
}) {
  return (
    <>
      <MockStreetBackground />
      <div className="absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          className="flex size-9 items-center justify-center text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="확대"
          type="button"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />
        <button
          className="flex size-9 items-center justify-center text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="축소"
          type="button"
        >
          <Minus className="size-4" />
        </button>
      </div>
      <div className="absolute right-4 top-[120px] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <button
          className="flex size-9 items-center justify-center text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="현재 위치"
          type="button"
        >
          <Crosshair className="size-4" />
        </button>
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-start gap-2 rounded-lg border border-amber-200 bg-white/95 px-3 py-2 text-xs text-amber-700 shadow-sm backdrop-blur dark:border-amber-900 dark:bg-slate-900/95 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>{reason}</span>
      </div>
      {drains.map((drain) => {
        const selected = drain.id === selectedId;
        const meta = STATUS_META[drain.status];
        return (
          <button
            key={drain.id}
            onClick={() => onSelect?.(drain.id)}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{ left: `${drain.x}%`, top: `${drain.y}%` }}
            aria-label={`${drain.id} ${drain.road}`}
            type="button"
          >
            {selected && (
              <>
                <span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-red-400/40" />
                <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/15 ring-2 ring-red-400" />
              </>
            )}
            <span
              className={cn(
                "relative block size-4 rounded-full border-2 border-white shadow-md transition-transform",
                meta.dot,
                selected ? "scale-125 ring-2 ring-red-500" : "hover:scale-110",
              )}
            />
            {selected && labelLocation && (
              <span className="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md">
                {labelLocation}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function MapLegend({
  legendCounts,
}: {
  legendCounts: Record<RiskLevel, number>;
}) {
  return (
    <div className="absolute left-4 top-4 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <ul className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
        <LegendRow
          color={STATUS_META.danger.dot}
          label="위험"
          count={legendCounts.danger}
        />
        <LegendRow
          color={STATUS_META.caution.dot}
          label="주의"
          count={legendCounts.caution}
        />
        <LegendRow
          color={STATUS_META.good.dot}
          label="양호"
          count={legendCounts.good}
        />
        <LegendRow
          color={STATUS_META.unknown.dot}
          label="판단불가"
          count={legendCounts.unknown}
        />
      </ul>
    </div>
  );
}

function LegendRow({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", color)} />
      <span>
        {label} ({count})
      </span>
    </li>
  );
}

function MockStreetBackground() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="100%" height="100%" fill="#f1f5f9" />
      <defs>
        <pattern
          id="blocks"
          width="120"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          <rect width="120" height="120" fill="#f8fafc" />
          <rect x="8" y="8" width="104" height="104" rx="4" fill="#eef2f6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#blocks)" />
      {[15, 35, 55, 75].map((y) => (
        <line
          key={`h${y}`}
          x1="0"
          y1={`${y}%`}
          x2="100%"
          y2={`${y}%`}
          stroke="#e2e8f0"
          strokeWidth="10"
        />
      ))}
      {[20, 45, 70].map((x) => (
        <line
          key={`v${x}`}
          x1={`${x}%`}
          y1="0"
          x2={`${x}%`}
          y2="100%"
          stroke="#e2e8f0"
          strokeWidth="10"
        />
      ))}
      <line
        x1="0"
        y1="100%"
        x2="100%"
        y2="20%"
        stroke="#dbe3ec"
        strokeWidth="14"
      />
      <path
        d="M 100 540 C 200 480, 260 520, 340 470 S 500 430, 620 460"
        fill="none"
        stroke="#cfe3f2"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

function hasValidCoordinate(drain: DrainFacility): drain is DrainWithCoordinate {
  if (typeof drain.latitude !== "number" || typeof drain.longitude !== "number") {
    return false;
  }

  return (
    Number.isFinite(drain.latitude) &&
    Number.isFinite(drain.longitude) &&
    Math.abs(drain.latitude) <= 90 &&
    Math.abs(drain.longitude) <= 180
  );
}

function drainToCenter(drain: DrainWithCoordinate): MapCenter {
  return {
    lat: drain.latitude,
    lng: drain.longitude,
  };
}

function getMapCenter(drains: DrainWithCoordinate[]): MapCenter {
  if (drains.length === 0) return DEFAULT_CENTER;

  const total = drains.reduce(
    (acc, drain) => ({
      lat: acc.lat + drain.latitude,
      lng: acc.lng + drain.longitude,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / drains.length,
    lng: total.lng / drains.length,
  };
}

function getLegendCounts(drains: DrainFacility[]): Record<RiskLevel, number> {
  return drains.reduce<Record<RiskLevel, number>>(
    (counts, drain) => {
      counts[drain.status] += 1;
      return counts;
    },
    {
      danger: 0,
      caution: 0,
      good: 0,
      unknown: 0,
    },
  );
}

function getMarkerImage({
  status,
  selected,
  alt,
}: {
  status: RiskLevel;
  selected: boolean;
  alt: string;
}) {
  return {
    src: createMarkerImage(status, selected),
    size: {
      width: 34,
      height: 44,
    },
    options: {
      alt,
      offset: {
        x: 17,
        y: 42,
      },
    },
  };
}

function createMarkerImage(status: RiskLevel, selected: boolean) {
  const color = MARKER_COLORS[status];
  const ring = selected ? "#0f172a" : "#ffffff";
  const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
            <path d="M17 42C13 35 5 28 5 17C5 10.4 10.4 5 17 5C23.6 5 29 10.4 29 17C29 28 21 35 17 42Z" fill="${color}" stroke="${ring}" stroke-width="3"/>
            <circle cx="17" cy="17" r="6" fill="#ffffff" fill-opacity="0.92"/>
        </svg>
    `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getFallbackReason({
  appKey,
  error,
  validCount,
}: {
  appKey?: string;
  error?: ErrorEvent;
  validCount: number;
}) {
  if (!appKey) {
    return "Kakao Maps JavaScript 키가 없어 임시 지도를 표시합니다.";
  }
  if (validCount === 0) {
    return "사용 가능한 위도/경도 좌표가 없어 임시 지도를 표시합니다.";
  }
  if (error) {
    return "Kakao Maps SDK를 불러오지 못해 임시 지도를 표시합니다.";
  }
  return "Kakao 지도를 준비하는 동안 임시 지도를 표시합니다.";
}

const CLUSTER_STYLES = [
  {
    width: "38px",
    height: "38px",
    borderRadius: "19px",
    background: "rgba(14, 116, 144, 0.9)",
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: "38px",
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.22)",
  },
  {
    width: "46px",
    height: "46px",
    borderRadius: "23px",
    background: "rgba(217, 119, 6, 0.92)",
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: "46px",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.24)",
  },
  {
    width: "54px",
    height: "54px",
    borderRadius: "27px",
    background: "rgba(220, 38, 38, 0.92)",
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: "54px",
    boxShadow: "0 12px 26px rgba(15, 23, 42, 0.26)",
  },
  {
    width: "62px",
    height: "62px",
    borderRadius: "31px",
    background: "rgba(15, 23, 42, 0.9)",
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: "62px",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.3)",
  },
];
