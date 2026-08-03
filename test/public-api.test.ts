import {
    Client,
    DOWNLOAD_BODY_TIMEOUT_MS,
    MAX_DOWNLOAD_BYTES,
    type DownloadedFile,
    type InvoiceEndpoint,
    type InvoiceEndpointParams,
} from "../src";

test("exports the evidence-download public API", () => {
    const params: InvoiceEndpointParams = { companyId: 42 };
    const file: DownloadedFile = {
        kind: "downloaded-file",
        buffer: Buffer.alloc(0),
        contentType: "application/pdf",
    };
    const endpointMethod: InvoiceEndpoint["downloadPurchaseEvidence"] | undefined = undefined;

    expect(Client).toBeDefined();
    expect(params.companyId).toBe(42);
    expect(file.kind).toBe("downloaded-file");
    expect(endpointMethod).toBeUndefined();
    expect(MAX_DOWNLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(DOWNLOAD_BODY_TIMEOUT_MS).toBeGreaterThan(0);
});
