import { Client, type DownloadedFile } from '../client';
import { VENDOR_INVOICE_ATTACH_UNVERIFIED_POST } from '../mutation-errors';
import {
    assertPositiveSafeInteger,
    assertUuid,
    isBoundedSafeInteger,
    isMoneyAmount,
    normalizeIsoDateOrUtcDateTime,
    isPositiveSafeInteger,
    isRecord,
    isTrimmedNonBlankText,
    MAX_LIST_LIMIT,
    MAX_LIST_PAGE,
} from './validation';

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

/**
 * Minimal operation identity used for an invoice match or provider suggestion.
 * It intentionally excludes wording, metadata, search indexes and transaction
 * internals, which are neither needed to review nor to attach a match.
 */
export interface InvoiceOperationMatchDTO {
    id: number;
    date: string;
    amount: number;
    type: string;
    isInbound: boolean;
}

const MAX_OPERATION_MATCH_TYPE_LENGTH = 100;

function mapInvoiceOperationMatch(raw: unknown): InvoiceOperationMatchDTO {
    const date = isRecord(raw) ? normalizeIsoDateOrUtcDateTime(raw.date) : null;
    if (!isRecord(raw)
        || !isPositiveSafeInteger(raw.id)
        || date === null
        || !isMoneyAmount(raw.amount, true)
        || !isTrimmedNonBlankText(raw.type, MAX_OPERATION_MATCH_TYPE_LENGTH)
        || typeof raw.isInbound !== 'boolean') {
        throw new Error("Invoice operation match was incomplete.");
    }
    return {
        id: raw.id,
        // The curated DTO deliberately exposes calendar dates, not timestamps.
        date,
        amount: raw.amount,
        type: raw.type,
        isInbound: raw.isInbound,
    };
}

/**
 * Maps a provider suggestion only after verifying both its opaque wrapper ID
 * and the suggested operation's company scope. The wrapper is not useful to
 * consumers, so only the common minimal operation reference is exposed.
 */
function mapInvoiceOperationCandidate(
    raw: unknown,
    companyId: number,
): InvoiceOperationMatchDTO | null {
    if (raw === null) return null;
    if (!isRecord(raw)) {
        throw new Error("Invoice operation candidate was incomplete or out of scope.");
    }
    const operation = raw.operation;
    if (!isPositiveSafeInteger(raw.id)
        || !isRecord(operation)
        || operation.companyId !== companyId) {
        throw new Error("Invoice operation candidate was incomplete or out of scope.");
    }
    return mapInvoiceOperationMatch(operation);
}

// ---------------------------------------------------------------------------
// Sales invoices  (GET /companies/:id/sales-invoices)
// ---------------------------------------------------------------------------

/**
 * Client data embedded in a sales invoice.
 */
export interface SalesInvoiceClientData {
    clientId: string;
    name: string;
    email: string;
    siren: string;
}

/**
 * Sales invoice DTO — as returned by `GET /companies/:id/sales-invoices[/:id]`.
 *
 * Fields returned by the Dougs API.
 */
export interface SalesInvoiceDTO {
    id: string;
    label: string | null;
    fileId: number | null;
    fileName: string | null;
    filePath: string | null;
    fileType: string | null;
    ownerId: string;
    date: string;
    source: string;
    prefillStatus: string;
    clientName: string | null;
    clientId: string | null;
    reference: string | null;
    amount: number;
    vatAmount: number | null;
    isRefund: boolean;
    paidAt: string | null;
    dueDate: string | null;
    isLate: boolean;
    currency: string;
    createdAt: string;
    updatedAt: string;
    paymentStatus: string;
    netAmount: number | null;
    isDraft: boolean;
    companyId: number;
    sourceDocumentId: number | null;
    operationAttachments: unknown[];
    accrualOperationAttachment: unknown | null;
    operationCandidate: InvoiceOperationMatchDTO | null;
    clientData: SalesInvoiceClientData | null;
    quote: unknown | null;
    mailRequests: unknown[];
    latestMailRequest: unknown | null;
}

/**
 * Query parameters for listing sales invoices.
 */
export interface SalesInvoiceQuery {
    page?: number;
    limit?: number;
}

// ---------------------------------------------------------------------------
// Vendor (purchase) invoices  (GET /companies/:id/vendor-invoices)
// ---------------------------------------------------------------------------

/**
 * Vendor invoice DTO — as returned by `GET /companies/:id/vendor-invoices[/:id]`.
 *
 * Fields returned by the Dougs API.
 */
