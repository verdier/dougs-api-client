import { z } from "zod";
import type { DougsEndpoints } from "./index";
import {
    isIsoDate,
    isMoneyAmount,
    MAX_ACCOUNTING_MEMO_LENGTH,
    MAX_AMORTIZATION_RATIO,
    MAX_AMORTIZATION_YEAR_COUNT,
    MAX_INVESTMENT_NAME_LENGTH,
    MAX_KILOMETRIC_DISTANCE,
    MAX_LIST_LIMIT,
    MAX_LIST_OFFSET,
    MAX_LIST_PAGE,
    MAX_SEARCH_LENGTH,
    MIN_AMORTIZATION_RATIO,
    toMinorUnits,
} from "./endpoints/validation";

/** Transport-neutral safety metadata for action adapters (MCP, future CLI, etc.). */
export interface ActionSafety {
    readOnly: boolean;
    destructive: boolean;
    idempotent: boolean;
    openWorld: boolean;
}

export interface ActionDefinition<Input = unknown> {
    name: string;
    description: string;
    inputSchema: z.ZodType<Input>;
    safety: ActionSafety;
    execute(api: DougsEndpoints, input: Input): Promise<unknown> | unknown;
}

function defineAction<Name extends string, Schema extends z.ZodTypeAny>(definition: {
    name: Name;
    description: string;
    inputSchema: Schema;
    safety: ActionSafety;
    execute(api: DougsEndpoints, input: z.infer<Schema>): Promise<unknown> | unknown;
}): ActionDefinition<z.infer<Schema>> & { name: Name } {
    return definition;
}

const READ = Object.freeze({ readOnly: true, destructive: false, idempotent: true, openWorld: true });
const CREATE = Object.freeze({ readOnly: false, destructive: false, idempotent: false, openWorld: true });
const DELETE = Object.freeze({ readOnly: false, destructive: true, idempotent: true, openWorld: true });
const DESTRUCTIVE_WRITE = Object.freeze({ readOnly: false, destructive: true, idempotent: false, openWorld: true });
const LOCAL_READ = Object.freeze({ readOnly: true, destructive: false, idempotent: true, openWorld: false });

const accountingId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const companyId = accountingId.describe("ID of the company to operate on.");
const yearId = accountingId.describe("ID of the fiscal year.");
const invoiceId = z.string().uuid().describe("Canonical invoice UUID.");

/** Every public action input object rejects unknown keys, including nested objects. */
const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();

