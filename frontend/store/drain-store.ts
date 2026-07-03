import { create } from "zustand";
import type {
    DrainStatusUpdatedEventDto,
    XgboostResultUpdatedEventDto,
    YoloResultUpdatedEventDto,
} from "@/lib/api/types";
import { URGENT_ALERT_POLICY } from "@/lib/urgent-alert-policy";

export type UrgentDrainAlert = {
    drainId: string;
    facilityName?: string;
    riskLevel: DrainStatusUpdatedEventDto["payload"]["riskLevel"];
    message: string;
    updatedAt: string;
    read: boolean;
};
import type { DrainSocketStatus } from "@/lib/websocket/drain-status-socket";

type DrainStore = {
    selectedDrainId: string | null;
    detailPanelOpen: boolean;
    socketStatus: DrainSocketStatus;
    lastMessageAt: string | null;
    lastError: string | null;
    statusEventsByDrainId: Record<string, DrainStatusUpdatedEventDto>;
    yoloEventsByDrainId: Record<string, YoloResultUpdatedEventDto>;
    xgboostEventsByDrainId: Record<string, XgboostResultUpdatedEventDto>;
    urgentAlerts: UrgentDrainAlert[];
    readUrgentAlerts: UrgentDrainAlert[];
    selectDrain: (id: string | null) => void;
    setDetailPanelOpen: (open: boolean) => void;
    setSocketStatus: (status: DrainSocketStatus) => void;
    markMessageReceived: () => void;
    applyStatusEvent: (event: DrainStatusUpdatedEventDto) => void;
    applyYoloEvent: (event: YoloResultUpdatedEventDto) => void;
    applyXgboostEvent: (event: XgboostResultUpdatedEventDto) => void;
    upsertUrgentAlert: (
        event: DrainStatusUpdatedEventDto,
        facilityName?: string,
    ) => void;
    dismissUrgentAlert: (drainId: string) => void;
    clearUrgentAlerts: () => void;
};

export const useDrainStore = create<DrainStore>((set) => ({
    selectedDrainId: null,
    detailPanelOpen: false,
    socketStatus: "waiting",
    lastMessageAt: null,
    lastError: null,
    statusEventsByDrainId: {},
    yoloEventsByDrainId: {},
    xgboostEventsByDrainId: {},
    urgentAlerts: [],
    readUrgentAlerts: [],
    selectDrain: (selectedDrainId) =>
        set({ selectedDrainId, detailPanelOpen: Boolean(selectedDrainId) }),
    setDetailPanelOpen: (detailPanelOpen) => set({ detailPanelOpen }),
    setSocketStatus: (socketStatus) =>
        set({
            socketStatus,
            lastError:
                socketStatus === "error" ? "실시간 연결에 실패했습니다." : null,
        }),
    markMessageReceived: () => set({ lastMessageAt: new Date().toISOString() }),
    applyStatusEvent: (event) =>
        set((state) => ({
            statusEventsByDrainId: {
                ...state.statusEventsByDrainId,
                [event.payload.drainId]: event,
            },
        })),
    applyYoloEvent: (event) => set((state) => ({ yoloEventsByDrainId: { ...state.yoloEventsByDrainId, [event.payload.drainId]: event } })),
    applyXgboostEvent: (event) => set((state) => ({ xgboostEventsByDrainId: { ...state.xgboostEventsByDrainId, [event.payload.drainId]: event } })),
    upsertUrgentAlert: (event, facilityName) =>
        set((state) => {
            const alert: UrgentDrainAlert = {
                drainId: event.payload.drainId,
                facilityName,
                riskLevel: event.payload.riskLevel,
                message: createUrgentAlertMessage(event),
                updatedAt: event.payload.updatedAt,
                read: false,
            };
            const existingAlert = state.urgentAlerts.find(
                (item) => item.drainId === alert.drainId,
            );

            if (existingAlert) {
                return {
                    urgentAlerts: [
                        alert,
                        ...state.urgentAlerts.filter(
                            (item) => item.drainId !== alert.drainId,
                        ),
                    ].slice(0, URGENT_ALERT_POLICY.maxVisibleAlerts),
                    readUrgentAlerts: state.readUrgentAlerts.filter(
                        (item) => item.drainId !== alert.drainId,
                    ),
                };
            }

            return {
                urgentAlerts: [alert, ...state.urgentAlerts].slice(
                    0,
                    URGENT_ALERT_POLICY.maxVisibleAlerts,
                ),
                readUrgentAlerts: state.readUrgentAlerts.filter(
                    (item) => item.drainId !== alert.drainId,
                ),
            };
        }),
    dismissUrgentAlert: (drainId) =>
        set((state) => {
            const dismissedAlert = state.urgentAlerts.find(
                (alert) => alert.drainId === drainId,
            );
            return {
                urgentAlerts: state.urgentAlerts.filter(
                    (alert) => alert.drainId !== drainId,
                ),
                readUrgentAlerts: dismissedAlert
                    ? upsertReadAlert(state.readUrgentAlerts, dismissedAlert)
                    : state.readUrgentAlerts,
            };
        }),
    clearUrgentAlerts: () =>
        set((state) => ({
            urgentAlerts: [],
            readUrgentAlerts: state.urgentAlerts.reduce(
                (items, alert) => upsertReadAlert(items, alert),
                state.readUrgentAlerts,
            ),
        })),
}));

function upsertReadAlert(
    readAlerts: UrgentDrainAlert[],
    alert: UrgentDrainAlert,
) {
    return [
        { ...alert, read: true },
        ...readAlerts.filter((item) => item.drainId !== alert.drainId),
    ].slice(0, 10);
}

function createUrgentAlertMessage(event: DrainStatusUpdatedEventDto) {
    const { drainId, riskLevel, waterLevelCm, obstructionRatio } = event.payload;
    if (riskLevel === "unknown") {
        return `${drainId}의 영상 분석 상태를 확인할 수 없습니다. 센서값을 함께 확인하세요.`;
    }

    const details = [
        typeof waterLevelCm === "number" ? `수위 ${waterLevelCm.toFixed(1)}cm` : null,
        typeof obstructionRatio === "number" ? `막힘률 ${Math.round(obstructionRatio * 100)}%` : null,
    ].filter(Boolean);

    return details.length > 0
        ? `${drainId}이 위험 상태입니다. ${details.join(", ")}`
        : `${drainId}이 위험 상태입니다. 즉시 현장 확인이 필요합니다.`;
}
