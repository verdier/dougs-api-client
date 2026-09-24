import { Client } from '../client';
import { mapCategories, type RawCategoryDTO } from './categories.map';
import { assertPositiveSafeInteger } from './validation';

/** Curated category group. */
export interface CategoryGroupDTO {
    id: number;
    name: string;
}

/** Investment defaults advertised by an active investment category, when present. */
export interface CategoryInvestmentDefaultsDTO {
    type?: string;
    duration?: number;
    ratio?: number | null;
}

/** Curated accounting category. */
export interface CategoryDTO {
    id: number;
    wording: string;
    group?: CategoryGroupDTO;
    type?: string;
    isActive?: boolean;
    investment?: CategoryInvestmentDefaultsDTO;
}

export interface CategoryEndpointParams {
    companyId: number;
}

/** Company accounting-category catalogue. */
export interface CategoryEndpoint {
    /** Retrieve the complete company category catalogue. */
    getAll(): Promise<CategoryDTO[]>;
}

export const makeCategoryEndpoint = (
    client: Client,
    { companyId }: CategoryEndpointParams,
): CategoryEndpoint => {
    assertPositiveSafeInteger(companyId);
    const basePath = `/companies/${companyId}/categories`;

    return {
        // `full=true` is intentional: it is the confirmed complete-catalogue route.
        getAll: () => client.get<RawCategoryDTO[]>(basePath, { full: true }).then(mapCategories),
    };
};
