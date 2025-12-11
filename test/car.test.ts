import { createTestClient, getCompanyId } from './utils';
import { Client, DougsEndpoints } from '../src/index';

describe('Dougs API Car Integration', () => {
    jest.setTimeout(30000);

    let client: Client;
    let dougs: DougsEndpoints;

    beforeAll(() => {
        ({ client, dougs } = createTestClient());
    });

    test('should fetch cars', async () => {
        const companyId = getCompanyId();
        const cars = await dougs.cars({ companyId }).getAll();
        console.log(`Found ${cars.length} cars`);
        expect(Array.isArray(cars)).toBe(true);
        expect(cars.length).toBeGreaterThan(0);
        expect(cars[0]).toHaveProperty('id');
        expect(cars[0]).toHaveProperty('name');
    });
});
