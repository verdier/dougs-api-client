import { Client } from '../client';
import { assertPositiveSafeInteger, isIsoDate } from './validation';

/**
 * Detailed balance pair (single period + previous period).
 * Structure as returned by Dougs for all `/stats/*` endpoints that compare
 * the current fiscal year to the previous one.
 */
export interface StatsComparisonDTO<T = unknown> {
    current: T;
    previous?: T;
}

/**
 * Generic stats breakdown entry. Dougs returns various shapes depending on the
 * endpoint; we keep them as `unknown` and let callers introspect. Common keys
 * are `name`, `label`, `amount`, `items`, `details`.
 */
export type StatsPayload = Record<string, unknown>;

/**
 * Entry of the accounting series catalogue (returned by `listSeries()`).
 * Each serie can later be fetched via `getSerieValues()`.
 */
export interface AccountingSerieDTO {
    id?: number | string;
    name?: string;
    label?: string;
    namespace?: string;
    categoryGroupLabel?: string;
    [key: string]: unknown;
}

/**
 * Aging balance (balance âgée) – breakdown of unpaid invoices by age buckets.
 */
export interface AgingBalanceDTO {
    customerRanges?: unknown;
    globalRanges?: unknown;
    [key: string]: unknown;
}

/**
 * Charges sociales (cotisations) for the company's employees / TNS.
 */
export interface SocialChargesDTO {
    minSocialCharges?: number;
    maxSocialCharges?: number;
    totalRemuneration?: number;
    dsnFile?: unknown;
    dsnTotal?: number;
    employees?: unknown[];
    [key: string]: unknown;
}

/**
 * Rémunération thresholds (seuils PUMA, retraite, IJ) + partners data.
 */
export interface RemunerationsDTO {
    thresholdPuma?: number;
    thresholdPumaDate?: string;
    thresholdRetirement?: number;
    thresholdRetirementDate?: string;
    thresholdIJ?: number;
    thresholdIJDate?: string;
    partners?: unknown[];
    [key: string]: unknown;
}

/**
 * VAT status snapshot.
 */
export interface SuiviTvaDTO {
    turnover?: number;
    threshold?: number;
    nextPayment?: unknown;
    nextDeclarations?: unknown[];
    [key: string]: unknown;
}

/**
 * Corporate income tax (IS) status snapshot.
 */
export interface SuiviImpotsSocietesDTO {
    value?: number;
    paidIs?: number;
    date?: string;
    nextPayment?: unknown;
    nextDeclarations?: unknown[];
    [key: string]: unknown;
}

/**
 * CFE (Cotisation Foncière des Entreprises) status snapshot.
 */
export interface SuiviCfeDTO {
    currentCfe?: number;
    yearsSinceRegistration?: number;
    previousCfeAmount?: number;
    estimatedCfeAmount?: number;
    [key: string]: unknown;
}

/**
 * Query: fiscal-year-scoped stats accept (at minimum) an accountingYearId.
 * Some also accept `showPreviousAccountingYear`.
 */
export interface PerformanceYearQuery {
    /** Target a specific fiscal year. Required by most stats endpoints. */
    accountingYearId: number;
    /** Ask Dougs to also return previous-year figures. */
    showPreviousAccountingYear?: boolean;
}

/**
 * Query for `getSupplierCharges()` – custom window with previous-window comparison.
 */
export interface SupplierChargesQuery {
    startDate: string;
    endDate: string;
    previousStartDate?: string;
    previousEndDate?: string;
}

