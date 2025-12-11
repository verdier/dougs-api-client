import { createTestClient, getCompanyId } from './utils';
import { Client, DougsEndpoints } from '../src/index';

describe('Dougs API Integration', () => {
    // Increase timeout for network requests
    jest.setTimeout(30000);

    let client: Client;
    let dougs: DougsEndpoints

    beforeAll(async () => {
        ({ client, dougs } = createTestClient());
    });

    test('should fetch company', async () => {
        if (!dougs) throw new Error("Client not initialized, skipping test");

        const companyId = getCompanyId();

        const result = await dougs.companies.getOne(companyId);
        expect(result).toBeDefined();
        expect(result.id).toBe(companyId);
    });

    test('should fetch operations for a company', async () => {
        if (!dougs) throw new Error("Client not initialized, skipping test");

        const companyId = getCompanyId();

        const operations = await dougs.operations(companyId).getAll();
        expect(Array.isArray(operations)).toBe(true);
        expect(operations.length).toBeGreaterThanOrEqual(0);
    });
});
