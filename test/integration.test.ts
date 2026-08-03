import { createTestClient, getCompanyId } from './utils';
import { Client } from '../src/index';

describe('Dougs API Integration', () => {
    // Increase timeout for network requests
    jest.setTimeout(30000);

    let client: Client;

    beforeAll(async () => {
        client = createTestClient();
    });

    test('should fetch company', async () => {
        if (!client) throw new Error("Client not initialized, skipping test");

        const companyId = getCompanyId();

        const result = await client.api.companies.getOne(companyId);
        expect(result).toBeDefined();
        expect(result.id).toBe(companyId);
    });

    test('should fetch operations for a company', async () => {
        if (!client) throw new Error("Client not initialized, skipping test");

        const companyId = getCompanyId();

        const operations = await client.api.operations({ companyId }).getAll();
        expect(Array.isArray(operations)).toBe(true);
        expect(operations.length).toBeGreaterThanOrEqual(0);
    });
});
