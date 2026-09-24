import { Client, type DownloadedFile } from '../client';
import {
    BREAKDOWN_MUTATION_UNVERIFIED_POST,
    EXPENSE_REPORT_UNVERIFIED_POST,
    KILOMETRIC_UNVERIFIED_POST,
} from '../mutation-errors';
import { mapOperation, mapOperations, type RawOperationDTO } from './operation.map';
import {
    parseContextualCategoryIds,
    type ContextualCategoryIds,
} from './categories.map';
import {
    assertPositiveSafeInteger,
    isBoundedSafeInteger,
    isIsoDate,
    isMoneyAmount,
    isPositiveSafeInteger,
    isRecord,
    isTrimmedNonBlankText,
    MAX_ACCOUNTING_MEMO_LENGTH,
    MAX_KILOMETRIC_DISTANCE,
    MAX_LIST_LIMIT,
    MAX_LIST_OFFSET,
    MAX_PREFLIGHT_RESULTS,
    MAX_SEARCH_LENGTH,
    sameMoney,
    toMinorUnits,
    trimText,
} from './validation';

/**
 * Operation types.
 * Multiple types can apply to a single operation.
 */
export type OperationType =
    | 'bank'
    | 'customerCreditNote'
    | 'supplierCreditNote'
    | 'expense'
    | 'invoice'
    | 'clientInvoice'
    | 'vendorInvoice'
    | 'invoiceSupplier'
    | 'invoiceCustomer'
    | 'kilometricIndemnity'
    | 'cashPayment'
    | 'cashExpense'
    | 'miscellaneous'
    | 'customerEditableMiscellaneous'
    | 'accountingSurveyMiscellaneous'
    | 'dispatch'
    | 'reconciliation'
    | 'cashRegisterDispatch'
    | 'cashRegisterFee';

/** Source document attachment DTO. */
export interface SourceDocumentAttachmentDTO {
    id: number;
    url: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    createdAt?: string;
}

/** Generic association values safe to expose with a breakdown. */
export interface BreakdownAssociationDataDTO {
    partnerId?: number;
    carId?: number;
    kilometers?: number;
    isInvestment?: boolean;
}

/** Safe association slot metadata used to discover candidate routes. */
export interface BreakdownAssociationSlotDTO {
    name: string;
    type: 'boolean' | 'record' | 'enum' | 'integer';
    isAssignable: boolean;
}

/** Curated breakdown association metadata. Provider selected-item blobs are omitted. */
export interface BreakdownAssociationDTO {
    name: string;
    slots: BreakdownAssociationSlotDTO[];
}

export interface BreakdownAssociationCandidateDTO {
    value: string | number;
    label?: string;
    description?: string;
}

export interface BreakdownAssociationCandidatesDTO {
    descriptor: { fallbackToCreation?: boolean; askForSaleDate?: boolean };
    items: BreakdownAssociationCandidateDTO[];
    preferredItems: BreakdownAssociationCandidateDTO[];
}

export interface BreakdownAssociationCandidatesQuery {
    offset: number;
    search?: string;
    limit?: number;
}

/** Breakdown for an operation. */
export interface BreakdownDTO {
    id: number;
    amount: number;
    wording?: string;
    isInbound: boolean;
    isCounterpart: boolean;
    associationData?: BreakdownAssociationDataDTO;
    associations?: BreakdownAssociationDTO[];
    hasVat: boolean;
    vatAmount?: number;
    vatRate?: number;
    category: {
        id: number;
        wording: string;
        group?: {
            id: number;
            name: string;
        };
    };
}

/**
 * Curated vendor-invoice suggestion found from an operation source document.
 * Provider file data, external references and OCR/internal metadata are never
 * exposed. Direction remains on the enclosing operation.
 */
export interface VendorInvoiceMatchCandidateDTO {
    sourceDocumentId: number;
    date: string;
    amount: number;
    type: string;
}

/** Curated operation DTO. Internal OCR/candidate metadata is never exposed. */
export interface OperationDTO {
    id: number;
    date: string;
    amount: number;
    totalAmount?: number;
    wording?: string;
    name?: string;
    memo?: string;
    description?: string;
    validatedAt?: string | null;
    message?: string | null;
    errors?: string[];
    type: string;
    types: OperationType[];
    isInbound: boolean;
    hasVat: boolean;
    vatAmount?: number | null;
    vatRate?: number | null;
    creatorId?: number;
    createdAt?: string;
    updatedAt?: string;
    breakdowns?: BreakdownDTO[];
    sourceDocumentAttachments?: SourceDocumentAttachmentDTO[];
    /** Omitted when the provider suggestion is malformed or unavailable. */
    sourceDocumentCandidate?: VendorInvoiceMatchCandidateDTO | null;
}

/** Query parameters for filtering operations. */
export interface OperationQuery {
    limit?: number;
    offset?: number;
    validated?: boolean;
    q?: string;
    "q-amount"?: string;
    "q-date"?: string;
    "q-isInbound"?: boolean;
}

/** Data required to create a Kilometric Indemnity. */
export interface KilometricIndemnityCreationDTO {
    date: string;
    distance: number;
    memo?: string;
    carId?: number;
}

/** Explicit data for a personally-paid generic expense. */
export interface ExpenseCreationDTO {
    date: string;
    amount: number;
    memo: string;
    businessCategoryId: number;
    partnerId: number;
}

/** One business allocation of a personally-paid expense report. */
export interface ExpenseReportBusinessBreakdownDTO {
    amount: number;
    categoryId: number;
}

/** Explicit multi-line personally-paid expense report; total is derived in cents. */
export interface ExpenseReportCreationDTO {
    date: string;
    memo: string;
    partnerId: number;
    businessBreakdowns: ExpenseReportBusinessBreakdownDTO[];
}

/** Optional contextual filters for categories valid on one existing breakdown. */
export interface AvailableCategoriesQuery {
    /** Sent only for refund categories, matching the provider frontend. */
    isRefund?: boolean;
    search?: string;
}

/** Version token from the exact final GET before a one-shot line mutation. */
export interface BreakdownMutationExpectation {
    expectedUpdatedAt: string;
}

export interface BreakdownAmountMutation extends BreakdownMutationExpectation {
    amount: number;
    expectedTotalAmount: number;
    expectedIsTotalAmountValid: boolean;
}

export interface BreakdownRemovalMutation extends BreakdownMutationExpectation {
    expectedTotalAmount: number;
    expectedIsTotalAmountValid: boolean;
}

export interface OperationEndpointParams {
    companyId: number;
}

