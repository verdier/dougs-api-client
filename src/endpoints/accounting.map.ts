import type {
    AccountingYearDTO,
    AccountingYearDetailDTO,
    AccountingYearDocumentDTO,
    CompanySummaryBlockDTO,
    CompanySummaryDTO,
    IncomeStatementBalanceDTO,
    IncomeStatementCumulativeDTO,
    IncomeStatementDTO,
    IncomeStatementGroupDTO,
    IncomeStatementPeriodDTO,
    TreasuryAccountDTO,
} from './accounting';

/**
 * Raw accounting year DTO returned by Dougs.
 * Also used for the detail endpoint – extra fields are then populated.
 */
export interface RawAccountingYearDTO {
    id: number;
    companyId: number;
    accountingIndex: number;
    closingTaskId?: number;
    openingDate: string;
    closingDate: string;
    closed: boolean;
    liquidationDate?: string | null;
    isCompanyFirstAccountingYear?: boolean | null;
    isLate?: boolean;
    accountingType?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
    isCurrent?: boolean;
    isFirst?: boolean;
    isShifted?: boolean;
    fiscalDayCount?: number;
    effectiveClosingDate?: string;
    isTaxReturnComputedByDougs?: boolean;
    companyUrl?: string;
    accountingSurveyUrl?: string;

    // Document-bearing fields (only populated by the detail endpoint).
    journal?: RawDocumentHolder | null;
    previousAccountantFec?: RawDocumentHolder | null;
    fecExports?: RawDocumentHolder[] | null;
    documents?: RawDocumentHolder[] | null;
    accountingYearBalanceSheets?: RawDocumentHolder[] | null;
    accountingYearTaxReportEdis?: RawDocumentHolder[] | null;
    previousAccountantDocuments?: RawDocumentHolder[] | null;
    finalPrints?: RawDocumentHolder[] | null;
    finalPrintZips?: RawDocumentHolder[] | null;
    closingTaskBalanceSheets?: RawDocumentHolder[] | null;
    supervisionHelperDocuments?: RawDocumentHolder[] | null;
    generalAssemblies?: RawDocumentHolder[] | null;
    companyTaxes?: unknown;
    refundCompanyTaxes?: unknown;

    [key: string]: unknown;
}

interface RawDocumentHolder {
    metadata?: {
        bookmarks?: Array<{ label: string; pages: number[]; priority?: number }>;
        [key: string]: unknown;
    };
    file?: RawFile;
    [key: string]: unknown;
}

interface RawFile {
    uuid?: string;
    url?: string;
    name?: string;
    extension?: string;
    [key: string]: unknown;
}

/**
 * Raw response of `GET /companies/:id/accounting-stats`.
 */
export interface RawAccountingStatsDTO {
    periods?: RawStatsPeriod[];
    cumulativeData?: Record<string, RawStatsGroup>;
    accountingYearStats?: {
        accountingYear?: RawAccountingYearDTO;
        cumulativeData?: Record<string, RawStatsGroup>;
        charges?: number;
        previousSales?: number;
        previousCharges?: number;
        previousOperatingIncome?: number;
        corporateIncomeTaxes?: number;
        [key: string]: unknown;
    };
    previousAccountingYearStats?: {
        accountingYear?: RawAccountingYearDTO;
        cumulativeData?: Record<string, RawStatsGroup>;
        [key: string]: unknown;
    };
    analysisMinDate?: string;
    analysisMaxDate?: string;
}

interface RawStatsPeriod {
    date: string;
    accountingYearId?: number;
    groups: Record<string, RawStatsGroup>;
}

interface RawStatsGroup {
    name: string;
    label: string;
    amount: number;
    balances?: Record<string, RawStatsBalance> | string[];
}

