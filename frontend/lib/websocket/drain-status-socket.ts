"use client";

import { useEffect, useRef, useState } from "react";
import type {
    DrainRealtimeEventDto,
    DrainStatusUpdatedEventDto,
    XgboostResultUpdatedEventDto,
    YoloResultUpdatedEventDto,
} from "@/lib/api/types";
import type { RiskLevel } from "@/lib/risk";

export type DrainSocketStatus =
    | "waiting"
    | "connected"
    | "reconnecting"
    | "error";

const DRAIN_STATUS_SOCKET_PATH = "/ws/drains/status";
const RECONNECT_DELAY_MS = 3000;

export function useDrainStatusSocket({
    enabled,
    onStatusUpdated,
    onYoloUpdated,
    onXgboostUpdated,
    onConnected,
}: {
    enabled: boolean;
    onStatusUpdated: (event: DrainStatusUpdatedEventDto) => void;
    onYoloUpdated?: (event: YoloResultUpdatedEventDto) => void;
    onXgboostUpdated?: (event: XgboostResultUpdatedEventDto) => void;
    onConnected?: (reconnected: boolean) => void;
}) {
    const [status, setStatus] = useState<DrainSocketStatus>("waiting");
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const reconnectingRef = useRef(false);
    const socketUrl = enabled ? getDrainStatusSocketUrl() : null;

    useEffect(() => {
        if (!socketUrl) {
            return;
        }

        let socket: WebSocket | null = null;
        let disposed = false;

        const clearReconnectTimer = () => {
            if (!reconnectTimerRef.current) return;
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        };

        const connect = () => {
            socket = new WebSocket(socketUrl);
            setStatus(reconnectingRef.current ? "reconnecting" : "waiting");

            socket.onopen = () => {
                const reconnected = reconnectingRef.current;
                reconnectingRef.current = false;
                setStatus("connected");
                onConnected?.(reconnected);
            };

            socket.onmessage = (message) => {
                const event = parseDrainRealtimeEvent(message.data);
                if (!event) return;
                if (event.type === "DRAIN_STATUS_UPDATED") {
                    onStatusUpdated(event);
                    return;
                }
                if (event.type === "YOLO_RESULT_UPDATED") {
                    onYoloUpdated?.(event);
                    return;
                }
                if (event.type === "XGBOOST_RESULT_UPDATED") {
                    onXgboostUpdated?.(event);
                }
            };

            socket.onerror = () => {
                setStatus("error");
            };

            socket.onclose = () => {
                if (disposed) return;
                reconnectingRef.current = true;
                setStatus("reconnecting");
                clearReconnectTimer();
                reconnectTimerRef.current = setTimeout(
                    connect,
                    RECONNECT_DELAY_MS,
                );
            };
        };

        connect();

        return () => {
            disposed = true;
            reconnectingRef.current = false;
            clearReconnectTimer();
            socket?.close();
        };
    }, [socketUrl, onStatusUpdated, onYoloUpdated, onXgboostUpdated, onConnected]);

    if (!enabled) return "waiting";
    if (!socketUrl) return "error";
    return status;
}

function parseDrainRealtimeEvent(data: string): DrainRealtimeEventDto | null {
    try {
        const parsed: unknown = JSON.parse(data);
        if (!isRecord(parsed) || !isRecord(parsed.payload)) return null;

        const { payload } = parsed;
        if (!isNonEmptyString(payload.drainId)) return null;

        if (parsed.type === "DRAIN_STATUS_UPDATED") {
            if (
                !isNonEmptyString(payload.updatedAt) ||
                !isRiskLevel(payload.riskLevel)
            ) {
                return null;
            }

            return parsed as DrainStatusUpdatedEventDto;
        }

        if (parsed.type === "YOLO_RESULT_UPDATED") {
            if (
                !isNonEmptyString(payload.updatedAt) ||
                !isNonEmptyString(payload.analyzedAt) ||
                !isYoloStatus(payload.yoloStatus)
            ) {
                return null;
            }

            return parsed as YoloResultUpdatedEventDto;
        }

        if (parsed.type === "XGBOOST_RESULT_UPDATED") {
            if (
                !isNonEmptyString(payload.updatedAt) ||
                !isNonEmptyString(payload.evaluatedAt) ||
                !isRiskLevel(payload.riskLevel)
            ) {
                return null;
            }

            return parsed as XgboostResultUpdatedEventDto;
        }

        return null;
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isRiskLevel(value: unknown): value is RiskLevel {
    return (
        value === "good" ||
        value === "caution" ||
        value === "danger" ||
        value === "unknown"
    );
}

function isYoloStatus(value: unknown) {
    return (
        value === "clear" ||
        value === "partially_blocked" ||
        value === "blocked" ||
        value === "unknown"
    );
}

function getDrainStatusSocketUrl() {
    const explicitUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (explicitUrl) return toDrainStatusSocketUrl(explicitUrl);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBaseUrl === undefined) return null;

    return toDrainStatusSocketUrl(apiBaseUrl);
}

function toDrainStatusSocketUrl(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue.startsWith("/")) {
        return getSameOriginDrainStatusSocketUrl();
    }

    try {
        const url = new URL(trimmedValue);
        if (url.protocol === "http:") {
            url.protocol = "ws:";
        } else if (url.protocol === "https:") {
            url.protocol = "wss:";
        } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
            return null;
        }

        url.pathname = DRAIN_STATUS_SOCKET_PATH;
        url.search = "";
        url.hash = "";
        return url.href;
    } catch {
        return null;
    }
}

function getSameOriginDrainStatusSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${DRAIN_STATUS_SOCKET_PATH}`;
}