/** Manage accounting operations. */
export interface OperationEndpoint {
    getAll(query?: OperationQuery): Promise<OperationDTO[]>;
    /** Retrieve a provider detail record by ID without list-state filtering. */
    getOne(id: number): Promise<OperationDTO>;
    getAvailableCategories(
        operationId: number,
        breakdownId: number,
        query?: AvailableCategoriesQuery,
    ): Promise<ContextualCategoryIds>;
    /** Read candidates through server-discovered association and slot names. */
    getBreakdownAssociationCandidates(
        operationId: number,
        breakdownId: number,
        associationName: string,
        slotName: string,
        query: BreakdownAssociationCandidatesQuery,
    ): Promise<BreakdownAssociationCandidatesDTO>;
    downloadSourceDocumentAttachment(operationId: number, attachmentId: number): Promise<DownloadedFile>;
    delete(id: number): Promise<void>;
    createKilometricIndemnity(data: KilometricIndemnityCreationDTO): Promise<OperationDTO>;
    /** Creates a personally-paid expense report with 1–20 business allocations. */
    createExpenseReport(data: ExpenseReportCreationDTO): Promise<OperationDTO>;
    /** Convenience wrapper for a one-line expense report. */
    createExpense(data: ExpenseCreationDTO): Promise<OperationDTO>;
    /** Append exactly the provider UI's zero-residual uncategorized detail. */
    addBreakdownDetail(operationId: number, expectation: BreakdownMutationExpectation): Promise<OperationDTO>;
    /** Set one existing business line's category after a contextual category preflight. */
    setBreakdownCategory(operationId: number, breakdownId: number, categoryId: number, expectation: BreakdownMutationExpectation): Promise<OperationDTO>;
    /** Set one existing business line amount; this may intentionally leave the operation unbalanced. */
    setBreakdownAmount(operationId: number, breakdownId: number, mutation: BreakdownAmountMutation): Promise<OperationDTO>;
    /** Set the live-proven boolean associationData.isInvestment flag only. */
    setBreakdownIsInvestment(operationId: number, breakdownId: number, value: boolean, expectation: BreakdownMutationExpectation): Promise<OperationDTO>;
    /** Remove one business detail; callers may need a separately authorized amount repair. */
    removeBreakdownDetail(operationId: number, breakdownId: number, mutation: BreakdownRemovalMutation): Promise<OperationDTO>;
}

function normalizeOperationQuery(query: OperationQuery | undefined): OperationQuery | undefined {
    if (query === undefined) return undefined;
    if (!isRecord(query)) throw new Error("Invalid operation query.");
    const allowed = new Set(['limit', 'offset', 'validated', 'q', 'q-amount', 'q-date', 'q-isInbound']);
    if (Object.keys(query).some(key => !allowed.has(key))) throw new Error("Invalid operation query.");

    const rawQuery = query as unknown as Record<string, unknown>;
    const normalized: OperationQuery = {};
    if (rawQuery.limit !== undefined) {
        if (!isBoundedSafeInteger(rawQuery.limit, 1, MAX_LIST_LIMIT)) {
            throw new Error("Invalid operation query.");
        }
        normalized.limit = rawQuery.limit;
    }
    if (rawQuery.offset !== undefined) {
        if (!isBoundedSafeInteger(rawQuery.offset, 0, MAX_LIST_OFFSET)) {
            throw new Error("Invalid operation query.");
        }
        normalized.offset = rawQuery.offset;
    }
    if (rawQuery.validated !== undefined) {
        if (typeof rawQuery.validated !== 'boolean') throw new Error("Invalid operation query.");
        normalized.validated = rawQuery.validated;
    }
    for (const key of ['q', 'q-amount', 'q-date'] as const) {
        const value = rawQuery[key];
        if (value === undefined) continue;
        if (!isTrimmedNonBlankText(value, MAX_SEARCH_LENGTH)) throw new Error("Invalid operation query.");
        normalized[key] = trimText(value);
    }
    if (rawQuery['q-isInbound'] !== undefined) {
        if (typeof rawQuery['q-isInbound'] !== 'boolean') throw new Error("Invalid operation query.");
        normalized['q-isInbound'] = rawQuery['q-isInbound'];
    }
    return normalized;
}

function normalizeAvailableCategoriesQuery(
    query: AvailableCategoriesQuery | undefined,
): AvailableCategoriesQuery | undefined {
    if (query === undefined) return undefined;
    if (!isRecord(query) || Object.keys(query).some(key => key !== 'isRefund' && key !== 'search')) {
        throw new Error("Invalid available-categories query.");
    }
    const normalized: AvailableCategoriesQuery = {};
    if (query.isRefund !== undefined && typeof query.isRefund !== 'boolean') {
        throw new Error("Invalid available-categories query.");
    }
    if (query.isRefund === true) normalized.isRefund = true;
    if (query.search !== undefined) {
        if (!isTrimmedNonBlankText(query.search, MAX_SEARCH_LENGTH)) {
            throw new Error("Invalid available-categories query.");
        }
        normalized.search = trimText(query.search);
    }
    return normalized;
}

function normalizeKilometricCreationData(data: KilometricIndemnityCreationDTO): KilometricIndemnityCreationDTO {
    if (!data || typeof data !== 'object'
        || !isIsoDate(data.date)
        || typeof data.distance !== 'number' || !Number.isFinite(data.distance)
        || data.distance <= 0 || data.distance > MAX_KILOMETRIC_DISTANCE
        || (data.memo !== undefined && !isTrimmedNonBlankText(data.memo, MAX_ACCOUNTING_MEMO_LENGTH))
        || (data.carId !== undefined && !isPositiveSafeInteger(data.carId))) {
        throw new Error("Invalid kilometric indemnity creation data.");
    }
    return {
        date: data.date,
        distance: data.distance,
        memo: data.memo === undefined ? undefined : trimText(data.memo),
        carId: data.carId,
    };
}

function isExpectedKilometricBreakdown(
    value: unknown,
    data: KilometricIndemnityCreationDTO,
): boolean {
    if (!isRecord(value) || !isRecord(value.associationData) || value.associationData.kilometers !== data.distance) {
        return false;
    }
    const associationData = value.associationData;
    return data.carId === undefined
        ? !Object.prototype.hasOwnProperty.call(associationData, 'carId')
        : Object.prototype.hasOwnProperty.call(associationData, 'carId') && associationData.carId === data.carId;
}

function assertVerifiedKilometricPost(
    raw: unknown,
    companyId: number,
    data: KilometricIndemnityCreationDTO,
): asserts raw is RawOperationDTO {
    if (!isRecord(raw)
        || !isPositiveSafeInteger(raw.id)
        || raw.companyId !== companyId
        || raw.type !== 'kilometricIndemnity'
        || raw.date !== data.date
        || raw.memo !== data.memo
        || !isMoneyAmount(raw.amount, true)
        || typeof raw.isInbound !== 'boolean'
        || typeof raw.hasVat !== 'boolean'
        || raw.isDraft !== false
        || !Array.isArray(raw.breakdowns)
        // This request creates one association-bearing line. An unexpected
        // response shape is deliberately unverifiable until provider-probe
        // evidence establishes a different stable representation.
        || raw.breakdowns.length !== 1
        || !isExpectedKilometricBreakdown(raw.breakdowns[0], data)) {
        throw new Error(KILOMETRIC_UNVERIFIED_POST);
    }
}

