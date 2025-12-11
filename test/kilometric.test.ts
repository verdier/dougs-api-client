import { createTestClient, getCompanyId } from './utils';
import { Client, DougsEndpoints } from '../src/index';

describe('Dougs API Kilometric Indemnity Integration', () => {
    jest.setTimeout(30000);

    let client: Client;
    let dougs: DougsEndpoints;
    let companyId: number;

    beforeAll(() => {
        ({ client, dougs } = createTestClient());
        companyId = getCompanyId();
    });

    describe('Lifecycle', () => {
        let createdOperationId: number;

        test('should create a kilometric indemnity', async () => {
            const date = new Date().toISOString().split('T')[0];
            const distance = 12;

            console.log(`Creating IK on ${date} for ${distance}km`);

            const cars = await dougs.cars(companyId).getAll();
            const car = cars.find(c => c.type === 'personal' && !c.endDate);

            const op = await dougs.operations(companyId).createKilometricIndemnity({
                date,
                distance,
                memo: "Test Creation",
                carId: car?.id
            });

            console.log('Created IK:', op.id);
            expect(op).toBeDefined();
            createdOperationId = op.id;
        });

        test('should retrieve the created kilometric indemnity', async () => {
            expect(createdOperationId).toBeDefined();
            const op = await dougs.operations(companyId).getOne(createdOperationId);
            expect(op).toBeDefined();
            expect(op.id).toBe(createdOperationId);
        });

        test('should delete the kilometric indemnity', async () => {
            expect(createdOperationId).toBeDefined();
            console.log(`Deleting IK: ${createdOperationId}`);
            await dougs.operations(companyId).delete(createdOperationId);
            console.log('Deleted IK:', createdOperationId);
        });

        test('should fail to retrieve the deleted kilometric indemnity (404)', async () => {
            expect(createdOperationId).toBeDefined();
            console.log(`Verifying IK ${createdOperationId} is gone...`);
            try {
                await dougs.operations(companyId).getOne(createdOperationId);
                throw new Error("Operation should have been deleted but was found");
            } catch (e: any) {
                console.log("Got expected error:", e.message);
                expect(e.message).toMatch(/404/);
            }
        });
    });
});
