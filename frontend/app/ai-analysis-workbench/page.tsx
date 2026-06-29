"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    AlertCircle,
    BrainCircuit,
    CheckCircle2,
    FileImage,
    Gauge,
    ImageUp,
    Loader2,
    RotateCcw,
    Waves,
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
import { previewAiAnalysis } from "@/lib/api/ai-analysis-workbench";
import type { AiPreviewAnalysisResultDto } from "@/lib/api/types";
import { STATUS_META, type RiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";

const TOKEN_STORAGE_KEY = "smartdrain-demo-control-token";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type AnalysisRecord = {
    id: string;
    imageUrl: string;
    result: AiPreviewAnalysisResultDto;
};

export default function AiAnalysisWorkbenchPage() {
    const [token, setToken] = useState(() =>
        typeof window === "undefined"
            ? ""
            : (window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? ""),
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [waterLevelCm, setWaterLevelCm] = useState(30);
    const [flowVelocityMps, setFlowVelocityMps] = useState(0.8);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [latestRecord, setLatestRecord] = useState<AnalysisRecord | null>(null);
    const [records, setRecords] = useState<AnalysisRecord[]>([]);
    const currentPreviewUrl = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (currentPreviewUrl.current) {
                URL.revokeObjectURL(currentPreviewUrl.current);
            }
        };
    }, []);

    const canSubmit = Boolean(imageFile) && !isSubmitting;
    const latestResult = latestRecord?.result ?? null;
    const riskLevel = latestResult?.xgboostResult.riskLevel;

    const saveToken = () => {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
        setErrorMessage(null);
    };

    const resetForm = () => {
        if (currentPreviewUrl.current) {
            URL.revokeObjectURL(currentPreviewUrl.current);
            currentPreviewUrl.current = null;
        }
        setImageFile(null);
        setImageUrl(null);
        setWaterLevelCm(30);
        setFlowVelocityMps(0.8);
        setErrorMessage(null);
        setLatestRecord(null);
    };

    const runAnalysis = async () => {
        if (!imageFile) {
            setErrorMessage("분석할 이미지를 먼저 선택해주세요.");
            return;
        }
        if (!imageFile.type.startsWith("image/")) {
            setErrorMessage("jpg, png, webp 이미지 파일만 사용할 수 있습니다.");
            return;
        }
        if (imageFile.size > MAX_IMAGE_BYTES) {
            setErrorMessage("이미지 파일은 10MB 이하만 업로드할 수 있습니다.");
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await previewAiAnalysis({
                image: imageFile,
                waterLevelCm,
                flowVelocityMps,
                token,
            });

            if (!response.success || !response.data) {
                throw new Error(response.error?.message ?? "AI 분석 요청에 실패했습니다.");
            }

            const record: AnalysisRecord = {
                id: `${Date.now()}-${imageFile.name}`,
                imageUrl: URL.createObjectURL(imageFile),
                result: response.data,
            };
            setLatestRecord(record);
            setRecords((current) => [record, ...current].slice(0, 8));
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "AI 분석 요청에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-dvh bg-background">
            <AppHeader />
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 md:p-6">
                <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                            AI 분석 검증 워크벤치
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            발표 후보 이미지를 업로드하고 수위·유속 값을 바꿔 YOLO와 XGBoost 결과를 확인합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                            <BrainCircuit className="size-3" /> 실제 AI preview
                        </Badge>
                        <Badge variant="secondary">대시보드 미반영</Badge>
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>분석 입력</CardTitle>
                            <CardDescription>
                                이미지는 분석용으로만 전송하고 결과는 이 화면에서 비교합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    접근 토큰
                                </label>
                                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                    <input
                                        className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                                        type="password"
                                        value={token}
                                        onChange={(event) => setToken(event.target.value)}
                                        placeholder="Demo control token"
                                    />
                                    <Button type="button" variant="outline" onClick={saveToken}>
                                        저장
                                    </Button>
                                </div>
                            </div>

                            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900">
                                {imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={imageUrl}
                                        alt="업로드 이미지 미리보기"
                                        className="max-h-72 w-full rounded-lg object-contain"
                                    />
                                ) : (
                                    <>
                                        <span className="flex size-12 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                                            <ImageUp className="size-6" />
                                        </span>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            분석할 빗물받이 이미지를 선택하세요
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            jpg, png, webp · 최대 10MB
                                        </span>
                                    </>
                                )}
                                <input
                                    className="sr-only"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        if (currentPreviewUrl.current) {
                                            URL.revokeObjectURL(currentPreviewUrl.current);
                                            currentPreviewUrl.current = null;
                                        }
                                        setImageFile(file);
                                        if (file) {
                                            const objectUrl = URL.createObjectURL(file);
                                            currentPreviewUrl.current = objectUrl;
                                            setImageUrl(objectUrl);
                                        } else {
                                            setImageUrl(null);
                                        }
                                        setErrorMessage(null);
                                    }}
                                />
                            </label>

                            {imageFile && (
                                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                                    <FileImage className="size-4 text-cyan-700 dark:text-cyan-300" />
                                    <span className="min-w-0 flex-1 truncate font-medium">{imageFile.name}</span>
                                    <span className="text-xs text-muted-foreground">{formatBytes(imageFile.size)}</span>
                                </div>
                            )}

                            <SensorInput
                                icon={<Gauge className="size-4" />}
                                label="수위"
                                value={waterLevelCm}
                                min={0}
                                max={120}
                                step={1}
                                suffix="cm"
                                onChange={setWaterLevelCm}
                            />
                            <SensorInput
                                icon={<Waves className="size-4" />}
                                label="유속"
                                value={flowVelocityMps}
                                min={0}
                                max={3}
                                step={0.05}
                                suffix="m/s"
                                onChange={setFlowVelocityMps}
                            />

                            <div className="flex flex-wrap gap-2">
                                <Button type="button" disabled={!canSubmit} onClick={runAnalysis}>
                                    {isSubmitting ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <BrainCircuit className="size-4" />
                                    )}
                                    분석 실행
                                </Button>
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    <RotateCcw className="size-4" /> 입력 초기화
                                </Button>
                            </div>

                            {errorMessage && (
                                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>분석 결과</CardTitle>
                            <CardDescription>
                                마지막 실행 결과를 기준으로 이미지 후보 적합성을 확인합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {latestResult ? (
                                <>
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <ResultMetric
                                            label="YOLO 막힘률"
                                            value={formatPercent(latestResult.yoloResult.obstructionRatio)}
                                        />
                                        <ResultMetric
                                            label="YOLO 신뢰도"
                                            value={formatPercent(latestResult.yoloResult.confidenceScore)}
                                        />
                                        <ResultMetric
                                            label="처리 시간"
                                            value={latestResult.elapsedMs ? `${latestResult.elapsedMs}ms` : "-"}
                                        />
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold">위험도 판단</span>
                                                {riskLevel && <RiskBadge riskLevel={riskLevel} />}
                                            </div>
                                            <dl className="grid gap-2 text-sm">
                                                <Definition
                                                    label="위험 점수"
                                                    value={formatPercent(latestResult.xgboostResult.riskScore)}
                                                />
                                                <Definition
                                                    label="최종 판단"
                                                    value={decisionLabel(latestResult.xgboostResult.finalDecision)}
                                                />
                                                <Definition
                                                    label="YOLO 상태"
                                                    value={yoloStatusLabel(latestResult.yoloResult.yoloStatus)}
                                                />
                                                <Definition
                                                    label="모델"
                                                    value={latestResult.xgboostResult.modelVersion ?? "-"}
                                                />
                                            </dl>
                                        </div>

                                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                            <span className="text-sm font-semibold">XGBoost 입력 Feature</span>
                                            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                                <Definition
                                                    label="obstructionRatio"
                                                    value={formatDecimal(latestResult.input.features.obstructionRatio)}
                                                />
                                                <Definition
                                                    label="confidenceScore"
                                                    value={formatDecimal(latestResult.input.features.confidenceScore)}
                                                />
                                                <Definition
                                                    label="waterLevel"
                                                    value={formatDecimal(latestResult.input.features.waterLevel)}
                                                />
                                                <Definition
                                                    label="flowVelocity"
                                                    value={formatDecimal(latestResult.input.features.flowVelocity)}
                                                />
                                            </dl>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                                            <span>{analysisSummary(latestResult)}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
                                    <BrainCircuit className="size-10 text-slate-400" />
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        아직 분석 결과가 없습니다.
                                    </p>
                                    <p className="max-w-md text-sm text-muted-foreground">
                                        이미지를 선택하고 수위·유속 값을 조정한 뒤 분석을 실행하면 YOLO와 XGBoost 결과가 여기에 표시됩니다.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <AnalysisHistory records={records} onSelect={setLatestRecord} />
            </main>
        </div>
    );
}

function SensorInput({
    icon,
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
}: {
    icon: ReactNode;
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
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {icon}
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

function ResultMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-950 dark:text-slate-50">{value}</dd>
        </div>
    );
}

function Definition({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words font-semibold text-slate-950 dark:text-slate-50">{value}</dd>
        </div>
    );
}

function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
    return (
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_META[riskLevel].badgeClass)}>
            {STATUS_META[riskLevel].label}
        </span>
    );
}

