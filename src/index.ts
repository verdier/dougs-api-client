import { Client, ClientConfig, MAX_DOWNLOAD_BYTES, DOWNLOAD_BODY_TIMEOUT_MS } from './client';
import { Endpoints } from './endpoints';

export { Client, ClientConfig, MAX_DOWNLOAD_BYTES, DOWNLOAD_BODY_TIMEOUT_MS };
export type { DownloadedFile } from './client';
export { CompanyEndpoint, CompanyDTO } from './endpoints/company';
export { OperationEndpoint, OperationDTO, OperationType, BreakdownDTO, SourceDocumentAttachmentDTO } from './endpoints/operation';
export {
    InvoiceEndpoint,
    InvoiceEndpointParams,
    SalesInvoiceDTO,
    SalesInvoiceQuery,
    VendorInvoiceDTO,
    VendorInvoiceQuery,
} from './endpoints/invoices';
export { CarEndpoint, CarDTO } from './endpoints/car';
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

