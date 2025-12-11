import { Client, ClientConfig } from './client';
import { CompanyEndpoint, makeCompanyEndpoint } from './endpoints/company';
import { OperationEndpoint, makeOperationEndpoint } from './endpoints/operation';
import { CarEndpoint, makeCarEndpoint } from './endpoints/car';

export { Client, ClientConfig };
export { CompanyEndpoint, CompanyDTO } from './endpoints/company';
export { OperationEndpoint, OperationDTO } from './endpoints/operation';
export { CarEndpoint, CarDTO } from './endpoints/car';

export type DougsEndpoints = ReturnType<typeof makeEndpoints>;

export const makeEndpoints = (client: Client) => {
    return {
        companies: makeCompanyEndpoint(client),
        operations: (companyId: number) => makeOperationEndpoint(client, companyId),
        cars: (companyId: number) => makeCarEndpoint(client, companyId)
    };
};