const MAX_EXPENSE_REPORT_BREAKDOWNS = 20;
const MAX_EXPENSE_REPORT_CENTS = 10_000_000;

/**
 * Append one configured tag without changing caller text. Only an exact
 * terminal tag preceded by an ordinary space is considered already applied;
 * internal textual mentions and punctuation are intentionally preserved.
 */
export function appendOperationMemoTag(memo: string | undefined, tag: string | undefined): string | undefined;
export function appendOperationMemoTag(memo: null, tag: string | undefined): string | null;
export function appendOperationMemoTag(memo: string | null | undefined, tag: string | undefined): string | null | undefined {
    // With no configured tag this is a transparent pass-through, including
    // provider null/empty values on historical operations.
    if (tag === undefined) return memo;
    if (memo !== null && memo !== undefined && memo !== "" && !isTrimmedNonBlankText(memo, MAX_ACCOUNTING_MEMO_LENGTH)) {
        throw new Error("Invalid operation memo.");
    }
    if (!/^#[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(tag)) {
        throw new Error("Invalid rendered operation memo tag.");
    }

    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (memo === tag || new RegExp(` ${escapedTag}$`).test(memo ?? "")) return memo;

    const tagged = memo === null || memo === undefined || memo === "" ? tag : `${memo} ${tag}`;
    if (tagged.length > MAX_ACCOUNTING_MEMO_LENGTH) {
        throw new Error("Operation memo exceeds the maximum length after applying the configured tag.");
    }
    return tagged;
}

function normalizeExpenseCreationData(data: ExpenseCreationDTO): ExpenseCreationDTO {
    if (!data || typeof data !== 'object'
        || !isIsoDate(data.date)
        || !isMoneyAmount(data.amount)
        || !isTrimmedNonBlankText(data.memo, MAX_ACCOUNTING_MEMO_LENGTH)
        || !isPositiveSafeInteger(data.businessCategoryId)
        || !isPositiveSafeInteger(data.partnerId)) {
        throw new Error("Invalid expense creation data.");
    }
    return { ...data, memo: trimText(data.memo) };
}

function normalizeExpenseReportCreationData(data: ExpenseReportCreationDTO): ExpenseReportCreationDTO {
    if (!data || typeof data !== 'object'
        || !isIsoDate(data.date)
        || !isTrimmedNonBlankText(data.memo, MAX_ACCOUNTING_MEMO_LENGTH)
        || !isPositiveSafeInteger(data.partnerId)
        || !Array.isArray(data.businessBreakdowns)
        || data.businessBreakdowns.length < 1
        || data.businessBreakdowns.length > MAX_EXPENSE_REPORT_BREAKDOWNS) {
        throw new Error("Invalid expense report creation data.");
    }

    let totalCents = 0;
    const categoryIds = new Set<number>();
    const businessBreakdowns = data.businessBreakdowns.map(line => {
        if (!isRecord(line) || !isMoneyAmount(line.amount) || !isPositiveSafeInteger(line.categoryId)
            || categoryIds.has(line.categoryId)) {
            throw new Error("Invalid expense report creation data.");
        }
        categoryIds.add(line.categoryId);
        totalCents += toMinorUnits(line.amount);
        return { amount: toMinorUnits(line.amount) / 100, categoryId: line.categoryId };
    });
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > MAX_EXPENSE_REPORT_CENTS) {
        throw new Error("Invalid expense report creation data.");
    }
    return { date: data.date, memo: trimText(data.memo), partnerId: data.partnerId, businessBreakdowns };
}

function getExpenseReportTotal(data: ExpenseReportCreationDTO): number {
    return data.businessBreakdowns.reduce((total, line) => total + toMinorUnits(line.amount), 0) / 100;
}

function assertContextualExpenseCategories(ids: ContextualCategoryIds, categoryIds: number[]): void {
    if (categoryIds.some(categoryId => !ids.includes(categoryId))) {
        throw new Error("Expense category is not available for this company, date, type, and direction.");
    }
}

function assertExpensePartner(raw: unknown, companyId: number, partnerId: number): void {
    if (!Array.isArray(raw) || raw.length > MAX_PREFLIGHT_RESULTS) {
        throw new Error("Expense partner preflight was incomplete.");
    }
    const ids = new Set<number>();
    for (const candidate of raw) {
        if (!isRecord(candidate)
            || !isPositiveSafeInteger(candidate.id)
            || !isPositiveSafeInteger(candidate.companyId)
            || candidate.companyId !== companyId
            || ids.has(candidate.id)) {
            throw new Error("Expense partner preflight was incomplete.");
        }
        ids.add(candidate.id);
    }
    if (!ids.has(partnerId)) throw new Error("Expense partner does not belong to this company.");
}

function isExpectedExpenseCounterpart(value: unknown, total: number, partnerId: number): boolean {
    if (!isRecord(value)
        || value.isCounterpart !== true
        || value.isInbound !== true
        || !sameMoney(value.amount, total)) {
        return false;
    }
    // The provider replaces the request-only counterpart category sentinel;
    // counterpart category identity is therefore intentionally not asserted.
    return isRecord(value.associationData) && value.associationData.partnerId === partnerId;
}

function assertExpenseReportCoherence(raw: Record<string, unknown>, requireAll: boolean): void {
    const invalid = (value: unknown, expected: unknown) => value !== undefined && value !== expected;
    if ((requireAll && raw.isDraft !== false) || (!requireAll && invalid(raw.isDraft, false))
        || (requireAll && raw.validated !== false) || (!requireAll && invalid(raw.validated, false))
        || (requireAll && raw.validatedAt !== null) || (!requireAll && invalid(raw.validatedAt, null))
        || (requireAll && raw.lockedByDate !== false) || (!requireAll && invalid(raw.lockedByDate, false))
        || (requireAll && raw.manuallyLocked !== false) || (!requireAll && invalid(raw.manuallyLocked, false))
        || (requireAll && raw.needsAttention !== false) || (!requireAll && invalid(raw.needsAttention, false))
        || (requireAll && raw.allowUnbalanced !== false) || (!requireAll && invalid(raw.allowUnbalanced, false))
        || (requireAll && raw.isTotalAmountValid !== true) || (!requireAll && invalid(raw.isTotalAmountValid, true))
        || (requireAll && (!Array.isArray(raw.errors) || raw.errors.length !== 0))
        || (!requireAll && raw.errors !== undefined && (!Array.isArray(raw.errors) || raw.errors.length !== 0))
        || (requireAll && raw.message !== null) || (!requireAll && invalid(raw.message, null))) {
        throw new Error(EXPENSE_REPORT_UNVERIFIED_POST);
    }
}

