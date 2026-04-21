import { Client } from '../client';
import { mapCompany, RawCompanyDTO } from './company.map';

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
 * Partner (associé) of a company.
 * Source: GET /companies/:id/partners
 */
export interface PartnerDTO {
    id: number;
    companyId: number;
    legalPersonId: number | null;
    naturalPersonId: number | null;
    isCeo: boolean;
    isAssociate: boolean;
    isEmployee: boolean;
    associateIndex: number | null;
    affiliateIndex: number | null;
    metadata?: {
        associate?: {
            shareCount?: number;
        };
    };
    naturalPerson?: {
        firstName?: string;
        lastName?: string;
        email?: string;
    } | null;
    legalPerson?: {
        name?: string;
        vatNumber?: string;
        legalForm?: string;
    } | null;
}

/**
 * Manage basic company information and partners.
 * @mountPath companies
 */
export interface CompanyEndpoint {
    /**
     * Retrieve details for a specific company.
     * @param id - ID of the company to retrieve.
     * @returns usage details of the requested company.
     */
    getOne(id: number): Promise<CompanyDTO>;

    /**
     * List all partners (associés) of a company with their share counts and CCA account numbers.
     * Cross with performance_get_comptes_dassocies to resolve CCA balances per partner.
     * @param companyId - Dougs company ID (LVC=2887, BDV=20064, Satya=185000)
     * @returns Array of partners with natural/legal person details and share metadata.
     */
    getPartners(companyId: number): Promise<PartnerDTO[]>;
}

export const makeCompanyEndpoint = (client: Client): CompanyEndpoint => {
    return {
        getOne: (id: number) => client.get<RawCompanyDTO>(`/companies/${id}`).then(mapCompany),
        getPartners: (companyId: number) => client.get<PartnerDTO[]>(`/companies/${companyId}/partners`),
    };
};

