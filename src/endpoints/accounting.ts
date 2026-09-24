import type {
    RawAccountingYearDTO,
    RawAccountingStatsDTO,
    RawTreasuryAccountDTO,
    RawCompanySummaryDTO,
} from './accounting.map';
import {
    mapAccountingYear,
    mapAccountingYears,
    mapIncomeStatement,
    mapTreasuryAccounts,
    mapCompanySummary,
} from './accounting.map';
import { Client } from '../client';
import { assertPositiveSafeInteger } from './validation';

/**
 * Fiscal / accounting year summary.
 */
export interface AccountingYearDTO {
    id: number;
    companyId: number;
    /** 0-based index of the accounting year (0 = first). */
    accountingIndex: number;
    /** ID of the closing task in Dougs backoffice. */
    closingTaskId?: number;
    /** ISO date (YYYY-MM-DD). */
    openingDate: string;
    /** ISO date (YYYY-MM-DD). */
    closingDate: string;
    /** Whether the year is officially closed (bilan filed). */
    closed: boolean;
    /** True if no previous accounting year exists. */
    isCompanyFirstAccountingYear?: boolean;
    /** Cash vs accrual accounting regime. */
    accountingType?: 'cash' | 'accrual';
    /** True if closing is late. */
    isLate?: boolean;
    /** Liquidation date if the year ended by liquidation. */
    liquidationDate?: string | null;
}

/**
 * Reference to a balance-sheet PDF attached to an accounting year.
 */
export interface AccountingYearDocumentDTO {
    /** File UUID (use with /files/<uuid>/actions/download). */
    uuid?: string;
    /** Download URL relative to apiServerUrl. */
    url?: string;
    /** Filename as stored in Dougs. */
    name?: string;
    /** MIME type. */
    mimeType?: string;
    /** Page-level bookmarks (e.g. "Bilan Actif", "Bilan Passif", "Compte de résultat"). */
    bookmarks?: Array<{ label: string; pages: number[] }>;
}

/**
 * Full accounting year with document references (used to download the bilan PDF).
 */
export interface AccountingYearDetailDTO extends AccountingYearDTO {
    /** Effective closing date (may differ from `closingDate` on liquidation). */
    effectiveClosingDate?: string;
    /** Number of days in the fiscal year. */
    fiscalDayCount?: number;
    /** True if this is the currently-active year. */
    isCurrent?: boolean;
    /** True if the fiscal year is shifted (not calendar year). */
    isShifted?: boolean;
    /** URL of the closing survey in the Dougs web app. */
    accountingSurveyUrl?: string;
    /** URL of the company in the Dougs web app. */
    companyUrl?: string;
    /** Liasse fiscale PDF(s) (actif, passif, compte de résultat, annexes). */
    balanceSheetDocuments: AccountingYearDocumentDTO[];
    /** Tax filing EDI documents. */
    taxReportDocuments: AccountingYearDocumentDTO[];
    /** FEC export file(s). */
    fecExports: AccountingYearDocumentDTO[];
    /** Other supporting documents. */
    documents: AccountingYearDocumentDTO[];
    /** Final print bundles (PDFs). */
    finalPrints: AccountingYearDocumentDTO[];
}

/**
 * One line in the income statement (e.g. sales, productionCosts, financialIncomes).
 * `details[]` contains the underlying accounting categories (plan comptable ranges).
 */
export interface IncomeStatementBalanceDTO {
    name: string;
    label: string;
    amount: number;
    percentage?: number;
    details?: Array<{
        categoryId?: number;
        categoryGroupId?: number;
        categoryGroupLabel?: string;
        accountingNumbers?: number[];
        amount: number;
        label?: string;
    }>;
}

/**
 * Group of balances aggregated together (inbound revenues, outbound costs,
 * gross margin, EBITDA, operating income, current result, fiscal result).
 */
export interface IncomeStatementGroupDTO {
    name: string;
    label: string;
    amount: number;
    balances: Record<string, IncomeStatementBalanceDTO>;
}

/**
 * Cumulative totals over a period.
 * Keys: inbound, outbound, grossMargin, ebitda, operatingIncome, currentResult, fiscalResult.
 */
export type IncomeStatementCumulativeDTO = Record<string, IncomeStatementGroupDTO>;

/**
 * Monthly breakdown of the income statement.
 */
export interface IncomeStatementPeriodDTO {
    /** Period start date (ISO). */
    date: string;
    /** Accounting year this period belongs to. */
    accountingYearId?: number;
    /** Aggregates for the period. */
    groups: Record<string, IncomeStatementGroupDTO>;
}

/**
 * Compte de résultat – structured P&L for a given fiscal year.
 */
export interface IncomeStatementDTO {
    /** The accounting year this statement belongs to. */
    accountingYear: AccountingYearDTO;
    /** Monthly breakdown (one entry per month within the analysis window). */
    periods: IncomeStatementPeriodDTO[];
    /** Year-to-date cumulative totals. */
    cumulativeData: IncomeStatementCumulativeDTO;
    /** Previous accounting year totals for comparison (if available). */
    previousYearCumulativeData?: IncomeStatementCumulativeDTO;
    /** Analysis window start (ISO). */
    analysisMinDate: string;
    /** Analysis window end (ISO). */
    analysisMaxDate: string;
    /** Year-over-year sales (previous year). */
    previousSales?: number;
    /** Year-over-year charges (previous year). */
    previousCharges?: number;
    /** Estimated corporate income taxes. */
    corporateIncomeTaxes?: number;
}

