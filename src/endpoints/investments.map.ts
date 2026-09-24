import type { InvestmentDTO, InvestmentStatusDTO } from './investments';
import { mapCategory, type RawCategoryDTO } from './categories.map';

/** Raw investment shape used only at the HTTP boundary. */
export interface RawInvestmentDTO {
    id: number;
    name?: string;
    memo?: string | null;
    categoryId?: number;
    category?: RawCategoryDTO | null;
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
    [key: string]: unknown;
}

/** Raw status shape deliberately reduced by mapInvestmentStatus. */
export interface RawInvestmentStatusDTO {
    status?: string;
    isLocked?: boolean;
    lockedByFec?: boolean;
    isFecLocked?: boolean;
    isEditable?: boolean;
    canEdit?: boolean;
    [key: string]: unknown;
}

/** Maps an investment response to its curated public representation. */
export function mapInvestment(raw: RawInvestmentDTO): InvestmentDTO {
    return {
        id: raw.id,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        memo: typeof raw.memo === 'string' || raw.memo === null ? raw.memo : undefined,
        categoryId: typeof raw.categoryId === 'number' ? raw.categoryId : raw.category?.id,
        category: raw.category ? mapCategory(raw.category) : undefined,
        purchaseAmount: typeof raw.purchaseAmount === 'number' ? raw.purchaseAmount : undefined,
        amortizableAmount: typeof raw.amortizableAmount === 'number' ? raw.amortizableAmount : undefined,
        previouslyAmortizedAmount: typeof raw.previouslyAmortizedAmount === 'number'
            ? raw.previouslyAmortizedAmount
            : undefined,
        purchaseDate: typeof raw.purchaseDate === 'string' ? raw.purchaseDate : undefined,
        saleDate: typeof raw.saleDate === 'string' || raw.saleDate === null ? raw.saleDate : undefined,
        amortizationType: typeof raw.amortizationType === 'string' ? raw.amortizationType : undefined,
        amortizationStartDate: typeof raw.amortizationStartDate === 'string'
            ? raw.amortizationStartDate
            : undefined,
        amortizationYearCount: typeof raw.amortizationYearCount === 'number'
            ? raw.amortizationYearCount
            : undefined,
        amortizationRatio: typeof raw.amortizationRatio === 'number' || raw.amortizationRatio === null
            ? raw.amortizationRatio
            : undefined,
        isFullyPaid: typeof raw.isFullyPaid === 'boolean' ? raw.isFullyPaid : undefined,
        isDraft: typeof raw.isDraft === 'boolean' ? raw.isDraft : undefined,
        protected: typeof raw.protected === 'boolean' ? raw.protected : undefined,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    };
}

export function mapInvestments(raw: RawInvestmentDTO[]): InvestmentDTO[] {
    return raw.map(mapInvestment);
}

/** Maps only documented, generic status signals; provider internals stay private. */
export function mapInvestmentStatus(raw: RawInvestmentStatusDTO): InvestmentStatusDTO {
    return {
        status: typeof raw.status === 'string' ? raw.status : undefined,
        isLocked: typeof raw.isLocked === 'boolean' ? raw.isLocked : undefined,
        lockedByFec: typeof raw.lockedByFec === 'boolean'
            ? raw.lockedByFec
            : typeof raw.isFecLocked === 'boolean'
                ? raw.isFecLocked
                : undefined,
        isEditable: typeof raw.isEditable === 'boolean'
            ? raw.isEditable
            : typeof raw.canEdit === 'boolean'
                ? raw.canEdit
                : undefined,
    };
}
