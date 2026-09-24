import { Client } from '../client';
import { mapCars, RawCarDTO } from './car.map';
import { assertPositiveSafeInteger } from './validation';

/**
 * Car DTO.
 */
export interface CarDTO {
    id: number;
    companyId: number;
    name: string;
    type: "corporate" | "personal";
    isMotorcycle: boolean;
    power?: number;
    estimatedKilometers?: number;
    category?: string; // "tourism"
    fuelType?: string; // "petrol", "diesel"
    emissionsRate?: number;
    purchaseDate?: string; // YYYY-MM-DD
    firstRegistrationDate?: string; // YYYY-MM-DD
    isLeasing: boolean;
    financingType?: string;
    endDate?: string;
    content?: {
        licensePlate?: string;
        [key: string]: any;
    };
}

/**
 * Manage company cars.
 * @mountPath cars
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface CarEndpointParams {
    companyId: number;
}

/**
 * Manage company cars.
 * @mountPath cars
 * @factory
 * @param {number} companyId - ID of the company to operate on.
 */
export interface CarEndpoint {
    /**
     * Retrieve all cars for the company.
     * @returns List of cars.
     */
    getAll(): Promise<CarDTO[]>;
}

export const makeCarEndpoint = (client: Client, { companyId }: CarEndpointParams): CarEndpoint => {
    assertPositiveSafeInteger(companyId);
    return {
        getAll: () => client.get<RawCarDTO[]>(`/companies/${companyId}/cars`).then(mapCars)
    };
};
