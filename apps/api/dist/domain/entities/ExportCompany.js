export var ExportCompanyTier;
(function (ExportCompanyTier) {
    ExportCompanyTier["STARTER"] = "STARTER";
    ExportCompanyTier["PROFESSIONAL"] = "PROFESSIONAL";
    ExportCompanyTier["ENTERPRISE"] = "ENTERPRISE";
})(ExportCompanyTier || (ExportCompanyTier = {}));
export var ExportCompanyStatus;
(function (ExportCompanyStatus) {
    ExportCompanyStatus["TRIAL"] = "TRIAL";
    ExportCompanyStatus["ACTIVE"] = "ACTIVE";
    ExportCompanyStatus["SUSPENDED"] = "SUSPENDED";
    ExportCompanyStatus["CANCELLED"] = "CANCELLED";
})(ExportCompanyStatus || (ExportCompanyStatus = {}));
export const TIER_CONFIG = {
    [ExportCompanyTier.STARTER]: {
        monthlyFee: 500,
        certificateFee: 10,
        farmersIncluded: 10,
        certsIncluded: 50,
    },
    [ExportCompanyTier.PROFESSIONAL]: {
        monthlyFee: 1000,
        certificateFee: 8,
        farmersIncluded: 50,
        certsIncluded: 200,
    },
    [ExportCompanyTier.ENTERPRISE]: {
        monthlyFee: 2000,
        certificateFee: 5,
        farmersIncluded: -1,
        certsIncluded: -1,
    },
};