/**
 * Treasury / bank account with live balance.
 */
export interface TreasuryAccountDTO {
    id: number;
    /** Short account name (e.g. "CIC"). */
    name: string;
    /** Detailed account name including type. */
    subName?: string;
    /** Account type (synchronizedAccount, savingsAccount, …). */
    type: string;
    /** Account subtype (checking, savings, …). */
    subtype?: string;
    /** Plan-comptable number (e.g. "512001"). */
    accountNumber: string;
    /** Masked IBAN/account number. */
    number?: string;
    /** Current balance (euros). */
    balance: number;
    /** Cumulative debit total. */
    debit?: number;
    /** Cumulative credit total. */
    credit?: number;
    /** Currency code (e.g. "EUR"). */
    currency?: string;
    /** Whether the account is hidden from the dashboard. */
    hidden?: boolean;
    /** Date when the account was closed (null if still active). */
    closedAt?: string | null;
    /** Free-text memo. */
    memo?: string | null;
}

/**
 * Narrative description block in a company summary.
 */
export interface CompanySummaryBlockDTO {
    title?: string | null;
    type?: string;
    data: string[];
}

/**
 * Textual company summary for a given fiscal year.
 */
export interface CompanySummaryDTO {
    title: string;
    blocks: CompanySummaryBlockDTO[];
}

/**
 * Query parameters for `getIncomeStatement`.
 */
export interface IncomeStatementQuery {
    /** Target a specific fiscal year (defaults to the current year if omitted). */
    accountingYearId?: number;
}

/**
 * Access accounting statements (compte de résultat, trésorerie, bilan documents).
 *
 * Notes:
 * - Dougs does **not** expose a structured balance-sheet (actif/passif) endpoint
 *   to end-user accounts. The bilan is only available as a PDF (liasse fiscale)
 *   attached to the accounting year – see `getFiscalYear().balanceSheetDocuments`.
 * - Trial balance (`ledgers`) is reserved to Dougs accountants (role
 *   `collaborator`) and returns 403 for end users.
 *
 * @mountPath accounting
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface AccountingEndpointParams {
    companyId: number;
}

/**
 * Access accounting statements (compte de résultat, trésorerie, bilan documents).
 *
 * Notes:
 * - Dougs does **not** expose a structured balance-sheet (actif/passif) endpoint
 *   to end-user accounts. The bilan is only available as a PDF (liasse fiscale)
 *   attached to the accounting year – see `getFiscalYear().balanceSheetDocuments`.
 * - Trial balance (`ledgers`) is reserved to Dougs accountants (role
 *   `collaborator`) and returns 403 for end users.
 *
 * @mountPath accounting
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface AccountingEndpoint {
    /**
     * Retrieve the list of fiscal years of the company, ordered chronologically.
     * @returns All accounting years (closed and current).
     */
    getFiscalYears(): Promise<AccountingYearDTO[]>;

    /**
     * Retrieve a single fiscal year with document references (bilan PDF,
     * tax filings, FEC export, etc.).
     * @param yearId - ID of the fiscal year.
     * @returns The fiscal year with its attached documents.
     */
    getFiscalYear(yearId: number): Promise<AccountingYearDetailDTO>;

    /**
     * Retrieve the structured income statement (compte de résultat) for a
     * fiscal year. Returns year-to-date cumulatives, monthly breakdown, and
     * previous-year comparison.
     * @param query - Optional filter (defaults to the current fiscal year).
     * @returns The income statement for the selected year.
     */
    getIncomeStatement(query?: IncomeStatementQuery): Promise<IncomeStatementDTO>;

    /**
     * Retrieve the current treasury accounts (bank + savings) with live balances.
     * @returns All treasury accounts attached to the company.
     */
    getTreasuryAccounts(): Promise<TreasuryAccountDTO[]>;

    /**
     * Retrieve the narrative company summary for a given fiscal year
     * (legal form, capital, directors, activity, tax regime, …).
     * @param yearId - ID of the fiscal year.
     * @returns The textual company summary.
     */
    getCompanySummary(yearId: number): Promise<CompanySummaryDTO>;
}

export const makeAccountingEndpoint = (
    client: Client,
    { companyId }: AccountingEndpointParams,
): AccountingEndpoint => {
    assertPositiveSafeInteger(companyId);
    const companyPath = `/companies/${companyId}`;

    return {
        getFiscalYears: () =>
            client
                .get<RawAccountingYearDTO[]>(`${companyPath}/accounting-years`)
                .then(mapAccountingYears),

        getFiscalYear: (yearId: number) =>
            client
                .get<RawAccountingYearDTO>(`${companyPath}/accounting-years/${yearId}`)
                .then(mapAccountingYear),

        getIncomeStatement: (query?: IncomeStatementQuery) =>
            client
                .get<RawAccountingStatsDTO>(`${companyPath}/accounting-stats`, query)
                .then(mapIncomeStatement),

        getTreasuryAccounts: () =>
            client
                .get<RawTreasuryAccountDTO[]>(`${companyPath}/treasury-accounts`)
                .then(mapTreasuryAccounts),

        getCompanySummary: (yearId: number) =>
            client
                .get<RawCompanySummaryDTO>(`${companyPath}/accounting-years/${yearId}/company-summary`)
                .then(mapCompanySummary),
    };
};
