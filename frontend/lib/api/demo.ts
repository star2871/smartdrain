import { apiClient } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";

export type DemoPreset = "GOOD" | "CAUTION" | "DANGER" | "UNAVAILABLE";

export type DemoStatus = {
    enabled: boolean;
    mode: string;
    autoStart: boolean;
    randomize: boolean;
    running: boolean;
    paused: boolean;
    weatherStep: string;
    weatherStepIndex: number;
    weatherSteps: string[];
    manualOverrides: string[];
    targetDrainCode: string;
    intervalSeconds: number;
    defaultIntervalSeconds: number;
    manualDefaultWaterLevelCm: number;
    manualDefaultFlowVelocityMps: number;
    rehearsalIntervals: number[];
    lastAction: string;
    lastError: string | null;
    updatedAt: string | null;
};

type DemoRequestOptions = {
    token?: string;
};

function demoHeaders(options?: DemoRequestOptions) {
    const token = options?.token?.trim();
    return token
        ? {
            Authorization: `Bearer ${token}`,
            "X-Demo-Control-Token": token,
        }
        : undefined;
}

function parseDemoResponse(value: unknown): ApiResponse<DemoStatus> {
    if (!isRecord(value) || typeof value.success !== "boolean") {
        return invalidDemoResponse();
    }

    if (!value.success) {
        return {
            success: false,
            data: null,
            message: typeof value.message === "string" ? value.message : undefined,
            error: isRecord(value.error)
                ? {
                    code: typeof value.error.code === "string" ? value.error.code : "DEMO_ERROR",
                    message: typeof value.error.message === "string" ? value.error.message : "시연 제어 요청에 실패했습니다.",
                    detail: value.error.detail,
                }
                : undefined,
            timestamp: typeof value.timestamp === "string" ? value.timestamp : undefined,
        };
    }

    if (!isDemoStatus(value.data)) {
        return invalidDemoResponse();
    }

    return {
        success: true,
        data: value.data,
        message: typeof value.message === "string" ? value.message : undefined,
        timestamp: typeof value.timestamp === "string" ? value.timestamp : undefined,
    };
}

export async function getDemoStatus(options?: DemoRequestOptions) {
    const response = await apiClient.get<unknown>("/api/demo/status", {
        headers: demoHeaders(options),
    });
    return parseDemoResponse(response.data);
}

export async function applyDemoPreset(
    drainId: string,
    preset: DemoPreset,
    sensorValues?: {
        waterLevelCm: number;
        flowVelocityMps: number;
    },
    options?: DemoRequestOptions,
) {
    const response = await apiClient.post<unknown>(
        `/api/demo/drains/${encodeURIComponent(drainId)}/preset`,
        { preset, ...sensorValues },
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function clearDemoOverride(
    drainId: string,
    options?: DemoRequestOptions,
) {
    const response = await apiClient.delete<unknown>(
        `/api/demo/drains/${encodeURIComponent(drainId)}/override`,
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function resetDemo(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/reset",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function startDemoScenario(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/start",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function pauseDemoScenario(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/pause",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function resumeDemoScenario(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/resume",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function stopDemoScenario(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/stop",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function nextDemoScenarioStep(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/next",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function applyDemoScenarioStep(
    weatherStep: string,
    options?: DemoRequestOptions,
) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/step",
        { weatherStep },
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function setDemoScenarioInterval(
    intervalSeconds: number,
    options?: DemoRequestOptions,
) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/interval",
        { intervalSeconds },
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

export async function recoverDemoScenario(options?: DemoRequestOptions) {
    const response = await apiClient.post<unknown>(
        "/api/demo/scenario/recover",
        {},
        { headers: demoHeaders(options) },
    );
    return parseDemoResponse(response.data);
}

function invalidDemoResponse(): ApiResponse<DemoStatus> {
    return {
        success: false,
        data: null,
        error: {
            code: "INVALID_RESPONSE",
            message: "시연 제어 응답 형식이 올바르지 않습니다.",
        },
    };
}

function isDemoStatus(value: unknown): value is DemoStatus {
    if (!isRecord(value)) return false;

    return (
        typeof value.enabled === "boolean" &&
        typeof value.mode === "string" &&
        typeof value.autoStart === "boolean" &&
        typeof value.randomize === "boolean" &&
        typeof value.running === "boolean" &&
        typeof value.paused === "boolean" &&
        typeof value.weatherStep === "string" &&
        typeof value.weatherStepIndex === "number" &&
        Array.isArray(value.weatherSteps) &&
        value.weatherSteps.every((item) => typeof item === "string") &&
        Array.isArray(value.manualOverrides) &&
        value.manualOverrides.every((item) => typeof item === "string") &&
        typeof value.targetDrainCode === "string" &&
        typeof value.intervalSeconds === "number" &&
        typeof value.defaultIntervalSeconds === "number" &&
        typeof value.manualDefaultWaterLevelCm === "number" &&
        typeof value.manualDefaultFlowVelocityMps === "number" &&
        Array.isArray(value.rehearsalIntervals) &&
        value.rehearsalIntervals.every((item) => typeof item === "number") &&
        typeof value.lastAction === "string" &&
        (value.lastError === null || typeof value.lastError === "string") &&
        (value.updatedAt === null || typeof value.updatedAt === "string")
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
