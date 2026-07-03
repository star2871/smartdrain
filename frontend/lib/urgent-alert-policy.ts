import type { RiskLevel } from "@/lib/risk";

export const URGENT_ALERT_POLICY = {
    triggerRiskLevels: ["danger", "unknown"] as RiskLevel[],
    maxVisibleAlerts: 20,
    deduplication: "merge-by-drain-id",
} as const;

export function isUrgentRiskLevel(riskLevel: RiskLevel) {
    return URGENT_ALERT_POLICY.triggerRiskLevels.includes(riskLevel);
}