/**
 * Access the "Performance" tab data for a company: structured compte de
 * résultat, chiffre d'affaires, charges, trésorerie, fonds propres, suivi
 * TVA/IS/CFE, rémunérations, balance âgée, séries comptables.
 *
 * These endpoints power the Dougs web app "Performance" dashboard. They
 * complement `accounting.getIncomeStatement()` (which uses the legacy
 * `/accounting-stats` endpoint) with more granular, fiscal-year-bounded
 * breakdowns.
 *
 * Note: Dougs does NOT expose a sector-benchmark endpoint to end-user accounts.
 * The "comparison with sector competitors" feature visible in the UI is
 * computed client-side from public INSEE data, not served by the API.
 *
 * @mountPath performance
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface PerformanceEndpointParams {
    companyId: number;
}

/**
 * Access the "Performance" tab data for a company.
 *
 * @mountPath performance
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface PerformanceEndpoint {
    /** List all accounting series available for `getSerieValues()`. */
    listSeries(): Promise<AccountingSerieDTO[]>;

    /**
     * Fetch a time-series of values for a given accounting serie.
     * @param serieId - ID of the serie (see `listSeries()`).
     * @param query - Fiscal-year scoping + extra flags.
     */
    getSerieValues(serieId: string | number, query: PerformanceYearQuery): Promise<unknown>;

    /** Chiffre d'affaires monthly breakdown for a fiscal year. */
    getChiffreDAffaires(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /**
     * Structured compte de résultat (P&L) with all sub-groups expanded.
     * Richer than `accounting.getIncomeStatement()` – includes the detailed
     * balances the Dougs "Performance" tab renders.
     */
    getCompteDeResultat(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Résultat d'exploitation (EBIT) breakdown. */
    getResultatDExploitation(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Charges d'exploitation breakdown. */
    getChargesDExploitation(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Cash-flow statement (flux de trésorerie). */
    getFluxDeTresorerie(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Fonds propres / equity breakdown. */
    getFondsPropres(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Live treasury stats. */
    getTresorerie(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Expense breakdown. */
    getRepartitionDesCharges(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Comptes d'associés (associate accounts) breakdown. */
    getComptesDAssocies(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** Autres réserves & reports à nouveau. */
    getAutresReservesReportsANouveaux(query: PerformanceYearQuery): Promise<StatsComparisonDTO>;

    /** VAT status snapshot. */
    getSuiviTva(query: PerformanceYearQuery): Promise<SuiviTvaDTO>;

    /** IS (corporate income tax) status snapshot. */
    getSuiviImpotsSocietes(query: PerformanceYearQuery): Promise<SuiviImpotsSocietesDTO>;

    /** CFE status snapshot. */
    getSuiviCfe(query: PerformanceYearQuery): Promise<SuiviCfeDTO>;

    /** Social charges (cotisations) totals for the company. */
    getSocialCharges(): Promise<SocialChargesDTO>;

    /** TNS social charges. */
    getTnsSocialCharges(): Promise<StatsPayload>;

    /** Rémunérations + PUMA/retraite/IJ thresholds. */
    getRemunerations(query: PerformanceYearQuery): Promise<RemunerationsDTO>;

    /** Rémunérations breakdown for the selected accounting year. */
    getRemunerationsForAccountingYear(query: PerformanceYearQuery): Promise<StatsPayload>;

    /** Aging balance of customer invoices. */
    getAgingBalance(): Promise<AgingBalanceDTO>;

    /** Suppliers charges over a custom window. */
    getSuppliersCharges(query: SupplierChargesQuery): Promise<StatsPayload>;
}

function buildYearQuery(q: PerformanceYearQuery): Record<string, unknown> {
    const out: Record<string, unknown> = { accountingYearId: q.accountingYearId };
    if (q.showPreviousAccountingYear) out.showPreviousAccountingYear = true;
    return out;
}

function assertSupplierChargesQuery(query: SupplierChargesQuery): void {
    const { startDate, endDate, previousStartDate, previousEndDate } = query;
    if (!isIsoDate(startDate)
        || !isIsoDate(endDate)
        || startDate > endDate
        || (previousStartDate === undefined) !== (previousEndDate === undefined)
        || (previousStartDate !== undefined && previousEndDate !== undefined
            && (!isIsoDate(previousStartDate) || !isIsoDate(previousEndDate)
                || previousStartDate > previousEndDate))) {
        throw new Error('Invalid supplier charges date range.');
    }
}

export const makePerformanceEndpoint = (
    client: Client,
    { companyId }: PerformanceEndpointParams,
): PerformanceEndpoint => {
    assertPositiveSafeInteger(companyId);
    const base = `/companies/${companyId}`;

    return {
        listSeries: () => client.get(`${base}/stats/series?namespace=accounting`),

        getSerieValues: (serieId, query) =>
            client.get(`${base}/stats/series/${serieId}/values`, buildYearQuery(query)),

        getChiffreDAffaires: query =>
            client.get(`${base}/stats/chiffre-d-affaires`, buildYearQuery(query)),

        getCompteDeResultat: query => {
            const p = buildYearQuery(query);
            p.expand = true;
            return client.get(`${base}/stats/compte-de-resultat`, p);
        },

        getResultatDExploitation: query =>
            client.get(`${base}/stats/resultat-d-exploitation`, buildYearQuery(query)),

        getChargesDExploitation: query =>
            client.get(`${base}/stats/charges-d-exploitation`, buildYearQuery(query)),

        getFluxDeTresorerie: query =>
            client.get(`${base}/stats/flux-de-tresorerie`, buildYearQuery(query)),

        getFondsPropres: query =>
            client.get(`${base}/stats/fonds-propres`, buildYearQuery(query)),

        getTresorerie: query =>
            client.get(`${base}/stats/tresorerie`, buildYearQuery(query)),

        getRepartitionDesCharges: query =>
            client.get(`${base}/stats/repartition-des-charges`, buildYearQuery(query)),

        getComptesDAssocies: query =>
            client.get(`${base}/stats/comptes-d-associes`, buildYearQuery(query)),

        getAutresReservesReportsANouveaux: query =>
            client.get(`${base}/stats/autres-reserves-reports-a-nouveau`, buildYearQuery(query)),

        getSuiviTva: query => client.get(`${base}/stats/suivi-tva`, buildYearQuery(query)),

        getSuiviImpotsSocietes: query =>
            client.get(`${base}/stats/suivi-impots-societes`, buildYearQuery(query)),

        getSuiviCfe: query => client.get(`${base}/stats/suivi-cfe`, buildYearQuery(query)),

        getSocialCharges: () => client.get(`${base}/stats/social-charges`),

        getTnsSocialCharges: () => client.get(`${base}/stats/tns-social-charges`),

        getRemunerations: query =>
            client.get(`${base}/stats/remunerations`, buildYearQuery(query)),

        getRemunerationsForAccountingYear: query =>
            client.get(`${base}/stats/remunerations-for-accounting-year`, buildYearQuery(query)),

        getAgingBalance: () => client.get(`${base}/invoice-stats/aging-balance`),

        getSuppliersCharges: query => {
            assertSupplierChargesQuery(query);
            return client.get(`${base}/stats/suppliers-charges`, query);
        },
    };
};