export interface VendorInvoiceDTO {
    id: string;
    createdAt: string;
    updatedAt: string;
    fileName: string | null;
    ownerId: string;
    memo: string | null;
    paymentStatus: string;
    prefillStatus: string;
    amount: number | null;
    isLocked: boolean;
    fileId: number | null;
    filePath: string | null;
    fileType: string | null;
    label: string | null;
    supplierName: string | null;
    supplierCountry: string | null;
    clientName: string | null;
    clientCountry: string | null;
    amountTva: number | null;
    currency: string | null;
    isRefund: boolean;
    type: string | null;
    reference: string | null;
    transactionType: string | null;
    date: string | null;
    companyId: number;
    sourceDocumentId: number | null;
    operationAttachments: unknown[];
    accrualOperationAttachment: unknown | null;
    operationCandidate: InvoiceOperationMatchDTO | null;
    operations: unknown[];
    matchedOperation: InvoiceOperationMatchDTO | null;
}

/**
 * Query parameters for listing vendor invoices.
 */
export interface VendorInvoiceQuery {
    page?: number;
    limit?: number;
}

type RawSalesInvoiceDTO = Omit<SalesInvoiceDTO, 'operationCandidate'> & {
    operationCandidate: unknown;
};
type RawVendorInvoiceDTO = Omit<VendorInvoiceDTO, 'operationCandidate' | 'matchedOperation'> & {
    operationCandidate: unknown;
    matchedOperation: unknown;
};

function assertInvoiceScope(raw: unknown, companyId: number): asserts raw is Record<string, unknown> {
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.companyId !== companyId) {
        throw new Error("Invoice response was incomplete or out of scope.");
    }
}

function mapSalesInvoice(raw: unknown, companyId: number): SalesInvoiceDTO {
    assertInvoiceScope(raw, companyId);
    return {
        ...(raw as RawSalesInvoiceDTO),
        operationCandidate: mapInvoiceOperationCandidate(raw.operationCandidate, companyId),
    };
}

function mapVendorInvoice(raw: unknown, companyId: number): VendorInvoiceDTO {
    assertInvoiceScope(raw, companyId);
    return {
        ...(raw as RawVendorInvoiceDTO),
        operationCandidate: mapInvoiceOperationCandidate(raw.operationCandidate, companyId),
        matchedOperation: raw.matchedOperation === null
            ? null
            : mapInvoiceOperationMatch(raw.matchedOperation),
    };
}

function mapInvoiceList<DTO>(
    raw: unknown,
    map: (invoice: unknown) => DTO,
): DTO[] {
    if (!Array.isArray(raw) || raw.length > MAX_LIST_LIMIT) {
        throw new Error("Invoice list was incomplete.");
    }
    return raw.map(map);
}

function normalizeInvoiceListQuery(
    query: SalesInvoiceQuery | VendorInvoiceQuery | undefined,
): SalesInvoiceQuery | undefined {
    if (query === undefined) return undefined;
    if (!isRecord(query) || Object.keys(query).some(key => key !== 'page' && key !== 'limit')) {
        throw new Error("Invalid invoice list query.");
    }
    const rawQuery = query as unknown as Record<string, unknown>;
    const normalized: SalesInvoiceQuery = {};
    if (rawQuery.page !== undefined) {
        if (!isBoundedSafeInteger(rawQuery.page, 1, MAX_LIST_PAGE)) {
            throw new Error("Invalid invoice list query.");
        }
        normalized.page = rawQuery.page;
    }
    if (rawQuery.limit !== undefined) {
        if (!isBoundedSafeInteger(rawQuery.limit, 1, MAX_LIST_LIMIT)) {
            throw new Error("Invalid invoice list query.");
        }
        normalized.limit = rawQuery.limit;
    }
    return normalized;
}

function assertScopedVendorInvoice(
    raw: unknown,
    companyId: number,
    vendorInvoiceId: string,
): VendorInvoiceDTO {
    if (!isRecord(raw)
        || typeof raw.id !== 'string'
        || raw.id.toLowerCase() !== vendorInvoiceId.toLowerCase()
        || raw.companyId !== companyId
        || !Array.isArray(raw.operations)) {
        throw new Error("Vendor invoice preflight was incomplete.");
    }
    const operationIds = new Set<number>();
    for (const operation of raw.operations) {
        if (!isRecord(operation) || !isPositiveSafeInteger(operation.id) || operationIds.has(operation.id)) {
            throw new Error("Vendor invoice preflight was incomplete.");
        }
        operationIds.add(operation.id);
    }
    return raw as unknown as VendorInvoiceDTO;
}

function hasVerifiedOperationLink(invoice: VendorInvoiceDTO, operationId: number): boolean {
    return invoice.operations.some(operation => isRecord(operation) && operation.id === operationId);
}

