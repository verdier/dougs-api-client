import { UserDTO } from './user';

/**
 * Raw User DTO as returned by the Dougs API.
 */
export interface RawUserDTO {
    id: number;
    profileId: number;
    preferredCompanyId: number;
    email: string;
    emailMd5?: string | null;
    uuid: string;
    role: string;
    referralHash: string;
    referrerHash?: string | null;
    acceptedPoliciesVersion: number;
    acceptedPoliciesAt: string;
    suspended: boolean;
    suspendedAt?: string | null;
    deletedAt?: string | null;
    flags: string[];
    metadata?: {
        darkMode?: string;
        askForRanking?: boolean;
        compactAppAside?: boolean;
        hasSeenProductTour?: boolean;
        hasSeenNewServiceCatalog?: boolean;
        hasSeenAccountingOnboardingMovie?: boolean;
        subscribedToOperationNotifications?: boolean;
        receivedLastOperationNotificationAt?: string;
        [key: string]: any;
    };
    teamId?: number | null;
    documentsEmail: string;
    accountingFirmId: number;
    accountingFirmOfficeId: number;
    lastConversation?: {
        link: string;
        rating: number;
    };
    isSignupCompleted: boolean;
    authUserId: number;
    createdAt: string;
    updatedAt: string;
    companies?: Array<{ id: number; [key: string]: any }>;
    profile?: any;
    [key: string]: any;
}

/**
 * Maps raw API response to filtered UserDTO.
 */
export function mapUser(raw: RawUserDTO): UserDTO {
    return {
        id: raw.id,
        email: raw.email,
        companies: (raw.companies || []).map((company: any) => ({ id: company.id })),
    };
}
