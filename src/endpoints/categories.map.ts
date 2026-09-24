import type { CategoryDTO, CategoryGroupDTO, CategoryInvestmentDefaultsDTO } from './categories';
import {
    isPositiveSafeInteger,
    MAX_PREFLIGHT_RESULTS,
} from './validation';

/** Raw category shape used only at the HTTP boundary. */
export interface RawCategoryDTO {
    id: number;
    wording?: string;
    name?: string;
    group?: RawCategoryGroupDTO | null;
    categoryGroup?: RawCategoryGroupDTO | null;
    type?: string;
    isActive?: boolean;
    active?: boolean;
    investment?: RawCategoryInvestmentDefaultsDTO | null;
    [key: string]: unknown;
}

interface RawCategoryGroupDTO {
    id?: number;
    name?: string;
    [key: string]: unknown;
}

interface RawCategoryInvestmentDefaultsDTO {
    type?: string;
    duration?: number;
    ratio?: number | null;
    [key: string]: unknown;
}

function mapGroup(raw: RawCategoryGroupDTO | null | undefined): CategoryGroupDTO | undefined {
    if (!raw || typeof raw.id !== 'number' || typeof raw.name !== 'string') return undefined;
    return { id: raw.id, name: raw.name };
}

function mapInvestmentDefaults(
    raw: RawCategoryInvestmentDefaultsDTO | null | undefined,
): CategoryInvestmentDefaultsDTO | undefined {
    if (!raw) return undefined;
    const type = typeof raw.type === 'string' ? raw.type : undefined;
    const duration = typeof raw.duration === 'number' ? raw.duration : undefined;
    const ratio = typeof raw.ratio === 'number' || raw.ratio === null ? raw.ratio : undefined;
    if (type === undefined && duration === undefined && ratio === undefined) return undefined;
    return { type, duration, ratio };
}

/** Maps a category response to the small stable public category shape. */
export function mapCategory(raw: RawCategoryDTO): CategoryDTO {
    return {
        id: raw.id,
        wording: typeof raw.wording === 'string'
            ? raw.wording
            : typeof raw.name === 'string'
                ? raw.name
                : '',
        group: mapGroup(raw.group ?? raw.categoryGroup),
        type: typeof raw.type === 'string' ? raw.type : undefined,
        isActive: typeof raw.isActive === 'boolean'
            ? raw.isActive
            : typeof raw.active === 'boolean'
                ? raw.active
                : undefined,
        investment: mapInvestmentDefaults(raw.investment),
    };
}

export function mapCategories(raw: RawCategoryDTO[]): CategoryDTO[] {
    return raw.map(mapCategory);
}

/**
 * The provider's contextual-category routes return only numeric IDs, unlike
 * the complete catalogue route which returns category records. Keep that
 * boundary explicit so contextual responses can never be mistaken for the
 * curated catalogue DTO.
 */
export type ContextualCategoryIds = number[];

/** Parse a bounded, unique list of provider category IDs or fail closed. */
export function parseContextualCategoryIds(raw: unknown): ContextualCategoryIds {
    if (!Array.isArray(raw) || raw.length > MAX_PREFLIGHT_RESULTS) {
        throw new Error("Contextual category IDs were incomplete.");
    }

    const ids = new Set<number>();
    for (const candidate of raw) {
        if (!isPositiveSafeInteger(candidate) || ids.has(candidate)) {
            throw new Error("Contextual category IDs were incomplete.");
        }
        ids.add(candidate);
    }
    return [...ids];
}

