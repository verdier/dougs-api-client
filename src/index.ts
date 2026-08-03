import { Client, ClientConfig } from './client';
import { Endpoints } from './endpoints';

export { Client, ClientConfig };
export { CompanyEndpoint, CompanyDTO } from './endpoints/company';
export { OperationEndpoint, OperationDTO, OperationType, BreakdownDTO, SourceDocumentAttachmentDTO } from './endpoints/operation';
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

