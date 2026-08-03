import { CarDTO } from './car';

/**
 * Raw Car DTO as returned by the Dougs API.
 */
export interface RawCarDTO {
    id: number;
    companyId: number;
    partnerId?: number | null;
    name: string;
    type: "corporate" | "personal";
    isMotorcycle: boolean;
    power?: number | null;
    estimatedKilometers?: number | null;
    category?: string;
    fuelType?: string;
    emissionsRate?: number;
    purchaseDate?: string;
    firstRegistrationDate?: string;
    isLeasing: boolean;
    financingType?: string | null;
    endDate?: string;
    content?: {
        licensePlate?: string;
        [key: string]: any;
    };
    metadata?: any;
    creatorId?: number;
    createdAt?: string;
    updatedAt?: string;
    partner?: any;
    registration?: any;
    carRentContract?: any;
    isCorporate?: boolean;
    isPersonal?: boolean;
    isRental?: boolean;
    description?: string;
    iconUrl?: string;
    [key: string]: any;
}

/**
 * Maps raw API response to filtered CarDTO.
 */
export function mapCar(raw: RawCarDTO): CarDTO {
    return {
        id: raw.id,
        companyId: raw.companyId,
        name: raw.name,
        type: raw.type,
        isMotorcycle: raw.isMotorcycle,
        power: raw.power ?? undefined,
        estimatedKilometers: raw.estimatedKilometers ?? undefined,
        category: raw.category,
        fuelType: raw.fuelType,
        emissionsRate: raw.emissionsRate,
        purchaseDate: raw.purchaseDate,
        firstRegistrationDate: raw.firstRegistrationDate,
        isLeasing: raw.isLeasing,
        financingType: raw.financingType ?? undefined,
        endDate: raw.endDate,
        content: raw.content,
    };
}

/**
 * Maps an array of raw API responses to filtered CarDTO array.
 */
export function mapCars(raw: RawCarDTO[]): CarDTO[] {
    return raw.map(mapCar);
}