function assertVerifiedExpenseReport(
    raw: unknown,
    companyId: number,
    data: ExpenseReportCreationDTO,
    requireCoherence: boolean,
): asserts raw is RawOperationDTO {
    const total = getExpenseReportTotal(data);
    const expected = new Set(data.businessBreakdowns.map(line => `${line.categoryId}:${toMinorUnits(line.amount)}`));
    if (!isRecord(raw)
        || !isPositiveSafeInteger(raw.id)
        || raw.companyId !== companyId
        || raw.type !== 'expense'
        || raw.date !== data.date
        || raw.memo !== data.memo
        || raw.isInbound !== false
        || !sameMoney(raw.amount, total)
        || (raw.totalAmount !== undefined && !sameMoney(raw.totalAmount, total))
        || !Array.isArray(raw.breakdowns)
        || raw.breakdowns.length !== data.businessBreakdowns.length + 1) {
        throw new Error(EXPENSE_REPORT_UNVERIFIED_POST);
    }
    assertExpenseReportCoherence(raw, requireCoherence);

    const businessLines = raw.breakdowns.filter(line => isRecord(line) && line.isCounterpart === false && line.isInbound === false);
    const counterparts = raw.breakdowns.filter(line => isExpectedExpenseCounterpart(line, total, data.partnerId));
    const actual = new Set<string>();
    for (const line of businessLines) {
        if (!isPositiveSafeInteger(line.categoryId) || !isMoneyAmount(line.amount)) {
            throw new Error(EXPENSE_REPORT_UNVERIFIED_POST);
        }
        actual.add(`${line.categoryId}:${toMinorUnits(line.amount)}`);
    }
    if (businessLines.length !== data.businessBreakdowns.length
        || counterparts.length !== 1
        || actual.size !== expected.size
        || [...expected].some(key => !actual.has(key))) {
        throw new Error(EXPENSE_REPORT_UNVERIFIED_POST);
    }
}

const MAX_ASSOCIATION_NAME_LENGTH = 100;
const MAX_ASSOCIATION_VALUE_LENGTH = 200;

function normalizeRouteComponent(value: unknown, label: string): string {
    if (!isTrimmedNonBlankText(value, MAX_ASSOCIATION_NAME_LENGTH)) throw new Error(`Invalid ${label}.`);
    const normalized = trimText(value);
    if (normalized === '.' || normalized === '..') throw new Error(`Invalid ${label}.`);
    return normalized;
}

function normalizeAssociationCandidateText(value: unknown): string {
    // Bound the provider's raw value before trimming so whitespace cannot bypass
    // the response-size limit, then return the canonical public representation.
    if (typeof value !== 'string' || value.length > MAX_ASSOCIATION_VALUE_LENGTH
        || !isTrimmedNonBlankText(trimText(value), MAX_ASSOCIATION_VALUE_LENGTH)) {
        throw new Error("Invalid association candidate value.");
    }
    return trimText(value);
}

function normalizeAssociationValue(value: unknown): string | number {
    return typeof value === 'number'
        ? (() => {
            if (!isPositiveSafeInteger(value)) throw new Error("Invalid association candidate value.");
            return value;
        })()
        : normalizeAssociationCandidateText(value);
}

function assertAssignableAssociationSlot(
    breakdown: Record<string, unknown>, associationName: string, slotName: string,
): void {
    const associations = breakdown.associations;
    if (!Array.isArray(associations)) throw new Error("Breakdown association metadata is unavailable.");
    const matches = associations.filter(candidate => isRecord(candidate) && candidate.name === associationName);
    if (matches.length !== 1 || !isRecord(matches[0].slots)) {
        throw new Error("Breakdown association metadata is ambiguous or unavailable.");
    }
    const slots = matches[0].slots;
    if (!Object.prototype.hasOwnProperty.call(slots, slotName)) {
        throw new Error("Breakdown association slot is not assignable.");
    }
    const slot = slots[slotName];
    if (!isRecord(slot) || !['boolean', 'record', 'enum', 'integer'].includes(slot.type as string)
        || slot.isAssignable !== true) {
        throw new Error("Breakdown association slot is not assignable.");
    }
}

function assertCandidateOperationScope(raw: unknown, companyId: number, operationId: number): asserts raw is RawOperationDTO {
    if (!isRecord(raw) || raw.companyId !== companyId || raw.id !== operationId || !Array.isArray(raw.breakdowns)) {
        throw new Error("Breakdown association metadata is unavailable.");
    }
}

function resolveUniqueBreakdown(raw: RawOperationDTO, breakdownId: number): Record<string, unknown> {
    const seen = new Set<number>();
    const matches: Record<string, unknown>[] = [];
    for (const candidate of raw.breakdowns ?? []) {
        if (!isRecord(candidate) || !isPositiveSafeInteger(candidate.id) || seen.has(candidate.id)
            || (candidate.companyId !== undefined && candidate.companyId !== raw.companyId)
            || (candidate.operationId !== undefined && candidate.operationId !== raw.id)) {
            throw new Error("Breakdown association metadata is ambiguous or unavailable.");
        }
        seen.add(candidate.id);
        if (candidate.id === breakdownId) matches.push(candidate);
    }
    if (matches.length !== 1) throw new Error("Breakdown association metadata is ambiguous or unavailable.");
    return matches[0];
}

