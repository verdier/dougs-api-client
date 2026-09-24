import { createTestClient } from './utils';
import { Client } from '../src/index';
import { RawUserDTO } from '../src/endpoints/user.map';

describe('Dougs API User Integration', () => {
    jest.setTimeout(30000);

    let client: Client;

    beforeAll(() => {
        client = createTestClient();
    });

    test('should fetch current user', async () => {
        const user = await client.api.users.getMe();
        expect(user).toBeDefined();
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('companies');
        expect(typeof user.id).toBe('number');
        expect(typeof user.email).toBe('string');
        expect(Array.isArray(user.companies)).toBe(true);
        expect(user.companies.length).toBeGreaterThan(0);
        expect(user.companies[0]).toHaveProperty('id');
        expect(typeof user.companies[0].id).toBe('number');
    });

    test('should check RawUserDTO structure', async () => {
        const raw = await client.get<RawUserDTO>('/users/me');

        expect(raw).toBeDefined();
        expect(raw).toHaveProperty('id');
        expect(raw).toHaveProperty('email');
    });
});
