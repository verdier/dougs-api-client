import { CompanyDTO } from './company';

/**
 * Raw Company DTO as returned by the Dougs API.
 */
export interface RawCompanyDTO {
    id: number;
    name: string;
    siren?: string;
    siret?: string;
    vatNumber?: string;
    vatNumberKey?: string;
    tvaNumber?: string;
    activity?: string;
    activityCode?: string;
    address: string;
    zipCode: string;
    city: string;
    country?: string;
    legalForm: string;
    legalForms?: any[];
    capital: number;
    creationDate: string;
    closingDate: string;
    accountingStartDate: string;
    isIntegration: boolean;
    integrationId?: number;
    hasMultipleBankAccounts: boolean;
    hasMultipleAssociates: boolean;
    hasPayroll: boolean;
    hasVat: boolean;
    vatPeriod?: string;
    vatRegime?: string;
    vatConfiguration?: any;
    vatConfigurations?: any[];
    isSubjectToVat: boolean;
    legalFormConfig?: any;
    taxRegime?: string;
    taxRegimes?: any[];
    category?: string;
    accountingConfiguration?: any;
    metadata?: any;
    accountingYearsUrl?: string;
    accountsUrl?: string;
    operationsUrl?: string;
    [key: string]: any;
}

/**
 * Maps raw API response to filtered CompanyDTO.
 */
export function mapCompany(raw: RawCompanyDTO): CompanyDTO {
    return {
        id: raw.id,
        name: raw.name,
        siren: raw.siren,
        siret: raw.siret,
        tvaNumber: raw.tvaNumber ?? raw.vatNumber,
        activity: raw.activity,
        activityCode: raw.activityCode,
        address: raw.address,
        zipCode: raw.zipCode,
        city: raw.city,
        legalForm: raw.legalForm,
        capital: raw.capital,
        creationDate: raw.creationDate,
        closingDate: raw.closingDate,
        accountingStartDate: raw.accountingStartDate,
        isIntegration: raw.isIntegration,
        integrationId: raw.integrationId,
        hasMultipleBankAccounts: raw.hasMultipleBankAccounts,
        hasMultipleAssociates: raw.hasMultipleAssociates,
        hasPayroll: raw.hasPayroll,
        hasVat: raw.hasVat,
        vatPeriod: raw.vatPeriod,
        vatRegime: raw.vatRegime,
        isSubjectToVat: raw.isSubjectToVat,
        legalFormConfig: raw.legalFormConfig,
        taxRegime: raw.taxRegime,
        accountingYearsUrl: raw.accountingYearsUrl,
        accountsUrl: raw.accountsUrl,
        operationsUrl: raw.operationsUrl,
    };
}
