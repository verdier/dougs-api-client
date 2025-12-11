# dougs-api-client

Unofficial TypeScript client for the Dougs.fr Internal API.

> [!WARNING]
> **Work In Progress**: This is an unofficial client and is not affiliated with Dougs. Use at your own risk.

## Installation

```bash
npm install dougs-api-client
```

## Usage

Create a `.env` file with your credentials (see `.env.example` if available, or just use variables below):

```env
DOUGS_EMAIL=your@email.com
DOUGS_PASSWORD=your_password
DOUGS_COMPANY_ID=12345
```

```typescript
import { Client, makeEndpoints } from 'dougs-api-client';

const client = new Client({
    email: process.env.DOUGS_EMAIL,
    password: process.env.DOUGS_PASSWORD,
    sessionPath: '.session.json' // Optional: persists login session
});

const { companies, operations } = makeEndpoints(client);

// Get all companies
const myCompanies = await companies.getAll();

// Get operations for a specific company
const myOps = await operations(12345).getAll();
```

## Authors

Co-authored by **Luc Verdier** and **AI Agent**.
