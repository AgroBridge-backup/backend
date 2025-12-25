export var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["PENDING"] = "PENDING";
    InvoiceStatus["ISSUED"] = "ISSUED";
    InvoiceStatus["BLOCKCHAIN_PENDING"] = "BLOCKCHAIN_PENDING";
    InvoiceStatus["VERIFIED"] = "VERIFIED";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
    InvoiceStatus["FAILED"] = "FAILED";
})(InvoiceStatus || (InvoiceStatus = {}));
