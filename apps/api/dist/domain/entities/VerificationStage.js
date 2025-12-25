export var StageType;
(function (StageType) {
    StageType["HARVEST"] = "HARVEST";
    StageType["PACKING"] = "PACKING";
    StageType["COLD_CHAIN"] = "COLD_CHAIN";
    StageType["EXPORT"] = "EXPORT";
    StageType["DELIVERY"] = "DELIVERY";
})(StageType || (StageType = {}));
export var StageStatus;
(function (StageStatus) {
    StageStatus["PENDING"] = "PENDING";
    StageStatus["APPROVED"] = "APPROVED";
    StageStatus["REJECTED"] = "REJECTED";
    StageStatus["FLAGGED"] = "FLAGGED";
})(StageStatus || (StageStatus = {}));
export const STAGE_ORDER = [
    StageType.HARVEST,
    StageType.PACKING,
    StageType.COLD_CHAIN,
    StageType.EXPORT,
    StageType.DELIVERY,
];
export function getStageIndex(stageType) {
    return STAGE_ORDER.indexOf(stageType);
}
export function isValidStageTransition(currentStage, nextStage) {
    if (currentStage === null) {
        return nextStage === StageType.HARVEST;
    }
    const currentIndex = getStageIndex(currentStage);
    const nextIndex = getStageIndex(nextStage);
    return nextIndex === currentIndex + 1;
}
export const VALID_STATUS_TRANSITIONS = {
    [StageStatus.PENDING]: [StageStatus.APPROVED, StageStatus.REJECTED, StageStatus.FLAGGED],
    [StageStatus.APPROVED]: [],
    [StageStatus.REJECTED]: [StageStatus.PENDING],
    [StageStatus.FLAGGED]: [StageStatus.APPROVED, StageStatus.REJECTED],
};
export function isValidStatusTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) {
        return true;
    }
    return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}
