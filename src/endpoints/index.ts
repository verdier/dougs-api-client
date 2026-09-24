import { Client } from '../client';
import { makeCompanyEndpoint, CompanyEndpoint } from './company';
import { makeCategoryEndpoint, CategoryEndpoint } from './categories';
import { makeOperationEndpoint, OperationEndpoint } from './operation';
import { makeCarEndpoint, CarEndpoint } from './car';
import { makeUserEndpoint, UserEndpoint } from './user';
import { makeAccountingEndpoint, AccountingEndpoint } from './accounting';
import { makePrestationsEndpoint, PrestationsEndpoint } from './prestations';
import { makePerformanceEndpoint, PerformanceEndpoint } from './performance';
import { makeInvoiceEndpoint, InvoiceEndpoint } from './invoices';
import { makeInvestmentEndpoint, InvestmentEndpoint } from './investments';

export const makeEndpoints = (client: Client) => {
    return {
        users: makeUserEndpoint(client),
        companies: makeCompanyEndpoint(client),
        categories: ({ companyId }: { companyId: number }) => makeCategoryEndpoint(client, { companyId }),
        operations: ({ companyId }: { companyId: number }) => makeOperationEndpoint(client, { companyId }),
        cars: ({ companyId }: { companyId: number }) => makeCarEndpoint(client, { companyId }),
        accounting: ({ companyId }: { companyId: number }) => makeAccountingEndpoint(client, { companyId }),
        prestations: ({ companyId }: { companyId: number }) => makePrestationsEndpoint(client, { companyId }),
        performance: ({ companyId }: { companyId: number }) => makePerformanceEndpoint(client, { companyId }),
        invoices: ({ companyId }: { companyId: number }) => makeInvoiceEndpoint(client, { companyId }),
        investments: ({ companyId }: { companyId: number }) => makeInvestmentEndpoint(client, { companyId }),
    };
};

export type Endpoints = ReturnType<typeof makeEndpoints>;
