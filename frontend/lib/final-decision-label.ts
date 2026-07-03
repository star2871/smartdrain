const FINAL_DECISION_LABELS: Record<string, string> = {
    normal: "정상 모니터링",
    field_check: "현장 확인 필요",
    dispatch_required: "긴급 출동 필요",
    monitoring: "추가 관찰 필요",
    unknown: "판단 보류",
};

export function formatFinalDecisionLabel(value?: string | null) {
    if (!value) return "-";
    return FINAL_DECISION_LABELS[value] ?? value;
}
