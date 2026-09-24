import { Client } from '../client';
import { INVESTMENT_UNVERIFIED_POST } from '../mutation-errors';
import { mapCategories, type RawCategoryDTO } from './categories.map';
import {
    mapInvestment,
    mapInvestments,
    mapInvestmentStatus,
    type RawInvestmentDTO,
    type RawInvestmentStatusDTO,
} from './investments.map';
import {
    assertPositiveSafeInteger,
    isBoundedAmortizationRatio,
    isBoundedSafeInteger,
    isIsoDate,
    isMoneyAmount,
    isPositiveSafeInteger,
    isRecord,
    isTrimmedNonBlankText,
    MAX_ACCOUNTING_MEMO_LENGTH,
    MAX_AMORTIZATION_YEAR_COUNT,
    MAX_LIST_LIMIT,
    MAX_LIST_OFFSET,
    MAX_PREFLIGHT_RESULTS,
    MAX_INVESTMENT_NAME_LENGTH,
    sameMoney,
    trimText,
} from './validation';
import type { CategoryDTO } from './categories';

const DEFAULT_PAGE_LIMIT = 25;

/** Bounded pagination for the fixed canonical investment ordering. */
export interface InvestmentListQuery {
    limit?: number;
    offset?: number;
}

export type AmortizationType = 'amortizing' | 'linear' | 'none';

/** Explicit, non-draft investment creation fields. */
export interface InvestmentCreationDTO {
    name: string;
    memo?: string;
    categoryId: number;
    purchaseAmount: number;
    amortizableAmount: number;
    previouslyAmortizedAmount: number;
    purchaseDate: string;
    saleDate: string | null;
    amortizationType: AmortizationType;
    amortizationStartDate: string;
    amortizationYearCount: number;
    amortizationRatio: number | null;
    isFullyPaid: boolean;
}

