import { Client, type DownloadedFile } from '../client';
import { mapOperation, mapOperations, RawOperationDTO } from './operation.map';

/**
 * Operation types.
 * Multiple types can apply to a single operation.
 */
export type OperationType =
    | 'bank'
    | 'customerCreditNote'
    | 'supplierCreditNote'
    | 'expense'
    | 'invoice'
    | 'clientInvoice'
    | 'vendorInvoice'
    | 'invoiceSupplier'
    | 'invoiceCustomer'
    | 'kilometricIndemnity'
    | 'cashPayment'
    | 'cashExpense'
    | 'miscellaneous'
    | 'customerEditableMiscellaneous'
    | 'accountingSurveyMiscellaneous'
    | 'dispatch'
    | 'reconciliation'
    | 'cashRegisterDispatch'
    | 'cashRegisterFee';

/**
 * Source document attachment DTO.
 */
export interface SourceDocumentAttachmentDTO {
    id: number;
    url: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    createdAt?: string;
}

/**
 * Breakdown for an operation.
 */
export interface BreakdownDTO {
    id: number;
    amount: number;
    wording?: string;
    isInbound: boolean;

    hasVat: boolean;
    vatAmount?: number;
    vatRate?: number;

    category: {
        id: number;
        wording: string;
        group?: {
            id: number;
            name: string;
        };
    };
}

/**
 * Operation DTO.
 */
export interface OperationDTO {
    id: number;
    date: string; // YYYY-MM-DD
    amount: number;
    totalAmount?: number;
    wording?: string;
    name?: string;
    memo?: string;
    description?: string;

    // Status
    validatedAt?: string | null;
    message?: string | null;
    errors?: any[];

    // Type info
    type: string;
    types: OperationType[];
    isInbound: boolean;

    // Tax
    hasVat: boolean;
    vatAmount?: number | null;
    vatRate?: number | null;

    // Metadata
    creatorId?: number;
    createdAt?: string;
    updatedAt?: string;

    // Breakdowns
    breakdowns?: BreakdownDTO[];

    // Attachments
    sourceDocumentAttachments?: SourceDocumentAttachmentDTO[];
    sourceDocumentCandidate?: any | null;
}

/**
 * Query parameters for filtering operations.
 */
export interface OperationQuery {
    /** Max number of results to return. */
    limit?: number;
    /** Number of results to skip (pagination). */
    offset?: number;
    /** Filter by validation status. */
    validated?: boolean;
    /** General search query string. */
    q?: string;
    /** Filter by amount. Can be an exact amount, a range (e.g. "100-200") or inferior/superior (e.g. "<100" or ">200"). */
    "q-amount"?: string;
    /** Filter by date (DD/MM/YYYY). Can be an exact date, partial date (e.g. "01/2025", "2025"), a range (e.g. "01/01/2025-31/12/2025") or inferior/superior (e.g. "<01/01/2025" or ">31/12/2025"). */
    "q-date"?: string;
    /** Filter by inbound/outbound status. */
    "q-isInbound"?: boolean;
}

/**
 * Data required to create a Kilometric Indemnity.
 */
export interface KilometricIndemnityCreationDTO {
    /** Date of the trip (YYYY-MM-DD). */
    date: string; // YYYY-MM-DD
    /** Distance traveled in kilometers. */
    distance: number;
    /** Optional memo/description for the trip. */
    memo?: string;
    /** ID of the car used. */
    carId?: number;
}

/**
 * Manage accounting operations.
 * @mountPath operations
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface OperationEndpointParams {
    companyId: number;
}

/**
 * Manage accounting operations.
 * @mountPath operations
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface OperationEndpoint {
    /**
     * Retrieve a list of operations matching the query criteria.
     * @param query - Filter and pagination options.
     * @returns List of operations.
     */
    getAll(query?: OperationQuery): Promise<OperationDTO[]>;

    /**
     * Retrieve a single operation by ID.
     * @param id - ID of the operation.
     * @returns The requested operation.
     */
    getOne(id: number): Promise<OperationDTO>;

    /** Download a source-document attachment selected from the operation metadata. */
    downloadSourceDocumentAttachment(operationId: number, attachmentId: number): Promise<DownloadedFile>;

    /**
     * Delete an operation.
     * @param id - ID of the operation to delete.
     */
    delete(id: number): Promise<void>;

    /**
     * Create a new kilometric indemnity operation.
     * @param data - Data for the indemnity (date, distance, vehicle, etc.).
     * @returns The created operation.
     */
    createKilometricIndemnity(data: KilometricIndemnityCreationDTO): Promise<OperationDTO>;
}

export const makeOperationEndpoint = (client: Client, { companyId }: OperationEndpointParams): OperationEndpoint => {
    const baseUrl = `/companies/${companyId}/operations`;
    const getOne = (id: number) => client.get<RawOperationDTO>(`${baseUrl}/${id}`).then(mapOperation);
    
    return {
        getAll: (query?: OperationQuery) => 
            client.get<RawOperationDTO[]>(baseUrl, query).then(mapOperations),
        getOne,
        downloadSourceDocumentAttachment: async (operationId: number, attachmentId: number) => {
            const operation = await getOne(operationId);
            const attachment = operation.sourceDocumentAttachments?.find(candidate => candidate.id === attachmentId);
            if (!attachment || typeof attachment.url !== 'string' || attachment.url.trim().length === 0) {
                throw new Error("Operation has no matching source-document attachment.");
            }
            return client.downloadFile(attachment.url);
        },

        delete: (id: number) => client.delete<void>(`${baseUrl}/${id}`),

        createKilometricIndemnity: (data: KilometricIndemnityCreationDTO) => {
            const payload = {
                type: 'kilometricIndemnity',
                date: data.date,
                memo: data.memo,
                breakdowns: [{
                    amount: 0,
                    categoryId: -1,
                    associationData: {
                        kilometers: data.distance,
                        carId: data.carId
                    }
                }]
            };
            return client.post<RawOperationDTO>(baseUrl, payload).then(mapOperation);
        },
    };
};