function normalizeAssociationCandidatesQuery(query: BreakdownAssociationCandidatesQuery): BreakdownAssociationCandidatesQuery {
    if (!isRecord(query) || Object.keys(query).some(key => !['offset', 'search', 'limit'].includes(key))
        || !isBoundedSafeInteger(query.offset, 0, MAX_LIST_OFFSET)
        || (query.limit !== undefined && !isBoundedSafeInteger(query.limit, 1, 100))
        || (query.search !== undefined && !isTrimmedNonBlankText(query.search, MAX_SEARCH_LENGTH))) {
        throw new Error("Invalid breakdown association candidates query.");
    }
    return {
        offset: query.offset,
        ...(query.search === undefined ? {} : { search: trimText(query.search) }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
    };
}

function parseAssociationCandidates(raw: unknown): BreakdownAssociationCandidatesDTO {
    if (!isRecord(raw) || !isRecord(raw.descriptor) || !Array.isArray(raw.items)
        || !Array.isArray(raw.preferredItems) || raw.items.length + raw.preferredItems.length > 100) {
        throw new Error("Invalid breakdown association candidates response.");
    }
    const descriptor: BreakdownAssociationCandidatesDTO['descriptor'] = {};
    for (const key of ['fallbackToCreation', 'askForSaleDate'] as const) {
        if (raw.descriptor[key] !== undefined) {
            if (typeof raw.descriptor[key] !== 'boolean') throw new Error("Invalid breakdown association candidates response.");
            descriptor[key] = raw.descriptor[key] as boolean;
        }
    }
    const seen = new Set<string>();
    const curate = (values: unknown[]): BreakdownAssociationCandidateDTO[] => values.map(item => {
        if (!isRecord(item)) throw new Error("Invalid breakdown association candidates response.");
        let value: string | number;
        let label: string | undefined;
        let description: string | undefined;
        try {
            value = normalizeAssociationValue(item.value);
            label = item.label === undefined ? undefined : normalizeAssociationCandidateText(item.label);
            description = item.description === undefined ? undefined : normalizeAssociationCandidateText(item.description);
        } catch {
            throw new Error("Invalid breakdown association candidates response.");
        }
        const identity = `${typeof value}:${value}`;
        if (seen.has(identity)) throw new Error("Invalid breakdown association candidates response.");
        seen.add(identity);
        return { value, label, description };
    });
    return { descriptor, items: curate(raw.items), preferredItems: curate(raw.preferredItems) };
}

function mutationFailure(): never {
    throw new Error(BREAKDOWN_MUTATION_UNVERIFIED_POST);
}

function assertExpectation(expectation: BreakdownMutationExpectation, allowedKeys = ['expectedUpdatedAt']): void {
    if (!isRecord(expectation) || Object.keys(expectation).some(key => !allowedKeys.includes(key))
        || !isTrimmedNonBlankText(expectation.expectedUpdatedAt, 100)) {
        throw new Error("A non-empty expectedUpdatedAt from the latest operation GET is required.");
    }
}

function assertMutationOperation(raw: unknown, companyId: number, operationId: number, expectation: BreakdownMutationExpectation): asserts raw is RawOperationDTO {
    if (!isRecord(expectation) || !isTrimmedNonBlankText(expectation.expectedUpdatedAt, 100)
        || !isRecord(raw) || raw.id !== operationId || raw.companyId !== companyId || !Array.isArray(raw.breakdowns)
        || raw.validated === true || (raw.validatedAt !== undefined && raw.validatedAt !== null)
        || raw.manuallyLocked === true || raw.lockedByDate === true || raw.isDraft === true
        || raw.updatedAt !== expectation.expectedUpdatedAt) {
        throw new Error("Operation is stale, validated, locked, draft, or not editable.");
    }
    const ids = new Set<number>();
    for (const line of raw.breakdowns) {
        if (!isRecord(line) || !isPositiveSafeInteger(line.id) || ids.has(line.id)
            || (line.companyId !== undefined && line.companyId !== companyId)
            || (line.operationId !== undefined && line.operationId !== operationId)) {
            throw new Error("Operation breakdown scope is ambiguous.");
        }
        ids.add(line.id);
    }
}

function findMutationBreakdown(raw: RawOperationDTO, breakdownId: number): Record<string, unknown> {
    assertPositiveSafeInteger(breakdownId);
    const matches = raw.breakdowns!.filter(line => line.id === breakdownId);
    if (matches.length !== 1 || !isRecord(matches[0])) throw new Error("Breakdown is unavailable.");
    return matches[0];
}

function assertBusinessLine(line: Record<string, unknown>): void {
    // Do not infer business intent from an omitted counterpart flag. The write
    // contract is deliberately fail-closed until the live response says false.
    if (line.isCounterpart !== false || line.isFee === true) {
        throw new Error("Counterpart and fee breakdowns cannot be changed by this action.");
    }
    if (!isMoneyAmount(line.amount, true) || typeof line.isInbound !== 'boolean') {
        throw new Error("Breakdown is not a supported business line.");
    }
}

function assertExplicitBusinessLine(line: Record<string, unknown>): void {
    if (line.isCounterpart !== false || line.isFee !== false) mutationFailure();
}

function equalJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

/** Only provider-derived category display values and timestamps may normalize. */
function lineSemantics(line: Record<string, unknown>): Record<string, unknown> {
    const stable = { ...line };
    for (const field of [
        'createdAt', 'updatedAt', 'currencyConversion', 'predictedCategoryId',
        'resolvedCategoryId', 'resolvedCategoryPath', 'autocategorizationMethod',
        'isManuallyCategorized', 'categoryWording', 'categoryGroup',
    ]) delete stable[field];
    return stable;
}

/**
 * Category selection can cause the provider to refresh its category descriptor
 * and derived investment flag. Everything else stays byte-for-byte semantic
 * state: this deliberately differs from the generic verifier used by amount,
 * investment, and removal writes.
 */
function categoryLineSemantics(line: Record<string, unknown>): Record<string, unknown> {
    const stable = lineSemantics(line);
    delete stable.categoryId;
    delete stable.associations;
    if (isRecord(stable.associationData)) {
        const associationData = { ...stable.associationData };
        delete associationData.isInvestment;
        if (Object.keys(associationData).length === 0) delete stable.associationData;
        else stable.associationData = associationData;
    }
    return stable;
}

function assertCategoryTargetSemantics(
    expected: Record<string, unknown>, persisted: Record<string, unknown>, categoryId: number,
): void {
    assertExplicitBusinessLine(persisted);
    if (persisted.categoryId !== categoryId
        || !equalJson(categoryLineSemantics(expected), categoryLineSemantics(persisted))) mutationFailure();
}

/** Preserve every raw top-level field except timestamps and calculated totals. */
function operationSemantics(raw: RawOperationDTO): Record<string, unknown> {
    const stable = { ...raw } as Record<string, unknown>;
    for (const field of ['breakdowns', 'createdAt', 'updatedAt', 'totalAmount', 'isTotalAmountValid']) delete stable[field];
    return stable;
}

function assertTopLevelPreserved(before: RawOperationDTO, after: RawOperationDTO): void {
    if (!equalJson(operationSemantics(before), operationSemantics(after))) mutationFailure();
}

function assertBreakdownSet(before: RawOperationDTO, after: RawOperationDTO, mode: 'unchanged' | 'add' | 'remove', targetId?: number): Record<string, unknown> | undefined {
    if (after.id !== before.id || after.companyId !== before.companyId || !Array.isArray(after.breakdowns)) mutationFailure();
    const beforeIds = new Set<number>();
    const afterById = new Map<number, Record<string, unknown>>();
    for (const line of before.breakdowns!) {
        if (!isRecord(line) || !isPositiveSafeInteger(line.id) || beforeIds.has(line.id)) mutationFailure();
        beforeIds.add(line.id);
    }
    for (const line of after.breakdowns) {
        if (!isRecord(line) || !isPositiveSafeInteger(line.id) || afterById.has(line.id)
            || (line.companyId !== undefined && line.companyId !== before.companyId)
            || (line.operationId !== undefined && line.operationId !== before.id)) mutationFailure();
        afterById.set(line.id, line);
    }
    const expectedIds = new Set(beforeIds);
    if (mode === 'remove') expectedIds.delete(targetId!);
    if (mode === 'add') {
        const added = [...afterById.entries()].filter(([id]) => !beforeIds.has(id));
        if (afterById.size !== beforeIds.size + 1 || added.length !== 1 || [...beforeIds].some(id => !afterById.has(id))) mutationFailure();
        return added[0][1];
    }
    if (afterById.size !== expectedIds.size || [...expectedIds].some(id => !afterById.has(id))) mutationFailure();
    return undefined;
}

function assertUnrelatedLinesPreserved(before: RawOperationDTO, after: RawOperationDTO, excludedId?: number): void {
    const afterById = new Map(after.breakdowns!.map(line => [line.id, line]));
    for (const line of before.breakdowns!) {
        if (line.id === excludedId) continue;
        const persisted = afterById.get(line.id);
        if (!persisted || !equalJson(lineSemantics(line as unknown as Record<string, unknown>), lineSemantics(persisted as unknown as Record<string, unknown>))) mutationFailure();
    }
}

function assertTargetSemantics(expected: Record<string, unknown>, persisted: Record<string, unknown>): void {
    assertExplicitBusinessLine(persisted);
    if (!equalJson(lineSemantics(expected), lineSemantics(persisted))) mutationFailure();
}

/**
 * An amount edit makes these two presentation values provider-calculated. Keep
 * the exception deliberately narrow: every other raw field remains part of
 * the target's semantic state.
 */
function amountLineSemantics(line: Record<string, unknown>): Record<string, unknown> {
    const stable = lineSemantics(line);
    delete stable.unitAmount;
    delete stable.amountExcludingTaxesWithRecoverageRate;
    return stable;
}

function assertAmountDerivedFields(line: Record<string, unknown>): void {
    if (!isMoneyAmount(line.amount, true)) mutationFailure();
    const quantity = line.quantity;
    if (quantity !== undefined && (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0)) {
        mutationFailure();
    }
    if (line.unitAmount !== undefined) {
        if (!isMoneyAmount(line.unitAmount, true)
            || (quantity === undefined
                ? !sameMoney(line.unitAmount, line.amount, true)
                : Math.abs(line.unitAmount * quantity - line.amount) > 1e-8)) {
            mutationFailure();
        }
    }
    if (line.amountExcludingTaxesWithRecoverageRate !== undefined
        && (!isMoneyAmount(line.amountExcludingTaxesWithRecoverageRate, true)
            || (line.hasVat === false && !sameMoney(line.amountExcludingTaxesWithRecoverageRate, line.amount, true)))) {
        mutationFailure();
    }
}

function assertAmountTargetSemantics(expected: Record<string, unknown>, persisted: Record<string, unknown>): void {
    assertExplicitBusinessLine(persisted);
    assertAmountDerivedFields(persisted);
    if (!equalJson(amountLineSemantics(expected), amountLineSemantics(persisted))) mutationFailure();
}

function deriveExpectedTotal(operation: RawOperationDTO, line: Record<string, unknown>, nextAmount: number): { cents: number; valid: boolean } {
    if (!isMoneyAmount(operation.totalAmount, true) || !isMoneyAmount(operation.amount)
        || !isMoneyAmount(line.amount, true) || !isMoneyAmount(nextAmount, true)) {
        throw new Error("Operation total is unavailable for exact-cent verification.");
    }
    const sign = line.isInbound === operation.isInbound ? 1 : -1;
    const cents = toMinorUnits(operation.totalAmount) + sign * (toMinorUnits(nextAmount) - toMinorUnits(line.amount as number));
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Operation total is unavailable for exact-cent verification.");
    return { cents, valid: cents === toMinorUnits(operation.amount) };
}

/** Validate caller-declared post-state purely from the final pre-POST GET. */
function assertExpectedTotalDeclaration(
    before: RawOperationDTO, line: Record<string, unknown>, nextAmount: number,
    expectedTotalAmount: number, expectedIsTotalAmountValid: boolean,
): void {
    const expected = deriveExpectedTotal(before, line, nextAmount);
    if (!isMoneyAmount(expectedTotalAmount, true) || typeof expectedIsTotalAmountValid !== 'boolean'
        || toMinorUnits(expectedTotalAmount) !== expected.cents || expectedIsTotalAmountValid !== expected.valid) {
        throw new Error("Expected total declaration does not match the current operation state.");
    }
}

function assertPersistedExpectedTotal(after: RawOperationDTO, expectedTotalAmount: number, expectedIsTotalAmountValid: boolean): void {
    if (!sameMoney(after.totalAmount, expectedTotalAmount, true) || after.isTotalAmountValid !== expectedIsTotalAmountValid) mutationFailure();
}

function getDetailSection(raw: RawOperationDTO): string {
    const lineSections = new Set(raw.breakdowns!
        .filter(line => line.isCounterpart !== true && isTrimmedNonBlankText(line.section, 100))
        .map(line => trimText(line.section!)));
    if (lineSections.size === 1) return [...lineSections][0];
    const sections = Array.isArray(raw.sections) ? raw.sections.filter(isRecord) : [];
    const main = sections.filter(section => section.id === 'main' && isTrimmedNonBlankText(section.id, 100));
    if (main.length === 1) return main[0].id as string;
    if (sections.length === 1 && isTrimmedNonBlankText(sections[0].id, 100)) return trimText(sections[0].id as string);
    throw new Error("Operation detail section is ambiguous.");
}

function hasInvestmentSlot(line: Record<string, unknown>): boolean {
    const found: unknown[] = [];
    for (const association of Array.isArray(line.associations) ? line.associations : []) {
        if (!isRecord(association)) continue;
        const slots = association.slots;
        const values = Array.isArray(slots) ? slots : isRecord(slots) ? Object.values(slots) : [];
        for (const slot of values) {
            if (isRecord(slot) && slot.key === 'isInvestment' && slot.type === 'boolean' && slot.isAssignable === true) found.push(slot);
        }
    }
    return found.length === 1;
}

export const makeOperationEndpoint = (client: Client, { companyId }: OperationEndpointParams): OperationEndpoint => {
    assertPositiveSafeInteger(companyId);
    const baseUrl = `/companies/${companyId}/operations`;
    const getRawOne = (id: number) => {
        assertPositiveSafeInteger(id);
        return client.get<RawOperationDTO>(`${baseUrl}/${id}`);
    };
    const getOne = (id: number) => getRawOne(id).then(mapOperation);
    /** Contextual category routes intentionally return validated numeric IDs, not catalogue records. */
    const getContextualCategoryIds = <Query extends object>(path: string, query?: Query) =>
        client.get<unknown>(path, query as Record<string, unknown> | undefined).then(parseContextualCategoryIds);
    const createExpenseReport = async (input: ExpenseReportCreationDTO): Promise<OperationDTO> => {
        const normalized = normalizeExpenseReportCreationData(input);
        const data = {
            ...normalized,
            memo: appendOperationMemoTag(normalized.memo, client.operationMemoTag)!,
        };
        const total = getExpenseReportTotal(data);
        const [categoryIds, partners] = await Promise.all([
            getContextualCategoryIds(`/companies/${companyId}/categories`, {
                type: 'expense', operationDate: data.date, amount: total,
            }),
            client.get<unknown>(`/companies/${companyId}/partners`),
        ]);
        assertContextualExpenseCategories(categoryIds, data.businessBreakdowns.map(line => line.categoryId));
        assertExpensePartner(partners, companyId, data.partnerId);

        const raw = await client.post<unknown>(baseUrl, {
            type: 'expense',
            date: data.date,
            memo: data.memo,
            amount: total,
            attachments: [],
            breakdowns: [
                ...data.businessBreakdowns,
                {
                    amount: 0,
                    categoryId: -1,
                    isCounterpart: true,
                    associationData: { partnerId: data.partnerId },
                },
            ],
        });
        assertVerifiedExpenseReport(raw, companyId, data, false);
        try {
            const persisted = await getRawOne(raw.id);
            assertVerifiedExpenseReport(persisted, companyId, data, true);
            return mapOperation(persisted);
        } catch {
            // The POST may already have created the report. Reconcile by the
            // tagged memo and scoped GET; never replay this create request.
            throw new Error(EXPENSE_REPORT_UNVERIFIED_POST);
        }
    };

    const commitBreakdownMutation = async (
        before: RawOperationDTO,
        updatedBreakdown: Record<string, unknown>,
        breakdowns: unknown[],
        verify: (persisted: RawOperationDTO, expectedBefore: RawOperationDTO) => void,
    ): Promise<OperationDTO> => {
        // Breakdown writes resend the full operation. Tag that copy, not the
        // caller-observed object, so every line mutation has the same audit
        // marker contract as creates and verification expects the tagged memo.
        const expectedBefore = { ...before, memo: appendOperationMemoTag(before.memo, client.operationMemoTag) };
        await client.postVoid(`${baseUrl}/${before.id}`, { ...expectedBefore, breakdowns, updatedBreakdown });
        try {
            const persisted = await getRawOne(before.id);
            verify(persisted, expectedBefore);
            return mapOperation(persisted);
        } catch {
            mutationFailure();
        }
    };

    return {
        getAll: (query?: OperationQuery) =>
            client.get<RawOperationDTO[]>(baseUrl, normalizeOperationQuery(query)).then(mapOperations),
        getOne,
        addBreakdownDetail: async (operationId, expectation) => {
            assertPositiveSafeInteger(operationId);
            assertExpectation(expectation);
            const before = await getRawOne(operationId);
            assertMutationOperation(before, companyId, operationId, expectation);
            if (!isMoneyAmount(before.amount) || !isMoneyAmount(before.totalAmount, true)
                || toMinorUnits(before.amount) !== toMinorUnits(before.totalAmount)) {
                throw new Error("Only the live-proven zero-residual detail add is supported.");
            }
            const section = getDetailSection(before);
            const sectionMeta = (before.sections ?? []).filter(isRecord).find(candidate => candidate.id === section);
            const direction = sectionMeta?.invertSign === true ? !before.isInbound : before.isInbound;
            const added = { categoryWording: 'Non catégorisé', section, amount: 0, isInbound: direction };
            const priorIds = new Set(before.breakdowns!.map(line => line.id));
            return commitBreakdownMutation(before, added, [...before.breakdowns!, added], (persisted, expectedBefore) => {
                assertTopLevelPreserved(expectedBefore, persisted);
                const addedLine = assertBreakdownSet(expectedBefore, persisted, 'add');
                assertUnrelatedLinesPreserved(expectedBefore, persisted);
                if (!addedLine || !isPositiveSafeInteger(addedLine.id) || priorIds.has(addedLine.id)
                    || !sameMoney(addedLine.amount, 0, true) || addedLine.isInbound !== direction
                    || addedLine.section !== section || addedLine.categoryWording !== 'Non catégorisé'
                    || addedLine.isCounterpart !== false || addedLine.isFee !== false
                    || !sameMoney(persisted.totalAmount, expectedBefore.totalAmount!, true)
                    || persisted.isTotalAmountValid !== expectedBefore.isTotalAmountValid) mutationFailure();
            });
        },
        setBreakdownCategory: async (operationId, breakdownId, categoryId, expectation) => {
            assertPositiveSafeInteger(operationId);
            assertExpectation(expectation);
            assertPositiveSafeInteger(breakdownId);
            assertPositiveSafeInteger(categoryId);
            // The contextual route is scoped by company, operation date, amount,
            // direction, and selected line on the provider; never use the global catalogue.
            const categoryPreflight = await getRawOne(operationId);
            assertMutationOperation(categoryPreflight, companyId, operationId, expectation);
            const preflightLine = findMutationBreakdown(categoryPreflight, breakdownId);
            assertBusinessLine(preflightLine);
            const available = await getContextualCategoryIds(
                `${baseUrl}/${operationId}/breakdowns/${breakdownId}/available-categories`,
                preflightLine.isRefund === true ? { isRefund: true } : undefined,
            );
            if (!available.includes(categoryId)) throw new Error("Category is not available for this operation context.");
            // The category lookup has no CAS. Re-read immediately before POST and
            // compare the caller's version token to minimize, not eliminate, races.
            const before = await getRawOne(operationId);
            assertMutationOperation(before, companyId, operationId, expectation);
            const line = findMutationBreakdown(before, breakdownId);
            assertBusinessLine(line);
            const changed = { ...line, categoryId };
            return commitBreakdownMutation(before, changed, before.breakdowns!.map(candidate => candidate.id === breakdownId ? changed : candidate), (persisted, expectedBefore) => {
                assertTopLevelPreserved(expectedBefore, persisted);
                assertBreakdownSet(expectedBefore, persisted, 'unchanged');
                assertUnrelatedLinesPreserved(expectedBefore, persisted, breakdownId);
                const target = findMutationBreakdown(persisted, breakdownId);
                assertCategoryTargetSemantics(changed, target, categoryId);
                if (!sameMoney(persisted.totalAmount, expectedBefore.totalAmount!, true)
                    || persisted.isTotalAmountValid !== expectedBefore.isTotalAmountValid) mutationFailure();
            });
        },
        setBreakdownAmount: async (operationId, breakdownId, mutation) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(breakdownId);
            assertExpectation(mutation, ['expectedUpdatedAt', 'amount', 'expectedTotalAmount', 'expectedIsTotalAmountValid']);
            if (!isMoneyAmount(mutation.amount) || !isMoneyAmount(mutation.expectedTotalAmount, true)
                || typeof mutation.expectedIsTotalAmountValid !== 'boolean') throw new Error("Invalid breakdown amount mutation.");
            const before = await getRawOne(operationId);
            assertMutationOperation(before, companyId, operationId, mutation);
            const line = findMutationBreakdown(before, breakdownId);
            assertBusinessLine(line);
            if (sameMoney(line.amount, mutation.amount)) throw new Error("Breakdown amount is unchanged.");
            // This is the final fresh GET and target resolution: reject a
            // mismatched declaration before the one permitted POST is sent.
            assertExpectedTotalDeclaration(before, line, mutation.amount, mutation.expectedTotalAmount, mutation.expectedIsTotalAmountValid);
            const changed: Record<string, unknown> = { ...line, amount: mutation.amount };
            // The UI strips this documented provider-derived value during an amount edit.
            delete changed.currencyConversion;
            return commitBreakdownMutation(before, changed, before.breakdowns!.map(candidate => candidate.id === breakdownId ? changed : candidate), (persisted, expectedBefore) => {
                assertTopLevelPreserved(expectedBefore, persisted);
                assertBreakdownSet(expectedBefore, persisted, 'unchanged');
                assertUnrelatedLinesPreserved(expectedBefore, persisted, breakdownId);
                assertAmountTargetSemantics(changed, findMutationBreakdown(persisted, breakdownId));
                assertPersistedExpectedTotal(persisted, mutation.expectedTotalAmount, mutation.expectedIsTotalAmountValid);
            });
        },
        setBreakdownIsInvestment: async (operationId, breakdownId, value, expectation) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(breakdownId);
            assertExpectation(expectation);
            if (typeof value !== 'boolean') throw new Error("isInvestment must be boolean.");
            const preflight = await getRawOne(operationId);
            assertMutationOperation(preflight, companyId, operationId, expectation);
            const preflightLine = findMutationBreakdown(preflight, breakdownId);
            assertBusinessLine(preflightLine);
            if (!hasInvestmentSlot(preflightLine)) throw new Error("The live-proven isInvestment association slot is unavailable.");
            const before = await getRawOne(operationId);
            assertMutationOperation(before, companyId, operationId, expectation);
            const line = findMutationBreakdown(before, breakdownId);
            assertBusinessLine(line);
            if (!hasInvestmentSlot(line)) throw new Error("The live-proven isInvestment association slot is unavailable.");
            const changed = { ...line, associationData: { ...(isRecord(line.associationData) ? line.associationData : {}), isInvestment: value } };
            return commitBreakdownMutation(before, changed, before.breakdowns!.map(candidate => candidate.id === breakdownId ? changed : candidate), (persisted, expectedBefore) => {
                assertTopLevelPreserved(expectedBefore, persisted);
                assertBreakdownSet(expectedBefore, persisted, 'unchanged');
                assertUnrelatedLinesPreserved(expectedBefore, persisted, breakdownId);
                assertTargetSemantics(changed, findMutationBreakdown(persisted, breakdownId));
                if (!sameMoney(persisted.totalAmount, expectedBefore.totalAmount!, true)
                    || persisted.isTotalAmountValid !== expectedBefore.isTotalAmountValid) mutationFailure();
            });
        },
        removeBreakdownDetail: async (operationId, breakdownId, mutation) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(breakdownId);
            assertExpectation(mutation, ['expectedUpdatedAt', 'expectedTotalAmount', 'expectedIsTotalAmountValid']);
            if (!isMoneyAmount(mutation.expectedTotalAmount, true) || typeof mutation.expectedIsTotalAmountValid !== 'boolean') {
                throw new Error("Invalid breakdown removal mutation.");
            }
            const before = await getRawOne(operationId);
            assertMutationOperation(before, companyId, operationId, mutation);
            const line = findMutationBreakdown(before, breakdownId);
            assertBusinessLine(line);
            if (before.breakdowns!.filter(candidate => candidate.isCounterpart === false && candidate.isFee !== true).length < 2) {
                throw new Error("The last business breakdown cannot be removed.");
            }
            // As with an amount edit, authorize the declared post-state before POST.
            assertExpectedTotalDeclaration(before, line, 0, mutation.expectedTotalAmount, mutation.expectedIsTotalAmountValid);
            return commitBreakdownMutation(before, line, before.breakdowns!.filter(candidate => candidate.id !== breakdownId), (persisted, expectedBefore) => {
                assertTopLevelPreserved(expectedBefore, persisted);
                assertBreakdownSet(expectedBefore, persisted, 'remove', breakdownId);
                assertUnrelatedLinesPreserved(expectedBefore, persisted, breakdownId);
                assertPersistedExpectedTotal(persisted, mutation.expectedTotalAmount, mutation.expectedIsTotalAmountValid);
            });
        },
        getAvailableCategories: (operationId, breakdownId, query) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(breakdownId);
            return getContextualCategoryIds(
                `${baseUrl}/${operationId}/breakdowns/${breakdownId}/available-categories`,
                normalizeAvailableCategoriesQuery(query),
            );
        },
        getBreakdownAssociationCandidates: async (operationId, breakdownId, associationName, slotName, query) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(breakdownId);
            const normalizedAssociationName = normalizeRouteComponent(associationName, 'association name');
            const normalizedSlotName = normalizeRouteComponent(slotName, 'association slot name');
            const normalizedQuery = normalizeAssociationCandidatesQuery(query);
            const raw = await getRawOne(operationId);
            assertCandidateOperationScope(raw, companyId, operationId);
            const breakdown = resolveUniqueBreakdown(raw, breakdownId);
            assertAssignableAssociationSlot(breakdown, normalizedAssociationName, normalizedSlotName);
            return client.get<unknown>(
                `${baseUrl}/${operationId}/breakdowns/${breakdownId}/associations/${encodeURIComponent(normalizedAssociationName)}/slots/${encodeURIComponent(normalizedSlotName)}/candidates`,
                { offset: normalizedQuery.offset, ...(normalizedQuery.search === undefined ? {} : { q: normalizedQuery.search }), ...(normalizedQuery.limit === undefined ? {} : { limit: normalizedQuery.limit }) },
            ).then(parseAssociationCandidates);
        },
        downloadSourceDocumentAttachment: async (operationId: number, attachmentId: number) => {
            assertPositiveSafeInteger(operationId);
            assertPositiveSafeInteger(attachmentId);
            const operation = await getOne(operationId);
            const attachment = operation.sourceDocumentAttachments?.find(candidate => candidate.id === attachmentId);
            if (!attachment || typeof attachment.url !== 'string' || attachment.url.trim().length === 0) {
                throw new Error("Operation has no matching source-document attachment.");
            }
            return client.downloadFile(attachment.url);
        },
        delete: (id: number) => {
            assertPositiveSafeInteger(id);
            return client.deleteVoid(`${baseUrl}/${id}`);
        },
        createKilometricIndemnity: async (input: KilometricIndemnityCreationDTO) => {
            const normalized = normalizeKilometricCreationData(input);
            const data = { ...normalized, memo: appendOperationMemoTag(normalized.memo, client.operationMemoTag) };
            const payload = {
                type: 'kilometricIndemnity',
                date: data.date,
                memo: data.memo,
                breakdowns: [{
                    amount: 0,
                    categoryId: -1,
                    associationData: {
                        kilometers: data.distance,
                        ...(data.carId === undefined ? {} : { carId: data.carId }),
                    },
                }],
            };
            // Client.post is centrally one-shot: no redirect or authentication replay.
            const raw = await client.post<unknown>(baseUrl, payload);
            assertVerifiedKilometricPost(raw, companyId, data);
            return mapOperation(raw);
        },
        createExpenseReport,
        createExpense: async (input: ExpenseCreationDTO) => {
            const data = normalizeExpenseCreationData(input);
            return createExpenseReport({
                date: data.date,
                memo: data.memo,
                partnerId: data.partnerId,
                businessBreakdowns: [{ amount: data.amount, categoryId: data.businessCategoryId }],
            });
        },
    };
};