/** Curated fixed-asset record. */
export interface InvestmentDTO {
    id: number;
    /** Omitted when the provider response is incomplete; never synthesized. */
    name?: string;
    memo?: string | null;
    categoryId?: number;
    category?: CategoryDTO;
    purchaseAmount?: number;
    amortizableAmount?: number;
    previouslyAmortizedAmount?: number;
    purchaseDate?: string;
    saleDate?: string | null;
    amortizationType?: string;
    amortizationStartDate?: string;
    amortizationYearCount?: number;
    amortizationRatio?: number | null;
    isFullyPaid?: boolean;
    isDraft?: boolean;
    protected?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Curated edit/lock information returned by the investment status route. */
export interface InvestmentStatusDTO {
    status?: string;
    isLocked?: boolean;
    lockedByFec?: boolean;
    isEditable?: boolean;
}

export interface InvestmentEndpointParams {
    companyId: number;
}

/** Manage fixed assets without exposing update, delete, upload, or source-link flows. */
export interface InvestmentEndpoint {
    getAll(query?: InvestmentListQuery): Promise<InvestmentDTO[]>;
    getActiveCategories(): Promise<CategoryDTO[]>;
    getOne(id: number): Promise<InvestmentDTO>;
    getStatus(id: number): Promise<InvestmentStatusDTO>;
    create(data: InvestmentCreationDTO): Promise<InvestmentDTO>;
}

function isAmortizationType(value: unknown): value is AmortizationType {
    return value === 'amortizing' || value === 'linear' || value === 'none';
}

function assertListQuery(query: InvestmentListQuery | undefined): Required<InvestmentListQuery> {
    if (query !== undefined && (!isRecord(query) || Object.keys(query).some(key => key !== 'limit' && key !== 'offset'))) {
        throw new Error("Invalid investment list query.");
    }
    const rawQuery = query as unknown as Record<string, unknown> | undefined;
    const limit = rawQuery?.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = rawQuery?.offset ?? 0;
    if (!isBoundedSafeInteger(limit, 1, MAX_LIST_LIMIT)
        || !isBoundedSafeInteger(offset, 0, MAX_LIST_OFFSET)) {
        throw new Error("Invalid investment list query.");
    }
    return { limit, offset };
}

function investmentListPath(basePath: string, query: InvestmentListQuery | undefined): string {
    const { limit, offset } = assertListQuery(query);
    const params = new URLSearchParams();
    params.set('isDraft', 'false');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    // The API expects two repeated JSON orderBy parameters, not a user-provided sort.
    params.append('orderBy', JSON.stringify(['amortizationStartDate', 'DESC']));
    params.append('orderBy', JSON.stringify(['id', 'ASC']));
    return `${basePath}?${params.toString()}`;
}

function normalizeInvestmentCreationData(data: InvestmentCreationDTO): InvestmentCreationDTO {
    if (!data || typeof data !== 'object'
        || !isTrimmedNonBlankText(data.name, MAX_INVESTMENT_NAME_LENGTH)
        || (data.memo !== undefined && !isTrimmedNonBlankText(data.memo, MAX_ACCOUNTING_MEMO_LENGTH))
        || !isPositiveSafeInteger(data.categoryId)
        || !isMoneyAmount(data.purchaseAmount)
        || !isMoneyAmount(data.amortizableAmount, true)
        || !isMoneyAmount(data.previouslyAmortizedAmount, true)
        || !isIsoDate(data.purchaseDate)
        || (data.saleDate !== null && !isIsoDate(data.saleDate))
        || !isAmortizationType(data.amortizationType)
        || !isIsoDate(data.amortizationStartDate)
        || !Number.isSafeInteger(data.amortizationYearCount)
        || typeof data.isFullyPaid !== 'boolean') {
        throw new Error("Invalid investment creation data.");
    }

    if (data.previouslyAmortizedAmount > data.amortizableAmount
        || data.amortizableAmount > data.purchaseAmount
        || data.amortizationStartDate < data.purchaseDate
        || (data.saleDate !== null
            && (data.saleDate < data.purchaseDate || data.saleDate < data.amortizationStartDate))) {
        throw new Error("Invalid investment creation data.");
    }

    switch (data.amortizationType) {
        case 'amortizing':
            if (data.amortizableAmount <= 0
                || data.amortizationYearCount < 1
                || data.amortizationYearCount > MAX_AMORTIZATION_YEAR_COUNT
                || !isBoundedAmortizationRatio(data.amortizationRatio)) {
                throw new Error("Invalid investment creation data.");
            }
            break;
        case 'linear':
            if (data.amortizableAmount <= 0
                || data.amortizationYearCount < 1
                || data.amortizationYearCount > MAX_AMORTIZATION_YEAR_COUNT
                || data.amortizationRatio !== null) {
                throw new Error("Invalid investment creation data.");
            }
            break;
        case 'none':
            if (data.amortizationYearCount < 1
                || data.amortizationYearCount > MAX_AMORTIZATION_YEAR_COUNT
                || data.amortizationRatio !== null) {
                throw new Error("Invalid investment creation data.");
            }
            break;
    }

    return {
        ...data,
        name: trimText(data.name),
        memo: data.memo === undefined ? undefined : trimText(data.memo),
    };
}

function assertActiveCategoryDefaults(raw: unknown, data: InvestmentCreationDTO): void {
    if (!Array.isArray(raw) || raw.length > MAX_PREFLIGHT_RESULTS) {
        throw new Error("Investment category preflight was incomplete.");
    }
    const categoryIds = new Set<number>();
    for (const candidate of raw) {
        if (!isRecord(candidate) || !isPositiveSafeInteger(candidate.id) || categoryIds.has(candidate.id)) {
            throw new Error("Investment category preflight was incomplete.");
        }
        categoryIds.add(candidate.id);
    }
    const matching = raw.filter((candidate): candidate is Record<string, unknown> =>
        isRecord(candidate) && candidate.id === data.categoryId,
    );
    if (matching.length === 0) throw new Error("Investment category is not active for this company.");
    if (matching.length !== 1) throw new Error("Investment category preflight was incomplete.");

    const category = matching[0];
    if (category.isActive === false || category.active === false || category.isInvestment === false) {
        throw new Error("Investment category is not active for this company.");
    }
    if (!isPositiveSafeInteger(category.id) || !isRecord(category.investment)) {
        throw new Error("Investment category preflight was incomplete.");
    }

    const defaults = category.investment;
    if (!Object.prototype.hasOwnProperty.call(defaults, 'type') || !isAmortizationType(defaults.type)) {
        throw new Error("Investment category preflight was incomplete.");
    }
    if (defaults.type !== data.amortizationType) {
        throw new Error("Investment category defaults contradict the requested amortization type.");
    }

    if (Object.prototype.hasOwnProperty.call(defaults, 'duration')) {
        if (!isBoundedSafeInteger(defaults.duration, 1, MAX_AMORTIZATION_YEAR_COUNT)) {
            throw new Error("Investment category preflight was incomplete.");
        }
        if (defaults.duration !== data.amortizationYearCount) {
            throw new Error("Investment category defaults contradict the requested amortization duration.");
        }
    }
    if (Object.prototype.hasOwnProperty.call(defaults, 'ratio')) {
        if (defaults.ratio !== null && !isBoundedAmortizationRatio(defaults.ratio)) {
            throw new Error("Investment category preflight was incomplete.");
        }
        if (defaults.ratio !== data.amortizationRatio) {
            throw new Error("Investment category defaults contradict the requested amortization ratio.");
        }
    }
}

function buildInvestmentPayload(data: InvestmentCreationDTO): Record<string, unknown> {
    return {
        name: data.name,
        memo: data.memo,
        categoryId: data.categoryId,
        purchaseAmount: data.purchaseAmount,
        amortizableAmount: data.amortizableAmount,
        previouslyAmortizedAmount: data.previouslyAmortizedAmount,
        purchaseDate: data.purchaseDate,
        saleDate: data.saleDate,
        amortizationType: data.amortizationType,
        amortizationStartDate: data.amortizationStartDate,
        amortizationYearCount: data.amortizationYearCount,
        amortizationRatio: data.amortizationRatio,
        isFullyPaid: data.isFullyPaid,
        // This initial public capability deliberately creates a standard non-draft asset.
        isDraft: false,
        protected: false,
    };
}

function assertVerifiedInvestmentPost(raw: unknown, data: InvestmentCreationDTO): asserts raw is RawInvestmentDTO {
    const validMemo = data.memo === undefined
        ? raw && isRecord(raw) && (raw.memo === undefined || raw.memo === null || raw.memo === '')
        : raw && isRecord(raw) && raw.memo === data.memo;
    if (!isRecord(raw)
        || !isPositiveSafeInteger(raw.id)
        || raw.name !== data.name
        || !validMemo
        || raw.categoryId !== data.categoryId
        || !sameMoney(raw.purchaseAmount, data.purchaseAmount)
        || !sameMoney(raw.amortizableAmount, data.amortizableAmount, true)
        || !sameMoney(raw.previouslyAmortizedAmount, data.previouslyAmortizedAmount, true)
        || raw.purchaseDate !== data.purchaseDate
        || raw.saleDate !== data.saleDate
        || raw.amortizationType !== data.amortizationType
        || raw.amortizationStartDate !== data.amortizationStartDate
        || raw.amortizationYearCount !== data.amortizationYearCount
        || raw.amortizationRatio !== data.amortizationRatio
        || raw.isFullyPaid !== data.isFullyPaid
        || raw.isDraft !== false
        || raw.protected !== false) {
        throw new Error(INVESTMENT_UNVERIFIED_POST);
    }
}

export const makeInvestmentEndpoint = (
    client: Client,
    { companyId }: InvestmentEndpointParams,
): InvestmentEndpoint => {
    assertPositiveSafeInteger(companyId);
    const basePath = `/companies/${companyId}/investments`;
    const getRawActiveCategories = () => client.get<RawCategoryDTO[]>(`${basePath}/active-categories`);
    const getActiveCategories = () => getRawActiveCategories().then(mapCategories);

    return {
        getAll: (query?: InvestmentListQuery) =>
            client.get<RawInvestmentDTO[]>(investmentListPath(basePath, query)).then(mapInvestments),
        getActiveCategories,
        getOne: (id: number) => {
            assertPositiveSafeInteger(id);
            return client.get<RawInvestmentDTO>(`${basePath}/${id}`).then(mapInvestment);
        },
        getStatus: (id: number) => {
            assertPositiveSafeInteger(id);
            return client.get<RawInvestmentStatusDTO>(`${basePath}/${id}/status`).then(mapInvestmentStatus);
        },
        create: async (input: InvestmentCreationDTO) => {
            const data = normalizeInvestmentCreationData(input);
            const categories = await getRawActiveCategories();
            assertActiveCategoryDefaults(categories, data);
            const raw = await client.post<unknown>(basePath, buildInvestmentPayload(data));
            assertVerifiedInvestmentPost(raw, data);
            return mapInvestment(raw);
        },
    };
};
