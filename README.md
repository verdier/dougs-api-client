# dougs-api-client

Unofficial TypeScript client for the Dougs.fr Internal API.

> [!WARNING]
> **Work In Progress**: This is an unofficial client and is not affiliated with Dougs. Use at your own risk.

## Installation

```bash
npm install dougs-api-client
```

## Usage

```typescript
import { Client, makeEndpoints } from 'dougs-api-client';

const client = new Client({
    email: "your@email.com",
    password: "your_password",
    sessionPath: '.session.json' // Optional: persists login session
});

const { companies, operations } = makeEndpoints(client);

// Get all companies
const myCompanies = await companies.getAll();

// Get operations for a specific company
const myOps = await operations(12345).getAll();
```

## Development & Testing

To run the tests for this project, you need to configure your environment.
Create a `.env` file with your credentials (see `.env.example`):

```env
DOUGS_EMAIL=your@email.com
DOUGS_PASSWORD=your_password
DOUGS_COMPANY_ID=12345
```

## Authors

Co-authored by **Luc Verdier** and **AI Agent**.
