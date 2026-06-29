"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    CheckCircle2,
    CloudRain,
    FastForward,
    Pause,
    Play,
    RotateCcw,
    Shield,
    Square,
    Timer,
    Unlock,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    applyDemoScenarioStep,
    applyDemoPreset,
    clearDemoOverride,
    getDemoStatus,
    nextDemoScenarioStep,
    pauseDemoScenario,
    recoverDemoScenario,
    resetDemo,
    resumeDemoScenario,
    setDemoScenarioInterval,
    startDemoScenario,
    stopDemoScenario,
    type DemoPreset,
    type DemoStatus,
} from "@/lib/api/demo";
import { drainQueryKeys } from "@/lib/query/drain-query-keys";
import { useDrainsQuery } from "@/lib/query/drain-queries";
import { STATUS_META } from "@/lib/risk";
import { cn } from "@/lib/utils";

const DEMO_STATUS_KEY = ["demo", "status"] as const;
const TOKEN_STORAGE_KEY = "smartdrain-demo-control-token";

const PRESET_ACTIONS: Array<{
    preset: DemoPreset;
    label: string;
    className: string;
}> = [
    { preset: "GOOD", label: "양호 적용", className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
    { preset: "CAUTION", label: "주의 적용", className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" },
    { preset: "DANGER", label: "위험 적용", className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" },
    { preset: "UNAVAILABLE", label: "판단불가 적용", className: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200" },
];

const WEATHER_LABELS: Record<string, string> = {
    CLEAR: "강우 전",
    LIGHT_RAIN: "약한 비",
    HEAVY_RAIN: "강한 비",
    CLOUDBURST: "집중호우",
    RAIN_WEAKENING: "강우 약화",
    RECOVERY: "복구",
};

export default function DemoControlPage() {
    const queryClient = useQueryClient();
    const drainsQuery = useDrainsQuery();
    const drains = useMemo(() => drainsQuery.data ?? [], [drainsQuery.data]);
    const [token, setToken] = useState(() =>
        typeof window === "undefined"
            ? ""
            : (window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? ""),
    );
    const [selectedDrainId, setSelectedDrainId] = useState("DR-005");
    const [selectedWeatherStep, setSelectedWeatherStep] = useState("LIGHT_RAIN");
    const [manualSensorValues, setManualSensorValues] = useState<{
        waterLevelCm: number;
        flowVelocityMps: number;
    } | null>(null);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const effectiveSelectedDrainId = drains.some((drain) => drain.id === selectedDrainId)
        ? selectedDrainId
        : (drains[0]?.id ?? selectedDrainId);

    const authOptions = useMemo(() => ({ token }), [token]);
    const statusQuery = useQuery({
        queryKey: DEMO_STATUS_KEY,
        queryFn: async () => {
            const response = await getDemoStatus(authOptions);
            if (!response.success || !response.data) {
                throw new Error(response.error?.message ?? "시연 상태를 불러오지 못했습니다.");
            }
            return response.data;
        },
        retry: false,
        refetchInterval: 5000,
    });

    const refreshPresentationData = useCallback((message: string) => {
        setLastMessage(message);
        void queryClient.invalidateQueries({ queryKey: DEMO_STATUS_KEY });
        void queryClient.invalidateQueries({ queryKey: drainQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: drainQueryKeys.summary });
        if (selectedDrainId) {
            void queryClient.invalidateQueries({ queryKey: drainQueryKeys.detail(effectiveSelectedDrainId) });
        }
    }, [effectiveSelectedDrainId, queryClient, selectedDrainId]);

    const runAction = useMutation({
        mutationFn: async (action: () => Promise<{ success: boolean; data: DemoStatus | null; error?: { message: string } }>) => {
            const response = await action();
            if (!response.success) {
                throw new Error(response.error?.message ?? "시연 제어 요청에 실패했습니다.");
            }
            return response.data;
        },
        onError: (error) => {
            setLastMessage(error instanceof Error ? error.message : "시연 제어 요청에 실패했습니다.");
        },
    });

    const isBusy = runAction.isPending;
    const selectedDrain = drains.find((drain) => drain.id === effectiveSelectedDrainId);
    const status = statusQuery.data;
    const manualWaterLevelCm = manualSensorValues?.waterLevelCm ?? status?.manualDefaultWaterLevelCm ?? 30;
    const manualFlowVelocityMps = manualSensorValues?.flowVelocityMps ?? status?.manualDefaultFlowVelocityMps ?? 0.8;

    const saveToken = useCallback(() => {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
        void statusQuery.refetch();
        setLastMessage("제어 토큰을 이 브라우저 세션에 저장했습니다.");
    }, [statusQuery, token]);

    const trigger = useCallback((action: () => Promise<{ success: boolean; data: DemoStatus | null; error?: { message: string } }>, message: string) => {
        runAction.mutate(action, {
            onSuccess: () => refreshPresentationData(message),
        });
    }, [refreshPresentationData, runAction]);

    return (
        <div className="min-h-dvh bg-background">
            <AppHeader />
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 md:p-6">
                <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                            SmartDrain 시연 제어
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            발표자 수동 시연과 관람객 자동 시나리오를 제어합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} isLoading={statusQuery.isLoading} />
                        {status?.enabled ? (
                            <Badge className="bg-emerald-50 text-emerald-700" variant="outline">
                                <Unlock className="size-3" /> Demo enabled
                            </Badge>
                        ) : (
                            <Badge variant="destructive">
                                <Shield className="size-3" /> Demo disabled
                            </Badge>
                        )}
                    </div>
                </section>

                <Card>
                    <CardHeader>
                        <CardTitle>접근 토큰</CardTitle>
                        <CardDescription>
                            Backend에 `DEMO_CONTROL_TOKEN`이 설정된 경우 같은 값을 입력합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 sm:flex-row">
                        <input
                            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                            type="password"
                            value={token}
                            onChange={(event) => setToken(event.target.value)}
                            placeholder="Demo control token"
                        />
                        <Button type="button" onClick={saveToken}>
                            저장
                        </Button>
                    </CardContent>
                </Card>

                <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>단일 빗물받이 수동 시연</CardTitle>
                            <CardDescription>
                                선택한 시설에 고정 preset을 적용합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    대상 시설
                                </label>
                                <select
                                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                                    value={effectiveSelectedDrainId}
                                    onChange={(event) => setSelectedDrainId(event.target.value)}
                                >
                                    {drains.map((drain) => (
                                        <option key={drain.id} value={drain.id}>
                                            {drain.id} · {drain.road}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        수동 시연 센서값
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        이미지는 preset별 지정 경로를 사용하고, 수위·유속만 직접 지정합니다.
                                    </p>
                                </div>
                                <DemoSensorInput
                                    label="수위"
                                    value={manualWaterLevelCm}
                                    min={0}
                                    max={120}
                                    step={1}
                                    suffix="cm"
                                    onChange={(value) => setManualSensorValues({
                                        waterLevelCm: value,
                                        flowVelocityMps: manualFlowVelocityMps,
                                    })}
                                />
                                <DemoSensorInput
                                    label="유속"
                                    value={manualFlowVelocityMps}
                                    min={0}
                                    max={3}
                                    step={0.05}
                                    suffix="m/s"
                                    onChange={(value) => setManualSensorValues({
                                        waterLevelCm: manualWaterLevelCm,
                                        flowVelocityMps: value,
                                    })}
                                />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                {PRESET_ACTIONS.map((action) => (
                                    <Button
                                        key={action.preset}
                                        type="button"
                                        variant="outline"
                                        className={cn("h-10", action.className)}
                                        disabled={isBusy || !effectiveSelectedDrainId}
                                        onClick={() => trigger(
                                            () => applyDemoPreset(
                                                effectiveSelectedDrainId,
                                                action.preset,
                                                {
                                                    waterLevelCm: manualWaterLevelCm,
                                                    flowVelocityMps: manualFlowVelocityMps,
                                                },
                                                authOptions,
                                            ),
                                            `${effectiveSelectedDrainId}에 ${action.label}을 실행했습니다.`,
                                        )}
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy || !effectiveSelectedDrainId}
                                    onClick={() => trigger(
                                        () => clearDemoOverride(effectiveSelectedDrainId, authOptions),
                                        `${effectiveSelectedDrainId} 수동 상태를 해제했습니다.`,
                                    )}
                                >
                                    <Square className="size-4" /> 수동 상태 해제
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => resetDemo(authOptions),
                                        "발표용 초기 상태를 적용했습니다.",
                                    )}
                                >
                                    <RotateCcw className="size-4" /> 발표 초기화
                                </Button>
                            </div>

                            {selectedDrain && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <strong>{selectedDrain.id}</strong>
                                        <span>{selectedDrain.road}</span>
                                        <span className={cn("rounded-full border px-2 py-0.5 text-xs", STATUS_META[selectedDrain.status].badgeClass)}>
                                            {STATUS_META[selectedDrain.status].label}
                                        </span>
                                    </div>
                                    <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                                        <Metric label="수위" value={formatNullableNumber(selectedDrain.waterLevelCm, "cm")} />
                                        <Metric label="유속" value={formatNullableNumber(selectedDrain.flowVelocityMps, "m/s")} />
                                        <Metric label="막힘률" value={formatNullablePercent(selectedDrain.blockage)} />
                                    </dl>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>자동 날씨 시나리오</CardTitle>
                            <CardDescription>
                                QR 접속 확인 후 시작하고, 설명이 필요하면 일시정지합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/30">
                                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                                    <CloudRain className="size-4" />
                                    {status ? weatherLabel(status.weatherStep) : "상태 확인 중"}
                                </div>
                                {status && (
                                    <p className="mt-1 text-sm text-cyan-800/80 dark:text-cyan-100/70">
                                        {status.weatherStepIndex + 1} / {status.weatherSteps.length} 단계 · {status.intervalSeconds}초 간격 · {status.randomize ? "자연화 ON" : "고정값"}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => startDemoScenario(authOptions),
                                        "자동 시나리오를 시작했습니다.",
                                    )}
                                >
                                    <Play className="size-4" /> 시작
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => pauseDemoScenario(authOptions),
                                        "자동 시나리오를 일시정지했습니다.",
                                    )}
                                >
                                    <Pause className="size-4" /> 일시정지
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => resumeDemoScenario(authOptions),
                                        "자동 시나리오를 재개했습니다.",
                                    )}
                                >
                                    <Play className="size-4" /> 재개
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => stopDemoScenario(authOptions),
                                        "자동 시나리오를 정지했습니다.",
                                    )}
                                >
                                    <Square className="size-4" /> 정지
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => trigger(
                                        () => nextDemoScenarioStep(authOptions),
                                        "다음 날씨 단계로 이동했습니다.",
                                    )}
                                >
                                    <FastForward className="size-4" /> 다음 단계
                                </Button>
                            </div>

                            <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                    <select
                                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                                        value={selectedWeatherStep}
                                        onChange={(event) => setSelectedWeatherStep(event.target.value)}
                                    >
                                        {(status?.weatherSteps.length ? status.weatherSteps : Object.keys(WEATHER_LABELS)).map((step) => (
                                            <option key={step} value={step}>
                                                {weatherLabel(step)} · {step}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => trigger(
                                            () => applyDemoScenarioStep(selectedWeatherStep, authOptions),
                                            `${weatherLabel(selectedWeatherStep)} 단계로 즉시 전환했습니다.`,
                                        )}
                                    >
                                        단계 적용
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(status?.rehearsalIntervals.length ? status.rehearsalIntervals : [10, 15, 30, 60]).map((intervalSeconds) => (
                                        <Button
                                            key={intervalSeconds}
                                            type="button"
                                            size="sm"
                                            variant={status?.intervalSeconds === intervalSeconds ? "default" : "outline"}
                                            disabled={isBusy}
                                            onClick={() => trigger(
                                                () => setDemoScenarioInterval(intervalSeconds, authOptions),
                                                `자동 시나리오 간격을 ${intervalSeconds}초로 변경했습니다.`,
                                            )}
                                        >
                                            <Timer className="size-3.5" /> {intervalSeconds}초
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                disabled={isBusy}
                                onClick={() => trigger(
                                    () => recoverDemoScenario(authOptions),
                                    "전체 시설을 복구 단계로 전환했습니다.",
                                )}
                            >
                                <CheckCircle2 className="size-4" /> 복구 단계 적용
                            </Button>
                        </CardContent>
                    </Card>
                </section>

                <Card>
                    <CardHeader>
                        <CardTitle>현재 적용 상태</CardTitle>
                        <CardDescription>
                            마지막 제어 요청과 수동 override 상태를 확인합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm md:grid-cols-4">
                        <Metric label="실행 상태" value={status ? scenarioStateLabel(status) : "확인 중"} />
                        <Metric label="마지막 액션" value={status?.lastAction ?? "-"} />
                        <Metric label="수동 override" value={status?.manualOverrides.length ? status.manualOverrides.join(", ") : "없음"} />
                        <Metric label="최근 메시지" value={lastMessage ?? status?.lastError ?? "-"} tone={status?.lastError ? "danger" : "default"} />
                    </CardContent>
                </Card>

                {(statusQuery.error || runAction.error) && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <span>
                            {statusQuery.error instanceof Error
                                ? statusQuery.error.message
                                : runAction.error instanceof Error
                                    ? runAction.error.message
                                    : "시연 제어 상태를 확인하지 못했습니다."}
                        </span>
                    </div>
                )}
            </main>
        </div>
    );
}

function StatusBadge({
    status,
    isLoading,
}: {
    status?: DemoStatus;
    isLoading: boolean;
}) {
    if (isLoading) {
        return <Badge variant="secondary">상태 확인 중</Badge>;
    }

    if (!status) {
        return <Badge variant="destructive">연결 실패</Badge>;
    }

    if (status.running && !status.paused) {
        return <Badge className="bg-cyan-50 text-cyan-700" variant="outline">자동 진행 중</Badge>;
    }

    if (status.running && status.paused) {
        return <Badge className="bg-amber-50 text-amber-700" variant="outline">일시정지</Badge>;
    }

    return <Badge variant="secondary">정지</Badge>;
}

function Metric({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: string;
    tone?: "default" | "danger";
}) {
    return (
        <div>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className={cn("mt-1 break-words font-semibold", tone === "danger" ? "text-red-600" : "text-slate-950 dark:text-slate-50")}>
                {value}
            </dd>
        </div>
    );
}

function DemoSensorInput({
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix: string;
    onChange: (value: number) => void;
}) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                </label>
                <div className="flex items-center gap-2">
                    <input
                        className="h-8 w-24 rounded-lg border border-input bg-background px-2 text-right text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))}
                    />
                    <span className="w-8 text-xs text-muted-foreground">{suffix}</span>
                </div>
            </div>
            <input
                className="w-full accent-cyan-600"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    );
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
}

function formatNullableNumber(value: number | null | undefined, suffix: string) {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(value >= 10 ? 0 : 2)}${suffix}`;
}

function formatNullablePercent(value: number | null | undefined) {
    if (value === null || value === undefined) return "-";
    return `${Math.round(value)}%`;
}

function weatherLabel(step: string) {
    return WEATHER_LABELS[step] ?? step;
}

function scenarioStateLabel(status: DemoStatus) {
    if (status.running && status.paused) return "일시정지";
    if (status.running) return "자동 진행 중";
    return "정지";
}
