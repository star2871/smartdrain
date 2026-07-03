"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    dashboardSummaryFromDrains,
    mergeDrainStatusEventIntoFacility,
    mergeYoloEventIntoFacility,
} from "@/lib/api/adapters";
import { drainQueryKeys } from "@/lib/query/drain-query-keys";
import { useDrainsQuery } from "@/lib/query/drain-queries";
import type { DrainFacility } from "@/lib/mock-data";
import { useDrainStore } from "@/store/drain-store";
import { useDrainStatusSocket } from "@/lib/websocket/drain-status-socket";
import { isUrgentRiskLevel } from "@/lib/urgent-alert-policy";

export function RealtimeDrainSync() {
    const queryClient = useQueryClient();
    const { isSuccess } = useDrainsQuery();
    const storeStatusEvent = useDrainStore((state) => state.applyStatusEvent);
    const storeYoloEvent = useDrainStore((state) => state.applyYoloEvent);
    const applyXgboostEvent = useDrainStore((state) => state.applyXgboostEvent);
    const setSocketStatus = useDrainStore((state) => state.setSocketStatus);
    const markMessageReceived = useDrainStore((state) => state.markMessageReceived);
    const upsertUrgentAlert = useDrainStore((state) => state.upsertUrgentAlert);

    const applyStatusEvent = useCallback((event: Parameters<typeof mergeDrainStatusEventIntoFacility>[1]) => {
        const drains = queryClient.getQueryData<DrainFacility[]>(drainQueryKeys.all);
        const facilityName = drains?.find(
            (drain) => drain.id === event.payload.drainId,
        )?.road;

        let nextDrains: DrainFacility[] | undefined;
        queryClient.setQueryData<DrainFacility[]>(drainQueryKeys.all, (drains) => {
            nextDrains = drains?.map((drain) =>
                mergeDrainStatusEventIntoFacility(drain, event),
            );
            return nextDrains;
        });
        if (nextDrains) {
            queryClient.setQueryData(
                drainQueryKeys.summary,
                dashboardSummaryFromDrains(nextDrains),
            );
        }
        const detailKey = drainQueryKeys.detail(event.payload.drainId);
        if (queryClient.getQueryData(detailKey)) {
            queryClient.setQueryData(detailKey, (detail: { drain: DrainFacility } | null | undefined) =>
                detail ? { ...detail, drain: mergeDrainStatusEventIntoFacility(detail.drain, event) } : detail,
            );
        }
        if (isUrgentRiskLevel(event.payload.riskLevel)) {
            upsertUrgentAlert(event, facilityName);
        }
        storeStatusEvent(event);
        markMessageReceived();
    }, [markMessageReceived, queryClient, storeStatusEvent, upsertUrgentAlert]);

    const applyYoloEvent = useCallback((event: Parameters<typeof mergeYoloEventIntoFacility>[1]) => {
        queryClient.setQueryData<DrainFacility[]>(drainQueryKeys.all, (drains) =>
            drains?.map((drain) => mergeYoloEventIntoFacility(drain, event)),
        );
        storeYoloEvent(event);
        markMessageReceived();
    }, [markMessageReceived, queryClient, storeYoloEvent]);

    const handleConnected = useCallback((reconnected: boolean) => {
        if (!reconnected) return;
        void queryClient.invalidateQueries({ queryKey: drainQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: drainQueryKeys.summary });
        const selectedDrainId = useDrainStore.getState().selectedDrainId;
        if (useDrainStore.getState().detailPanelOpen && selectedDrainId) {
            void queryClient.invalidateQueries({ queryKey: drainQueryKeys.detail(selectedDrainId) });
        }
    }, [queryClient]);
    const socketStatus = useDrainStatusSocket({
        enabled: isSuccess,
        onStatusUpdated: applyStatusEvent,
        onYoloUpdated: applyYoloEvent,
        onXgboostUpdated: applyXgboostEvent,
        onConnected: handleConnected,
    });

    useEffect(() => {
        setSocketStatus(socketStatus);
    }, [setSocketStatus, socketStatus]);

    return null;
}
