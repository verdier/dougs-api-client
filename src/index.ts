import { Client, ClientConfig } from './client';
import { Endpoints } from './endpoints';

export { Client, ClientConfig };
export { CompanyEndpoint, CompanyDTO } from './endpoints/company';
export { OperationEndpoint, OperationDTO, OperationType, BreakdownDTO, SourceDocumentAttachmentDTO } from './endpoints/operation';
export { CarEndpoint, CarDTO } from './endpoints/car';
export { UserEndpoint, UserDTO } from './endpoints/user';
export { registry, types } from './registry';
export { Command, CommandParameter, InterfaceDoc, PropertyDoc } from './registry.types';

export type DougsEndpoints = Endpoints;

