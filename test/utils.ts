import { Client, DougsEndpoints, makeEndpoints } from '../src/index';
import dotenv from 'dotenv';
import path from 'node:path';

// ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const getCompanyId = () => {
    const companyId = Number(process.env.DOUGS_COMPANY_ID);
    if (isNaN(companyId)) throw new Error("You must provide a company ID in the environment variable DOUGS_COMPANY_ID");
    return companyId;
};

export const createTestClient = (): { client: Client, dougs: DougsEndpoints } => {
    const SESSION_FILE = path.resolve(__dirname, '../.session.json');

    const client = new Client({
        email: process.env.DOUGS_EMAIL || "",
        password: process.env.DOUGS_PASSWORD || "",
        sessionPath: SESSION_FILE
    });

    const dougs = makeEndpoints(client);

    return { client, dougs };
};
