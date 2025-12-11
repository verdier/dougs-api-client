import { Client } from '../client';

export interface CompanyDTO {
    id: number;
    name: string;
    siren?: string;
    siret?: string;
    tvaNumber?: string;
    activity?: string;
    activityCode?: string;
    address: string;
    zipCode: string;
    city: string;
    legalForm: string;
    capital: number;
    creationDate: string; // ISO Date
    closingDate: string; // MM-DD
    accountingStartDate: string; // ISO Date
    isIntegration: boolean;
    integrationId?: number;
    hasMultipleBankAccounts: boolean;
    hasMultipleAssociates: boolean;
    hasPayroll: boolean;
    hasVat: boolean;
    vatPeriod?: string;
    vatRegime?: string;
    isSubjectToVat: boolean;
    legalFormConfig?: any; // Complex object
    taxRegime?: string;
    accountingYearsUrl?: string;
    accountsUrl?: string;
    operationsUrl?: string;
    // Add other relevant URLs or flags as needed
}

/**
 * Manage basic company information.
 */
export interface CompanyEndpoint {
    /**
     * Retrieve all available companies for the authenticated user.
     * @returns List of companies.
     */
    getAll(): Promise<CompanyDTO[]>;

    /**
     * Retrieve details for a specific company.
     * @param id - ID of the company to retrieve.
     * @returns usage details of the requested company.
     */
    getOne(id: number): Promise<CompanyDTO>;
}

export const makeCompanyEndpoint = (client: Client): CompanyEndpoint => {
    return {
        getAll: () => client.get<CompanyDTO[]>('/companies'),
        getOne: (id: number) => client.get<CompanyDTO>(`/companies/${id}`)
    };
};
