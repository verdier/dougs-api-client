import { Client, ClientConfig, MAX_DOWNLOAD_BYTES, DOWNLOAD_BODY_TIMEOUT_MS } from './client';
import { Endpoints } from './endpoints';

export { Client, ClientConfig, MAX_DOWNLOAD_BYTES, DOWNLOAD_BODY_TIMEOUT_MS };
export type { DownloadedFile } from './client';
export { CompanyEndpoint, CompanyDTO, PartnerDTO } from './endpoints/company';
export type { ContextualCategoryIds } from './endpoints/categories.map';
export {
    CategoryEndpoint,
    CategoryEndpointParams,
    CategoryDTO,
    CategoryGroupDTO,
    CategoryInvestmentDefaultsDTO,
} from './endpoints/categories';
export {
    OperationEndpoint,
    OperationDTO,
    OperationType,
    BreakdownDTO,
    BreakdownAssociationDataDTO,
    BreakdownAssociationDTO,
    BreakdownAssociationSlotDTO,
    BreakdownAssociationCandidateDTO,
    BreakdownAssociationCandidatesDTO,
    BreakdownAssociationCandidatesQuery,
    SourceDocumentAttachmentDTO,
    VendorInvoiceMatchCandidateDTO,
    ExpenseCreationDTO,
    ExpenseReportBusinessBreakdownDTO,
    ExpenseReportCreationDTO,
    AvailableCategoriesQuery,
    BreakdownMutationExpectation,
    BreakdownAmountMutation,
    BreakdownRemovalMutation,
    appendOperationMemoTag,
} from './endpoints/operation';
export {
    InvoiceEndpoint,
    InvoiceEndpointParams,
    InvoiceOperationMatchDTO,
    SalesInvoiceDTO,
    SalesInvoiceQuery,
    VendorInvoiceDTO,
    VendorInvoiceQuery,
} from './endpoints/invoices';
export { CarEndpoint, CarDTO } from './endpoints/car';
export {
    InvestmentEndpoint,
    InvestmentEndpointParams,
    InvestmentDTO,
    InvestmentStatusDTO,
    InvestmentListQuery,
    InvestmentCreationDTO,
    AmortizationType,
} from './endpoints/investments';
export { UserEndpoint, UserDTO } from './endpoints/user';
export {
    AccountingEndpoint,
    AccountingYearDTO,
    AccountingYearDetailDTO,
    AccountingYearDocumentDTO,
    IncomeStatementDTO,
    IncomeStatementGroupDTO,
    IncomeStatementBalanceDTO,
    IncomeStatementPeriodDTO,
    IncomeStatementCumulativeDTO,
    IncomeStatementQuery,
    TreasuryAccountDTO,
    CompanySummaryDTO,
    CompanySummaryBlockDTO,
} from './endpoints/accounting';
export { actions } from './actions';
export type { ActionDefinition, ActionName, ActionSafety } from './actions';

export type DougsEndpoints = Endpoints;

