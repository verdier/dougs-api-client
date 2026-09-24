import {
    Client,
    DOWNLOAD_BODY_TIMEOUT_MS,
    MAX_DOWNLOAD_BYTES,
    type DownloadedFile,
    type InvoiceEndpoint,
    type InvoiceEndpointParams,
    type InvoiceOperationMatchDTO,
    type VendorInvoiceMatchCandidateDTO,
    type CategoryEndpoint,
    type PartnerDTO,
    type InvestmentEndpoint,
    type InvestmentCreationDTO,
    appendOperationMemoTag,
    type ExpenseCreationDTO,
    type ExpenseReportCreationDTO,
} from "../src";

test("exports the evidence-download and accounting public API", () => {
    const params: InvoiceEndpointParams = { companyId: 42 };
    const file: DownloadedFile = {
        kind: "downloaded-file",
        buffer: Buffer.alloc(0),
        contentType: "application/pdf",
    };
    const endpointMethod: InvoiceEndpoint["downloadPurchaseEvidence"] | undefined = undefined;
    const operationMatch: InvoiceOperationMatchDTO = {
        id: 103, date: "2025-01-01", amount: 1, type: "bank", isInbound: false,
    };
    const sourceDocumentMatch: VendorInvoiceMatchCandidateDTO = {
        sourceDocumentId: 104, date: "2025-01-01", amount: 1, type: "vendorInvoice",
    };
    const categoryMethod: CategoryEndpoint["getAll"] | undefined = undefined;
    const investmentMethod: InvestmentEndpoint["create"] | undefined = undefined;
    const investmentInput: InvestmentCreationDTO = {
        name: "Synthetic asset", categoryId: 101, purchaseAmount: 1, amortizableAmount: 1,
        previouslyAmortizedAmount: 0, purchaseDate: "2025-01-01", saleDate: null,
        amortizationType: "linear", amortizationStartDate: "2025-01-01",
        amortizationYearCount: 5, amortizationRatio: null, isFullyPaid: true,
    };
    const expenseInput: ExpenseCreationDTO = {
        date: "2025-01-01", amount: 1, memo: "Synthetic", businessCategoryId: 101, partnerId: 102,
    };
    const expenseReportInput: ExpenseReportCreationDTO = {
        date: "2025-01-01", memo: "Synthetic", partnerId: 102,
        businessBreakdowns: [{ amount: 1, categoryId: 101 }],
    };
    const partner: PartnerDTO = {
        id: 102, companyId: 42, legalPersonId: null, naturalPersonId: null,
        isCeo: false, isAssociate: true, isEmployee: false, associateIndex: null, affiliateIndex: null,
    };

    expect(Client).toBeDefined();
    expect(params.companyId).toBe(42);
    expect(file.kind).toBe("downloaded-file");
    expect(endpointMethod).toBeUndefined();
    expect(operationMatch.type).toBe("bank");
    expect(sourceDocumentMatch.sourceDocumentId).toBe(104);
    expect(categoryMethod).toBeUndefined();
    expect(investmentMethod).toBeUndefined();
    expect(investmentInput.amortizationType).toBe("linear");
    expect(expenseInput.partnerId).toBe(102);
    expect(expenseReportInput.businessBreakdowns).toHaveLength(1);
    expect(appendOperationMemoTag("Synthetic", "#jarvis")).toBe("Synthetic #jarvis");
    expect(partner.isAssociate).toBe(true);
    expect(MAX_DOWNLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(DOWNLOAD_BODY_TIMEOUT_MS).toBeGreaterThan(0);
});
