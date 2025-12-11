import { Client } from '../client';

export interface CategoryGroup {
    id: number;
    name: string;
    color?: string;
    miscellaneous?: boolean;
}

export interface OperationDTO {
    id: number;
    companyId: number;
    date: string; // YYYY-MM-DD
    amount: number;
    label?: string; // Often null, use wording or category
    wording?: string;
    name?: string; // "Indemnités Kilométriques" etc

    // Categorization
    categoryId?: number;
    categoryGroup?: CategoryGroup;
    categoryWording?: string;

    // Flags
    isBank: boolean;
    isFee: boolean;
    isExpense: boolean;
    isInvoice: boolean;
    isInbound: boolean;
    isCounterpart: boolean;
    isKilometricIndemnity: boolean;

    // Tax
    hasVat: boolean;
    vatAmount?: number;
    vatRate?: number;
    totalAmount?: number;

    // Metadata
    description?: string;
    createdAt?: string;

    // Relations
    associations?: any[]; // Could be detailed if needed
}

/**
 * Query parameters for filtering operations.
 */
export interface OperationQuery {
    /** Max number of results to return. */
    limit?: number;
    /** Number of results to skip (pagination). */
    offset?: number;
    /** General search query string. */
    q?: string;
    /** Filter by exact amount. */
    "q-amount"?: string;
    /** Filter by date (YYYY-MM-DD). */
    "q-date"?: string;
    /** Filter by inbound/outbound status. */
    "q-isInbound"?: boolean;
    /** Filter operations requiring attention. */
    needsAttention?: boolean;
    /** Filter by validation status. */
    validated?: boolean;
    /** Start date for filtering. */
    from?: string;
    [key: string]: any;
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

export const makeOperationEndpoint = (client: Client, companyId: number): OperationEndpoint => {
    const baseUrl = `/companies/${companyId}/operations`;
    return {
        getAll: (query?: OperationQuery) => client.get<OperationDTO[]>(baseUrl, query),
        getOne: (id: number) => client.get<OperationDTO>(`${baseUrl}/${id}`),

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
            return client.post<OperationDTO>(baseUrl, payload);
        },
    };
};
