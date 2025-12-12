import { createTestClient, getCompanyId } from './utils';
import { Client } from '../src/index';

describe('Dougs API Car Integration', () => {
    jest.setTimeout(30000);

    let client: Client;

    beforeAll(() => {
        client = createTestClient();
    });

    test('should fetch cars', async () => {
        const companyId = getCompanyId();
        const cars = await client.api.cars({ companyId }).getAll();
        console.log(`Found ${cars.length} cars`);
        expect(Array.isArray(cars)).toBe(true);
        expect(cars.length).toBeGreaterThan(0);
        expect(cars[0]).toHaveProperty('id');
        expect(cars[0]).toHaveProperty('name');
    });
});
