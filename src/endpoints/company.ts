import { Client } from '../client';
import { mapCompany } from './company.map';

/**
 * Company DTO.
 */
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
    hasVat: boolean;
    taxRegime?: string;
}

/**
 * Manage basic company information.
 * @mountPath companies
 */
export interface CompanyEndpoint {
    /**
     * Retrieve details for a specific company.
     * @param id - ID of the company to retrieve.
     * @returns usage details of the requested company.
     */
    getOne(id: number): Promise<CompanyDTO>;
}

export const makeCompanyEndpoint = (client: Client): CompanyEndpoint => {
    return {
        getOne: (id: number) => client.get(`/companies/${id}`, undefined, mapCompany)
    };
};
