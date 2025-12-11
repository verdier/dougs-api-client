import { Client, ClientConfig } from './client';
import { makeCompanyEndpoint } from './endpoints/company';
import { makeOperationEndpoint } from './endpoints/operation';
import { makeCarEndpoint } from './endpoints/car';
import { makeUserEndpoint } from './endpoints/user';

export { Client, ClientConfig };
export { CompanyEndpoint, CompanyDTO } from './endpoints/company';
export { OperationEndpoint, OperationDTO, OperationType, BreakdownDTO, SourceDocumentAttachmentDTO } from './endpoints/operation';
export { CarEndpoint, CarDTO } from './endpoints/car';
export { UserEndpoint, UserDTO } from './endpoints/user';
export { registry, types } from './registry';
export { Command, CommandParameter, InterfaceDoc, PropertyDoc } from './registry.types';

export type DougsEndpoints = ReturnType<typeof makeEndpoints>;

export const makeEndpoints = (client: Client) => {
    return {
        companies: makeCompanyEndpoint(client),
        operations: ({ companyId }: { companyId: number }) => makeOperationEndpoint(client, { companyId }),
        cars: ({ companyId }: { companyId: number }) => makeCarEndpoint(client, { companyId }),
        users: makeUserEndpoint(client)
    };
};