interface RawStatsBalance {
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
 * Raw treasury account DTO.
 */
export interface RawTreasuryAccountDTO {
    id: number;
    name: string;
    subName?: string;
    type: string;
    subtype?: string;
    accountNumber: string;
    number?: string;
    balance: number;
    debit?: number;
    credit?: number;
    currency?: string;
    color?: string;
    hidden?: boolean;
    closedAt?: string | null;
    memo?: string | null;
    startDate?: string;
    [key: string]: unknown;
}

/**
 * Raw company summary DTO.
 * Dougs returns `{ title, description: { data: [...] }, ... }` where
 * additional named blocks can appear alongside `description`.
 */
export interface RawCompanySummaryDTO {
    title?: string;
    [key: string]: unknown;
}

interface RawCompanySummaryBlock {
    title?: string | null;
    type?: string;
    data?: string[] | unknown;
}

function mapAccountingYearBase(raw: RawAccountingYearDTO): AccountingYearDTO {
    return {
        id: raw.id,
        companyId: raw.companyId,
        accountingIndex: raw.accountingIndex,
        closingTaskId: raw.closingTaskId,
        openingDate: raw.openingDate,
        closingDate: raw.closingDate,
        closed: raw.closed,
        isCompanyFirstAccountingYear: raw.isCompanyFirstAccountingYear ?? undefined,
        accountingType: raw.accountingType as 'cash' | 'accrual' | undefined,
        isLate: raw.isLate,
        liquidationDate: raw.liquidationDate ?? null,
    };
}

function mapDocument(raw: RawDocumentHolder | null | undefined): AccountingYearDocumentDTO | null {
    if (!raw || !raw.file) return null;
    const file = raw.file;
    return {
        uuid: file.uuid,
        url: file.url,
        name: file.name,
        mimeType: typeof file['mimeType'] === 'string' ? (file['mimeType'] as string) : undefined,
        bookmarks: raw.metadata?.bookmarks?.map(b => ({ label: b.label, pages: b.pages })),
    };
}

function mapDocuments(raw: RawDocumentHolder[] | null | undefined): AccountingYearDocumentDTO[] {
    if (!raw) return [];
    return raw.map(mapDocument).filter((d): d is AccountingYearDocumentDTO => d !== null);
}

export function mapAccountingYear(raw: RawAccountingYearDTO): AccountingYearDetailDTO {
    const base = mapAccountingYearBase(raw);
    const journalDoc = mapDocument(raw.journal);
    const extraDocs = [...(raw.documents ?? [])];
    if (journalDoc) extraDocs.push(raw.journal as RawDocumentHolder);

    return {
        ...base,
        effectiveClosingDate: raw.effectiveClosingDate,
        fiscalDayCount: raw.fiscalDayCount,
        isCurrent: raw.isCurrent,
        isShifted: raw.isShifted,
        accountingSurveyUrl: raw.accountingSurveyUrl,
        companyUrl: raw.companyUrl,
        balanceSheetDocuments: mapDocuments(raw.accountingYearBalanceSheets),
        taxReportDocuments: mapDocuments(raw.accountingYearTaxReportEdis),
        fecExports: mapDocuments(raw.fecExports),
        documents: mapDocuments(raw.documents),
        finalPrints: mapDocuments(raw.finalPrints),
    };
}

export function mapAccountingYears(raw: RawAccountingYearDTO[]): AccountingYearDTO[] {
    return raw
        .map(mapAccountingYearBase)
        .sort((a, b) => a.openingDate.localeCompare(b.openingDate));
}

function mapStatsBalance(raw: RawStatsBalance): IncomeStatementBalanceDTO {
    return {
        name: raw.name,
        label: raw.label,
        amount: raw.amount,
        percentage: raw.percentage,
        details: raw.details?.map(d => ({
            categoryId: d.categoryId,
            categoryGroupId: d.categoryGroupId,
            categoryGroupLabel: d.categoryGroupLabel,
            accountingNumbers: d.accountingNumbers,
            amount: d.amount,
            label: d.label,
        })),
    };
}

function mapStatsGroup(raw: RawStatsGroup): IncomeStatementGroupDTO {
    const balances: Record<string, IncomeStatementBalanceDTO> = {};
    if (raw.balances && !Array.isArray(raw.balances)) {
        for (const [key, value] of Object.entries(raw.balances)) {
            balances[key] = mapStatsBalance(value);
        }
    }
    return {
        name: raw.name,
        label: raw.label,
        amount: raw.amount,
        balances,
    };
}

function mapCumulative(
    raw: Record<string, RawStatsGroup> | undefined,
): IncomeStatementCumulativeDTO {
    const out: IncomeStatementCumulativeDTO = {};
    if (!raw) return out;
    for (const [key, value] of Object.entries(raw)) {
        out[key] = mapStatsGroup(value);
    }
    return out;
}

function mapPeriod(raw: RawStatsPeriod): IncomeStatementPeriodDTO {
    const groups: Record<string, IncomeStatementGroupDTO> = {};
    for (const [key, value] of Object.entries(raw.groups)) {
        groups[key] = mapStatsGroup(value);
    }
    return {
        date: raw.date,
        accountingYearId: raw.accountingYearId,
        groups,
    };
}

export function mapIncomeStatement(raw: RawAccountingStatsDTO): IncomeStatementDTO {
    const rawYear = raw.accountingYearStats?.accountingYear;
    if (!rawYear) {
        throw new Error('accounting-stats response is missing accountingYearStats.accountingYear');
    }
    return {
        accountingYear: mapAccountingYearBase(rawYear),
        periods: (raw.periods ?? []).map(mapPeriod),
        cumulativeData: mapCumulative(raw.cumulativeData ?? raw.accountingYearStats?.cumulativeData),
        previousYearCumulativeData: raw.previousAccountingYearStats?.cumulativeData
            ? mapCumulative(raw.previousAccountingYearStats.cumulativeData)
            : undefined,
        analysisMinDate: raw.analysisMinDate ?? '',
        analysisMaxDate: raw.analysisMaxDate ?? '',
        previousSales: raw.accountingYearStats?.previousSales,
        previousCharges: raw.accountingYearStats?.previousCharges,
        corporateIncomeTaxes: raw.accountingYearStats?.corporateIncomeTaxes,
    };
}

export function mapTreasuryAccounts(raw: RawTreasuryAccountDTO[]): TreasuryAccountDTO[] {
    return raw.map(r => ({
        id: r.id,
        name: r.name,
        subName: r.subName,
        type: r.type,
        subtype: r.subtype,
        accountNumber: r.accountNumber,
        number: r.number,
        balance: r.balance,
        debit: r.debit,
        credit: r.credit,
        currency: r.currency,
        hidden: r.hidden,
        closedAt: r.closedAt ?? null,
        memo: r.memo ?? null,
    }));
}

export function mapCompanySummary(raw: RawCompanySummaryDTO): CompanySummaryDTO {
    const blocks: CompanySummaryBlockDTO[] = [];
    for (const [key, value] of Object.entries(raw)) {
        if (key === 'title') continue;
        if (!value || typeof value !== 'object') continue;
        const block = value as RawCompanySummaryBlock;
        if (!Array.isArray(block.data)) continue;
        blocks.push({
            title: block.title ?? key,
            type: block.type,
            data: block.data.filter((x): x is string => typeof x === 'string'),
        });
    }
    return {
        title: raw.title ?? '',
        blocks,
    };
}