function AnalysisHistory({
    records,
    onSelect,
}: {
    records: AnalysisRecord[];
    onSelect: (record: AnalysisRecord) => void;
}) {
    const hasRecords = records.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>최근 분석 비교</CardTitle>
                <CardDescription>
                    브라우저 세션에서 최근 8건을 비교합니다. 새로고침하면 목록은 초기화됩니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasRecords ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="border-b border-slate-200 text-xs text-muted-foreground dark:border-slate-800">
                                <tr>
                                    <th className="py-2 pr-3 font-medium">이미지</th>
                                    <th className="py-2 pr-3 font-medium">센서값</th>
                                    <th className="py-2 pr-3 font-medium">YOLO</th>
                                    <th className="py-2 pr-3 font-medium">XGBoost</th>
                                    <th className="py-2 pr-3 font-medium">판정</th>
                                    <th className="py-2 text-right font-medium">액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-2">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={record.imageUrl}
                                                    alt=""
                                                    className="size-12 rounded-lg object-cover"
                                                />
                                                <span className="max-w-40 truncate font-medium">
                                                    {record.result.fileName ?? "업로드 이미지"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3 text-muted-foreground">
                                            {record.result.input.waterLevelCm}cm · {record.result.input.flowVelocityMps}m/s
                                        </td>
                                        <td className="py-3 pr-3 text-muted-foreground">
                                            {formatPercent(record.result.yoloResult.obstructionRatio)} · {formatPercent(record.result.yoloResult.confidenceScore)}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <RiskBadge riskLevel={record.result.xgboostResult.riskLevel} />
                                        </td>
                                        <td className="py-3 pr-3 text-muted-foreground">
                                            {decisionLabel(record.result.xgboostResult.finalDecision)}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Button type="button" size="sm" variant="outline" onClick={() => onSelect(record)}>
                                                다시 보기
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900/60">
                        분석을 실행하면 이미지 후보별 결과가 여기에 쌓입니다.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function analysisSummary(result: AiPreviewAnalysisResultDto) {
    const riskLabel = STATUS_META[result.xgboostResult.riskLevel].label;
    return `이 이미지는 막힘률 ${formatPercent(result.yoloResult.obstructionRatio)}, 신뢰도 ${formatPercent(result.yoloResult.confidenceScore)}로 분석되었고, 입력한 센서값과 결합한 최종 위험도는 ${riskLabel}입니다.`;
}

function yoloStatusLabel(status: string) {
    const labels: Record<string, string> = {
        clear: "막힘 거의 없음",
        partially_blocked: "일부 막힘",
        blocked: "심한 막힘",
        unknown: "판단불가",
    };
    return labels[status] ?? status;
}

function decisionLabel(value: string | null | undefined) {
    const labels: Record<string, string> = {
        normal: "정상 운영",
        monitoring: "모니터링 필요",
        field_check: "현장 확인 필요",
        dispatch_required: "출동 필요",
        good: "정상 운영",
        caution: "모니터링 필요",
        danger: "출동 필요",
        unknown: "현장 확인 필요",
    };
    if (!value) return "-";
    return labels[value] ?? value;
}

function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined) return "-";
    return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number | null | undefined) {
    if (value === null || value === undefined) return "-";
    return value.toFixed(4);
}

function formatBytes(value: number) {
    const mb = value / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)}MB`;
    return `${Math.max(Math.round(value / 1024), 1)}KB`;
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
}