const emptyInput = strictObject({});
const companyInput = strictObject({ companyId });
const yearInput = strictObject({ companyId, yearId });
const incomeStatementInput = strictObject({
    companyId,
    query: strictObject({
        accountingYearId: z.number().optional().describe("Target a specific fiscal year."),
    }).optional(),
});
const invoiceListInput = strictObject({
    companyId,
    query: strictObject({
        page: z.number().int().min(1).max(MAX_LIST_PAGE).optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
    }).optional(),
});
const invoiceGetInput = strictObject({ companyId, id: invoiceId });
const operationAttachmentDownloadInput = strictObject({
    companyId,
    operationId: accountingId.describe("Operation ID."),
    attachmentId: accountingId.describe("Source-document attachment ID."),
});
const operationQuery = strictObject({
    limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional().describe("Max number of results to return."),
    offset: z.number().int().min(0).max(MAX_LIST_OFFSET).optional().describe("Number of results to skip."),
    validated: z.boolean().optional().describe("Filter by validation status."),
    q: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional().describe("General search query string."),
    "q-amount": z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional().describe("Filter by amount or amount range."),
    "q-date": z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional().describe("Filter by date (DD/MM/YYYY), partial date, or date range."),
    "q-isInbound": z.boolean().optional().describe("Filter by inbound/outbound status."),
});
const operationListInput = strictObject({ companyId, query: operationQuery.optional() });
const operationIdInput = strictObject({ companyId, id: accountingId.describe("Operation ID.") });
const kilometricInput = strictObject({
    companyId,
    data: strictObject({
        date: z.string().refine(isIsoDate, "Expected a real YYYY-MM-DD date.").describe("Date of the trip (YYYY-MM-DD)."),
        distance: z.number().finite().positive().max(MAX_KILOMETRIC_DISTANCE).describe("Distance traveled in kilometers."),
        memo: z.string().trim().min(1).max(MAX_ACCOUNTING_MEMO_LENGTH).optional().describe("Optional trip description."),
        carId: accountingId.optional().describe("ID of the car used."),
    }),
});
const performanceYearQuery = strictObject({
    accountingYearId: z.number().describe("Target fiscal year."),
    showPreviousAccountingYear: z.boolean().optional().describe("Also return previous-year figures."),
});
const performanceYearInput = strictObject({ companyId, query: performanceYearQuery });
const performanceSerieInput = strictObject({
    companyId,
    serieId: z.union([z.string(), z.number()]),
    query: performanceYearQuery,
});
const isoDate = z.string().refine(isIsoDate, "Expected a real YYYY-MM-DD date.");
const supplierChargesInput = strictObject({
    companyId,
    query: strictObject({
        startDate: isoDate,
        endDate: isoDate,
        previousStartDate: isoDate.optional(),
        previousEndDate: isoDate.optional(),
    }).superRefine((query, ctx) => {
        if (query.startDate > query.endDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "startDate must be on or before endDate." });
        }
        if ((query.previousStartDate === undefined) !== (query.previousEndDate === undefined)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Previous date range requires both dates." });
        } else if (query.previousStartDate && query.previousEndDate && query.previousStartDate > query.previousEndDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "previousStartDate must be on or before previousEndDate." });
        }
    }),
});
const positiveMoney = z.number().finite().refine(value => isMoneyAmount(value), "Expected a positive decimal amount.");
const nonNegativeMoney = z.number().finite().refine(value => isMoneyAmount(value, true), "Expected a non-negative decimal amount.");
const categoriesInput = strictObject({ companyId });
const availableCategoriesInput = strictObject({
    companyId,
    operationId: accountingId,
    breakdownId: accountingId,
    isRefund: z.boolean().optional(),
    search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
});
const associationName = z.string().trim().min(1).max(100);
const associationSlotName = z.string().trim().min(1).max(100);
const breakdownAssociationCandidatesInput = strictObject({
    companyId, operationId: accountingId, breakdownId: accountingId, associationName, slotName: associationSlotName,
    offset: z.number().int().min(0).max(MAX_LIST_OFFSET),
    search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
    limit: z.number().int().min(1).max(100).optional(),
});
const expectedUpdatedAt = z.string().trim().min(1).max(100).describe("Exact updatedAt token from the final operations_get_one read.");
const breakdownAddDetailInput = strictObject({ companyId, operationId: accountingId, expectedUpdatedAt });
const breakdownCategoryInput = strictObject({ companyId, operationId: accountingId, breakdownId: accountingId, categoryId: accountingId, expectedUpdatedAt });
const breakdownAmountInput = strictObject({
    companyId, operationId: accountingId, breakdownId: accountingId,
    amount: positiveMoney, expectedTotalAmount: nonNegativeMoney, expectedIsTotalAmountValid: z.boolean(), expectedUpdatedAt,
});
const breakdownInvestmentInput = strictObject({ companyId, operationId: accountingId, breakdownId: accountingId, value: z.boolean(), expectedUpdatedAt });
const breakdownRemoveInput = strictObject({
    companyId, operationId: accountingId, breakdownId: accountingId,
    expectedTotalAmount: nonNegativeMoney, expectedIsTotalAmountValid: z.boolean(), expectedUpdatedAt,
});
const investmentListInput = strictObject({
    companyId,
    query: strictObject({
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        offset: z.number().int().min(0).max(MAX_LIST_OFFSET).optional(),
    }).optional(),
});
const investmentIdInput = strictObject({ companyId, id: accountingId });
const expenseCreationInput = strictObject({
    companyId,
    data: strictObject({
        date: isoDate,
        amount: positiveMoney,
        memo: z.string().trim().min(1).max(MAX_ACCOUNTING_MEMO_LENGTH),
        businessCategoryId: accountingId,
        partnerId: accountingId,
    }),
});
const expenseReportCreationData = strictObject({
    date: isoDate,
    memo: z.string().trim().min(1).max(MAX_ACCOUNTING_MEMO_LENGTH),
    partnerId: accountingId,
    businessBreakdowns: z.array(strictObject({ amount: positiveMoney, categoryId: accountingId })).min(1).max(20),
}).superRefine((data, context) => {
    const categoryIds = new Set<number>();
    let totalCents = 0;
    data.businessBreakdowns.forEach((line, index) => {
        if (categoryIds.has(line.categoryId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ["businessBreakdowns", index, "categoryId"], message: "Category IDs must be unique." });
        }
        categoryIds.add(line.categoryId);
        totalCents += toMinorUnits(line.amount);
    });
    if (!Number.isSafeInteger(totalCents) || totalCents > 10_000_000) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["businessBreakdowns"], message: "Total must not exceed €100,000." });
    }
});
const expenseReportCreationInput = strictObject({ companyId, data: expenseReportCreationData });
const investmentCreationData = strictObject({
    name: z.string().trim().min(1).max(MAX_INVESTMENT_NAME_LENGTH),
    memo: z.string().trim().min(1).max(MAX_ACCOUNTING_MEMO_LENGTH).optional(),
    categoryId: accountingId,
    purchaseAmount: positiveMoney,
    amortizableAmount: nonNegativeMoney,
    previouslyAmortizedAmount: nonNegativeMoney,
    purchaseDate: isoDate,
    saleDate: isoDate.nullable(),
    amortizationType: z.enum(["amortizing", "linear", "none"]),
    amortizationStartDate: isoDate,
    amortizationYearCount: z.number().int().min(1).max(MAX_AMORTIZATION_YEAR_COUNT),
    amortizationRatio: z.number().finite().min(MIN_AMORTIZATION_RATIO).max(MAX_AMORTIZATION_RATIO).nullable(),
    isFullyPaid: z.boolean(),
}).superRefine((data, context) => {
    if (data.previouslyAmortizedAmount > data.amortizableAmount) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["previouslyAmortizedAmount"], message: "Previously amortized amount must not exceed amortizable amount." });
    }
    if (data.amortizableAmount > data.purchaseAmount) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortizableAmount"], message: "Amortizable amount must not exceed purchase amount." });
    }
    if (data.amortizationStartDate < data.purchaseDate) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortizationStartDate"], message: "Amortization start date must not precede purchase date." });
    }
    if (data.saleDate !== null && (data.saleDate < data.purchaseDate || data.saleDate < data.amortizationStartDate)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["saleDate"], message: "Sale date must not precede purchase or amortization start date." });
    }
    if (data.amortizationType === "amortizing") {
        if (data.amortizableAmount <= 0 || data.amortizationYearCount < 1 || data.amortizationRatio === null) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "Declining amortization requires a positive amount, duration, and ratio." });
        }
    } else if (data.amortizationType === "linear") {
        if (data.amortizableAmount <= 0 || data.amortizationYearCount < 1 || data.amortizationRatio !== null) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "Linear amortization requires a positive amount and duration with no ratio." });
        }
    } else if (data.amortizationRatio !== null) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortizationRatio"], message: "Non-amortizable assets do not accept a declining ratio." });
    }
});
const investmentCreateInput = strictObject({ companyId, data: investmentCreationData });
const vendorInvoiceAttachInput = strictObject({
    companyId,
    vendorInvoiceId: invoiceId,
    operationId: accountingId,
});

