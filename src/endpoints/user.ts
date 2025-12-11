import { Client } from '../client';
import { mapUser } from './user.map';

/**
 * User DTO.
 */
export interface UserDTO {
    id: number;
    email: string;
    companies: Array<{ id: number }>;
}

/**
 * Manage user information.
 * @mountPath users
 */
export interface UserEndpoint {
    /**
     * Retrieve the current authenticated user's information.
     * This is the recommended way to obtain company IDs for use with other endpoints.
     * The response includes a companies array with company IDs that can be used with operations, cars, and other company-specific endpoints.
     * @returns Current user information including company IDs.
     */
    getMe(): Promise<UserDTO>;
}

export const makeUserEndpoint = (client: Client): UserEndpoint => {
    return {
        getMe: () => client.get('/users/me', undefined, mapUser)
    };
};
