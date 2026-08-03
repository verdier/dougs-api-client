import { z } from "zod";
import type { DougsEndpoints } from "./index";

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
const LOCAL_READ = Object.freeze({ readOnly: true, destructive: false, idempotent: true, openWorld: false });

const companyId = z.number().describe("ID of the company to operate on.");
const yearId = z.number().describe("ID of the fiscal year.");
const invoiceId = z.string().describe("Invoice UUID.");

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
    query: strictObject({ page: z.number().optional(), limit: z.number().optional() }).optional(),
});
const invoiceGetInput = strictObject({ companyId, id: invoiceId });
const operationQuery = strictObject({
    limit: z.number().optional().describe("Max number of results to return."),
    offset: z.number().optional().describe("Number of results to skip."),
    validated: z.boolean().optional().describe("Filter by validation status."),
    q: z.string().optional().describe("General search query string."),
    "q-amount": z.string().optional().describe("Filter by amount or amount range."),
    "q-date": z.string().optional().describe("Filter by date (DD/MM/YYYY), partial date, or date range."),
    "q-isInbound": z.boolean().optional().describe("Filter by inbound/outbound status."),
});
const operationListInput = strictObject({ companyId, query: operationQuery.optional() });
const operationIdInput = strictObject({ companyId, id: z.number().describe("Operation ID.") });
const kilometricInput = strictObject({
    companyId,
    data: strictObject({
        date: z.string().describe("Date of the trip (YYYY-MM-DD)."),
        distance: z.number().describe("Distance traveled in kilometers."),
        memo: z.string().optional().describe("Optional trip description."),
        carId: z.number().optional().describe("ID of the car used."),
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
const supplierChargesInput = strictObject({
    companyId,
    query: strictObject({
        startDate: z.string(),
        endDate: z.string(),
        previousStartDate: z.string().optional(),
        previousEndDate: z.string().optional(),
    }),
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
    companies_get_one: defineAction({
        name: "companies_get_one", description: "Retrieve details for a specific company.",
        inputSchema: strictObject({ id: z.number() }), safety: READ,
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
    operations_get_all: defineAction({
        name: "operations_get_all", description: "Retrieve a list of operations matching the query criteria.", inputSchema: operationListInput, safety: READ,
        execute: (api, { companyId, query }) => api.operations({ companyId }).getAll(query),
    }),
    operations_get_one: defineAction({
        name: "operations_get_one", description: "Retrieve a single operation by ID.", inputSchema: operationIdInput, safety: READ,
        execute: (api, { companyId, id }) => api.operations({ companyId }).getOne(id),
    }),
    operations_delete: defineAction({
        name: "operations_delete", description: "Delete an operation.", inputSchema: operationIdInput, safety: DELETE,
        execute: (api, { companyId, id }) => api.operations({ companyId }).delete(id),
    }),
    operations_create_kilometric_indemnity: defineAction({
        name: "operations_create_kilometric_indemnity", description: "Create a new kilometric indemnity operation.", inputSchema: kilometricInput, safety: CREATE,
        execute: (api, { companyId, data }) => api.operations({ companyId }).createKilometricIndemnity(data),
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
        inputSchema: strictObject({ companyId, fileUuid: z.string() }), safety: LOCAL_READ,
        execute: (api, { companyId, fileUuid }) => api.prestations({ companyId }).getDocumentDownloadPath(fileUuid),
    }),
    users_get_me: defineAction({
        name: "users_get_me", description: "Retrieve the current authenticated user's information. This is the recommended way to obtain company IDs for use with other endpoints. The response includes a companies array with company IDs that can be used with operations, cars, and other company-specific endpoints.", inputSchema: emptyInput, safety: READ,
        execute: (api) => api.users.getMe(),
    }),
} as const satisfies Record<string, ActionDefinition<any>>;

export type ActionName = keyof typeof actions;