/**
 * Declarative action contract. Endpoint methods remain the sole owners of HTTP
 * paths and business mapping; actions only validate input and dispatch calls.
 */
export const actions = {
    accounting_get_fiscal_years: defineAction({
        name: "accounting_get_fiscal_years", description: "Retrieve the list of fiscal years of the company, ordered chronologically.",
        inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.accounting({ companyId }).getFiscalYears(),
    }),
    accounting_get_fiscal_year: defineAction({
        name: "accounting_get_fiscal_year", description: "Retrieve a single fiscal year with document references (bilan PDF, tax filings, FEC export, etc.).",
        inputSchema: yearInput, safety: READ,
        execute: (api, { companyId, yearId }) => api.accounting({ companyId }).getFiscalYear(yearId),
    }),
    accounting_get_income_statement: defineAction({
        name: "accounting_get_income_statement", description: "Retrieve the structured income statement (compte de résultat) for a fiscal year. Returns year-to-date cumulatives, monthly breakdown, and previous-year comparison.",
        inputSchema: incomeStatementInput, safety: READ,
        execute: (api, { companyId, query }) => api.accounting({ companyId }).getIncomeStatement(query),
    }),
    accounting_get_treasury_accounts: defineAction({
        name: "accounting_get_treasury_accounts", description: "Retrieve the current treasury accounts (bank + savings) with live balances.",
        inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.accounting({ companyId }).getTreasuryAccounts(),
    }),
    accounting_get_company_summary: defineAction({
        name: "accounting_get_company_summary", description: "Retrieve the narrative company summary for a given fiscal year (legal form, capital, directors, activity, tax regime, …).",
        inputSchema: yearInput, safety: READ,
        execute: (api, { companyId, yearId }) => api.accounting({ companyId }).getCompanySummary(yearId),
    }),
    cars_get_all: defineAction({
        name: "cars_get_all", description: "Retrieve all cars for the company.", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.cars({ companyId }).getAll(),
    }),
    categories_get_all: defineAction({
        name: "categories_get_all", description: "Retrieve the complete accounting category catalogue for a company.", inputSchema: categoriesInput, safety: READ,
        execute: (api, { companyId }) => api.categories({ companyId }).getAll(),
    }),
    companies_get_one: defineAction({
        name: "companies_get_one", description: "Retrieve details for a specific company.",
        inputSchema: strictObject({ id: accountingId }), safety: READ,
        execute: (api, { id }) => api.companies.getOne(id),
    }),
    companies_get_partners: defineAction({
        name: "companies_get_partners", description: "List all partners (associés) of a company with their share counts and CCA account numbers. Cross with performance_get_comptes_dassocies to resolve CCA balances per partner.",
        inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.companies.getPartners(companyId),
    }),
    invoices_list_sales: defineAction({
        name: "invoices_list_sales", description: "List all sales invoices (factures de vente) for the company.", inputSchema: invoiceListInput, safety: READ,
        execute: (api, { companyId, query }) => api.invoices({ companyId }).listSales(query),
    }),
    invoices_get_sale: defineAction({
        name: "invoices_get_sale", description: "Get a single sales invoice by UUID.", inputSchema: invoiceGetInput, safety: READ,
        execute: (api, { companyId, id }) => api.invoices({ companyId }).getSale(id),
    }),
    invoices_list_purchases: defineAction({
        name: "invoices_list_purchases", description: "List all purchase/vendor invoices (factures d'achat) for the company.", inputSchema: invoiceListInput, safety: READ,
        execute: (api, { companyId, query }) => api.invoices({ companyId }).listPurchases(query),
    }),
    invoices_get_purchase: defineAction({
        name: "invoices_get_purchase", description: "Get a single purchase/vendor invoice by UUID.", inputSchema: invoiceGetInput, safety: READ,
        execute: (api, { companyId, id }) => api.invoices({ companyId }).getPurchase(id),
    }),
    invoices_download_purchase_evidence: defineAction({
        name: "invoices_download_purchase_evidence", description: "Download the evidence file attached to a purchase/vendor invoice.", inputSchema: invoiceGetInput, safety: READ,
        execute: (api, { companyId, id }) => api.invoices({ companyId }).downloadPurchaseEvidence(id),
    }),
    investments_get_all: defineAction({
        name: "investments_get_all", description: "List non-draft fixed assets using bounded pagination and the canonical ordering.", inputSchema: investmentListInput, safety: READ,
        execute: (api, { companyId, query }) => api.investments({ companyId }).getAll(query),
    }),
    investments_get_active_categories: defineAction({
        name: "investments_get_active_categories", description: "Retrieve active fixed-asset categories before creating an investment.", inputSchema: categoriesInput, safety: READ,
        execute: (api, { companyId }) => api.investments({ companyId }).getActiveCategories(),
    }),
    investments_get_one: defineAction({
        name: "investments_get_one", description: "Retrieve one fixed asset.", inputSchema: investmentIdInput, safety: READ,
        execute: (api, { companyId, id }) => api.investments({ companyId }).getOne(id),
    }),
    investments_get_status: defineAction({
        name: "investments_get_status", description: "Retrieve generic fixed-asset lock and edit status.", inputSchema: investmentIdInput, safety: READ,
        execute: (api, { companyId, id }) => api.investments({ companyId }).getStatus(id),
    }),
    investments_create: defineAction({
        name: "investments_create", description: "Create a non-draft fixed asset after verifying its selected active category.", inputSchema: investmentCreateInput, safety: CREATE,
        execute: (api, { companyId, data }) => api.investments({ companyId }).create(data),
    }),
    operations_get_all: defineAction({
        name: "operations_get_all", description: "Retrieve a list of operations matching the query criteria.", inputSchema: operationListInput, safety: READ,
        execute: (api, { companyId, query }) => api.operations({ companyId }).getAll(query),
    }),
    operations_get_one: defineAction({
        name: "operations_get_one", description: "Retrieve a single operation by ID.", inputSchema: operationIdInput, safety: READ,
        execute: (api, { companyId, id }) => api.operations({ companyId }).getOne(id),
    }),
    operations_add_breakdown_detail: defineAction({
        name: "operations_add_breakdown_detail", description: "Append only the provider UI's live-proven uncategorized zero-residual detail to an editable operation.", inputSchema: breakdownAddDetailInput, safety: CREATE,
        execute: (api, { companyId, operationId, expectedUpdatedAt }) => api.operations({ companyId }).addBreakdownDetail(operationId, { expectedUpdatedAt }),
    }),
    operations_set_breakdown_category: defineAction({
        name: "operations_set_breakdown_category", description: "Set one editable business breakdown category after a fresh contextual category preflight. One-shot: never retry an unknown outcome.", inputSchema: breakdownCategoryInput, safety: DESTRUCTIVE_WRITE,
        execute: (api, { companyId, operationId, breakdownId, categoryId, expectedUpdatedAt }) => api.operations({ companyId }).setBreakdownCategory(operationId, breakdownId, categoryId, { expectedUpdatedAt }),
    }),
    operations_set_breakdown_amount: defineAction({
        name: "operations_set_breakdown_amount", description: "Set one business breakdown amount exactly once. It may intentionally leave the operation unbalanced; authorize any balancing repair as a separate subsequent call, never retry an unknown outcome.", inputSchema: breakdownAmountInput, safety: DESTRUCTIVE_WRITE,
        execute: (api, { companyId, operationId, breakdownId, amount, expectedTotalAmount, expectedIsTotalAmountValid, expectedUpdatedAt }) => api.operations({ companyId }).setBreakdownAmount(operationId, breakdownId, { amount, expectedTotalAmount, expectedIsTotalAmountValid, expectedUpdatedAt }),
    }),
    operations_set_breakdown_is_investment: defineAction({
        name: "operations_set_breakdown_is_investment", description: "Set only the dynamically discovered, live-proven associationData.isInvestment boolean on one business breakdown.", inputSchema: breakdownInvestmentInput, safety: DESTRUCTIVE_WRITE,
        execute: (api, { companyId, operationId, breakdownId, value, expectedUpdatedAt }) => api.operations({ companyId }).setBreakdownIsInvestment(operationId, breakdownId, value, { expectedUpdatedAt }),
    }),
    operations_remove_breakdown_detail: defineAction({
        name: "operations_remove_breakdown_detail", description: "Remove one non-counterpart, non-fee business detail exactly once. It may leave the operation unbalanced; authorize a separate repair if needed.", inputSchema: breakdownRemoveInput, safety: DESTRUCTIVE_WRITE,
        execute: (api, { companyId, operationId, breakdownId, expectedTotalAmount, expectedIsTotalAmountValid, expectedUpdatedAt }) => api.operations({ companyId }).removeBreakdownDetail(operationId, breakdownId, { expectedTotalAmount, expectedIsTotalAmountValid, expectedUpdatedAt }),
    }),
    operations_get_available_categories: defineAction({
        name: "operations_get_available_categories", description: "Retrieve numeric category IDs currently valid for one operation breakdown.", inputSchema: availableCategoriesInput, safety: READ,
        execute: (api, { companyId, operationId, breakdownId, isRefund, search }) =>
            api.operations({ companyId }).getAvailableCategories(operationId, breakdownId, { isRefund, search }),
    }),
    operations_get_breakdown_association_candidates: defineAction({
        name: "operations_get_breakdown_association_candidates", description: "List bounded candidates for one server-discovered, assignable breakdown association slot. Selected-item/provider blobs are omitted.",
        inputSchema: breakdownAssociationCandidatesInput, safety: READ,
        execute: (api, { companyId, operationId, breakdownId, associationName, slotName, offset, search, limit }) =>
            api.operations({ companyId }).getBreakdownAssociationCandidates(operationId, breakdownId, associationName, slotName, { offset, search, limit }),
    }),
    operations_download_source_document_attachment: defineAction({
        name: "operations_download_source_document_attachment", description: "Download a source-document attachment selected by ID from an operation.", inputSchema: operationAttachmentDownloadInput, safety: READ,
        execute: (api, { companyId, operationId, attachmentId }) =>
            api.operations({ companyId }).downloadSourceDocumentAttachment(operationId, attachmentId),
    }),
    operations_delete: defineAction({
        name: "operations_delete", description: "Delete an operation.", inputSchema: operationIdInput, safety: DELETE,
        execute: (api, { companyId, id }) => api.operations({ companyId }).delete(id),
    }),
    operations_create_kilometric_indemnity: defineAction({
        name: "operations_create_kilometric_indemnity", description: "Create a new kilometric indemnity operation.", inputSchema: kilometricInput, safety: CREATE,
        execute: (api, { companyId, data }) => api.operations({ companyId }).createKilometricIndemnity(data),
    }),
    operations_create_expense: defineAction({
        name: "operations_create_expense", description: "Create a generic personally-paid expense with one business line and one partner counterpart.", inputSchema: expenseCreationInput, safety: CREATE,
        execute: (api, { companyId, data }) => api.operations({ companyId }).createExpense(data),
    }),
    operations_create_expense_report: defineAction({
        name: "operations_create_expense_report", description: "Create a personally-paid expense report with 1–20 business allocations and one generated partner counterpart.", inputSchema: expenseReportCreationInput, safety: CREATE,
        execute: (api, { companyId, data }) => api.operations({ companyId }).createExpenseReport(data),
    }),
    performance_list_series: defineAction({
        name: "performance_list_series", description: "List all accounting series available for getSerieValues().", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.performance({ companyId }).listSeries(),
    }),
    performance_get_serie_values: defineAction({
        name: "performance_get_serie_values", description: "Fetch a time-series of values for a given accounting serie.", inputSchema: performanceSerieInput, safety: READ,
        execute: (api, { companyId, serieId, query }) => api.performance({ companyId }).getSerieValues(serieId, query),
    }),
    performance_get_chiffre_daffaires: defineAction({
        name: "performance_get_chiffre_daffaires", description: "Chiffre d'affaires monthly breakdown for a fiscal year.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getChiffreDAffaires(query),
    }),
    performance_get_compte_de_resultat: defineAction({
        name: "performance_get_compte_de_resultat", description: "Structured compte de résultat (P&L) with all sub-groups expanded. Richer than accounting_get_income_statement and includes the detailed balances rendered by the Dougs Performance tab.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getCompteDeResultat(query),
    }),
    performance_get_resultat_dexploitation: defineAction({
        name: "performance_get_resultat_dexploitation", description: "Résultat d'exploitation breakdown.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getResultatDExploitation(query),
    }),
    performance_get_charges_dexploitation: defineAction({
        name: "performance_get_charges_dexploitation", description: "Charges d'exploitation breakdown.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getChargesDExploitation(query),
    }),
    performance_get_flux_de_tresorerie: defineAction({
        name: "performance_get_flux_de_tresorerie", description: "Cash-flow statement (flux de trésorerie).", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getFluxDeTresorerie(query),
    }),
    performance_get_fonds_propres: defineAction({
        name: "performance_get_fonds_propres", description: "Fonds propres / equity breakdown.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getFondsPropres(query),
    }),
    performance_get_tresorerie: defineAction({
        name: "performance_get_tresorerie", description: "Live treasury stats.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getTresorerie(query),
    }),
    performance_get_repartition_des_charges: defineAction({
        name: "performance_get_repartition_des_charges", description: "Expense breakdown.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getRepartitionDesCharges(query),
    }),
    performance_get_comptes_dassocies: defineAction({
        name: "performance_get_comptes_dassocies", description: "Comptes d'associés (associate accounts) breakdown.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getComptesDAssocies(query),
    }),
    performance_get_autres_reserves_reports_anouveaux: defineAction({
        name: "performance_get_autres_reserves_reports_anouveaux", description: "Autres réserves & reports à nouveau.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getAutresReservesReportsANouveaux(query),
    }),
    performance_get_suivi_tva: defineAction({
        name: "performance_get_suivi_tva", description: "VAT status snapshot.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getSuiviTva(query),
    }),
    performance_get_suivi_impots_societes: defineAction({
        name: "performance_get_suivi_impots_societes", description: "IS (corporate income tax) status snapshot.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getSuiviImpotsSocietes(query),
    }),
    performance_get_suivi_cfe: defineAction({
        name: "performance_get_suivi_cfe", description: "CFE status snapshot.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getSuiviCfe(query),
    }),
    performance_get_social_charges: defineAction({
        name: "performance_get_social_charges", description: "Social charges (cotisations) totals for the company.", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.performance({ companyId }).getSocialCharges(),
    }),
    performance_get_tns_social_charges: defineAction({
        name: "performance_get_tns_social_charges", description: "TNS social charges.", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.performance({ companyId }).getTnsSocialCharges(),
    }),
    performance_get_remunerations: defineAction({
        name: "performance_get_remunerations", description: "Rémunérations + PUMA/retraite/IJ thresholds.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getRemunerations(query),
    }),
    performance_get_remunerations_for_accounting_year: defineAction({
        name: "performance_get_remunerations_for_accounting_year", description: "Rémunérations breakdown for the selected accounting year.", inputSchema: performanceYearInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getRemunerationsForAccountingYear(query),
    }),
    performance_get_aging_balance: defineAction({
        name: "performance_get_aging_balance", description: "Aging balance of customer invoices.", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.performance({ companyId }).getAgingBalance(),
    }),
    performance_get_suppliers_charges: defineAction({
        name: "performance_get_suppliers_charges", description: "Suppliers charges over a custom window.", inputSchema: supplierChargesInput, safety: READ,
        execute: (api, { companyId, query }) => api.performance({ companyId }).getSuppliersCharges(query),
    }),
    prestations_list: defineAction({
        name: "prestations_list", description: "List all prestations (customer deliveries) of the company. Includes completed and in-progress prestations, with their final documents, billing invoice items and workflow steps.", inputSchema: companyInput, safety: READ,
        execute: (api, { companyId }) => api.prestations({ companyId }).list(),
    }),
    prestations_get_document_download_path: defineAction({
        name: "prestations_get_document_download_path", description: "Build the downloadable file URL (relative to the Dougs API base URL) for a prestation document. Typically yields a 302 redirect to a signed AWS S3 URL when followed while authenticated.",
        inputSchema: strictObject({ companyId, fileUuid: z.string().uuid().describe("Canonical file UUID.") }), safety: LOCAL_READ,
        execute: (api, { companyId, fileUuid }) => api.prestations({ companyId }).getDocumentDownloadPath(fileUuid),
    }),
    users_get_me: defineAction({
        name: "users_get_me", description: "Retrieve the current authenticated user's information. This is the recommended way to obtain company IDs for use with other endpoints. The response includes a companies array with company IDs that can be used with operations, cars, and other company-specific endpoints.", inputSchema: emptyInput, safety: READ,
        execute: (api) => api.users.getMe(),
    }),
    vendor_invoices_attach_operation: defineAction({
        name: "vendor_invoices_attach_operation", description: "Attach one existing operation to one vendor invoice. Repeating the request is not assumed idempotent.", inputSchema: vendorInvoiceAttachInput, safety: CREATE,
        execute: (api, { companyId, vendorInvoiceId, operationId }) =>
            api.invoices({ companyId }).attachOperation(vendorInvoiceId, operationId),
    }),
} as const satisfies Record<string, ActionDefinition<any>>;

export type ActionName = keyof typeof actions;