function assertAttachableOperation(raw: unknown, companyId: number, operationId: number): void {
    if (!isRecord(raw)
        || raw.id !== operationId
        || raw.companyId !== companyId
        // Missing or truthy eligibility flags are unsafe: never attach unless
        // the provider detail record explicitly confirms each is false.
        || raw.deleted !== false
        || raw.excluded !== false
        || raw.isDraft !== false) {
        throw new Error("Operation preflight was incomplete or not attachable.");
    }
}

// ---------------------------------------------------------------------------
// Endpoint factory
// ---------------------------------------------------------------------------

export interface InvoiceEndpointParams {
    companyId: number;
}

/**
 * Sales & purchase (vendor) invoices.
 * @mountPath invoices
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface InvoiceEndpoint {
    /** List all sales invoices (factures de vente) for the company. */
    listSales(query?: SalesInvoiceQuery): Promise<SalesInvoiceDTO[]>;
    /** Get a single sales invoice by UUID. */
    getSale(id: string): Promise<SalesInvoiceDTO>;
    /** List all purchase/vendor invoices (factures d'achat) for the company. */
    listPurchases(query?: VendorInvoiceQuery): Promise<VendorInvoiceDTO[]>;
    /** Get a single purchase/vendor invoice by UUID. */
    getPurchase(id: string): Promise<VendorInvoiceDTO>;
    /** Download the evidence file attached to a purchase/vendor invoice. */
    downloadPurchaseEvidence(id: string): Promise<DownloadedFile>;
    /** Attach one existing operation to one vendor invoice. The response is intentionally not exposed. */
    attachOperation(vendorInvoiceId: string, operationId: number): Promise<void>;
}

export const makeInvoiceEndpoint = (
    client: Client,
    { companyId }: InvoiceEndpointParams,
): InvoiceEndpoint => {
    assertPositiveSafeInteger(companyId);
    const base = `/companies/${companyId}`;
    const invoicePath = (collection: 'sales-invoices' | 'vendor-invoices', id: string) => {
        assertUuid(id);
        return `${base}/${collection}/${encodeURIComponent(id)}`;
    };
    const getPurchaseRaw = (id: string) => client.get<unknown>(invoicePath('vendor-invoices', id));
    const getPurchase = (id: string) => getPurchaseRaw(id).then(raw => mapVendorInvoice(raw, companyId));
    return {
        listSales: (query?) =>
            client.get<unknown>(`${base}/sales-invoices`, normalizeInvoiceListQuery(query))
                .then(raw => mapInvoiceList(raw, invoice => mapSalesInvoice(invoice, companyId))),
        getSale: (id) =>
            client.get<unknown>(invoicePath('sales-invoices', id))
                .then(raw => mapSalesInvoice(raw, companyId)),
        listPurchases: (query?) =>
            client.get<unknown>(`${base}/vendor-invoices`, normalizeInvoiceListQuery(query))
                .then(raw => mapInvoiceList(raw, invoice => mapVendorInvoice(invoice, companyId))),
        getPurchase,
        downloadPurchaseEvidence: async (id) => {
            // Evidence download returns no invoice DTO, so do not make a
            // malformed unrelated candidate block access to its own file.
            const invoice = await getPurchaseRaw(id);
            if (!isRecord(invoice) || typeof invoice.filePath !== 'string' || invoice.filePath.trim().length === 0) {
                throw new Error("Purchase invoice has no downloadable evidence file.");
            }
            return client.downloadFile(invoice.filePath);
        },
        attachOperation: async (vendorInvoiceId, operationId) => {
            assertUuid(vendorInvoiceId);
            assertPositiveSafeInteger(operationId);
            const [invoiceRaw, operationRaw] = await Promise.all([
                getPurchaseRaw(vendorInvoiceId),
                client.get<unknown>(`/companies/${companyId}/operations/${operationId}`),
            ]);
            const invoice = assertScopedVendorInvoice(invoiceRaw, companyId, vendorInvoiceId);
            assertAttachableOperation(operationRaw, companyId, operationId);
            // Do not re-submit an already linked pair: provider idempotency is unproven.
            if (hasVerifiedOperationLink(invoice, operationId)) return;

            await client.postVoid(
                `${invoicePath('vendor-invoices', vendorInvoiceId)}/actions/attach-operations`,
                { operationIds: [operationId] },
            );

            try {
                const after = assertScopedVendorInvoice(await getPurchaseRaw(vendorInvoiceId), companyId, vendorInvoiceId);
                if (!hasVerifiedOperationLink(after, operationId)) {
                    throw new Error(VENDOR_INVOICE_ATTACH_UNVERIFIED_POST);
                }
            } catch {
                // The POST may already have attached the operation. Do not expose
                // provider details or encourage an unsafe retry when its result
                // cannot be confirmed from the curated invoice linkage field.
                throw new Error(VENDOR_INVOICE_ATTACH_UNVERIFIED_POST);
            }
        },
    };
};
