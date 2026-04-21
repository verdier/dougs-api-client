import { Client } from '../client';
import { makeCompanyEndpoint, CompanyEndpoint } from './company';
import { makeOperationEndpoint, OperationEndpoint } from './operation';
import { makeCarEndpoint, CarEndpoint } from './car';
import { makeUserEndpoint, UserEndpoint } from './user';
import { makeAccountingEndpoint, AccountingEndpoint } from './accounting';

export const makeEndpoints = (client: Client) => {
    return {
        users: makeUserEndpoint(client),
        companies: makeCompanyEndpoint(client),
        operations: ({ companyId }: { companyId: number }) => makeOperationEndpoint(client, { companyId }),
        cars: ({ companyId }: { companyId: number }) => makeCarEndpoint(client, { companyId }),
        accounting: ({ companyId }: { companyId: number }) => makeAccountingEndpoint(client, { companyId }),
    };
};

export type Endpoints = ReturnType<typeof makeEndpoints>;
