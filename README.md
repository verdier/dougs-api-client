# dougs-api-client

A TypeScript client that provides an easy and clean way to interact with your Dougs.fr accounting data.

> [!WARNING]
> **Unofficial**: This client is not affiliated with Dougs.fr. Use at your own risk.

## Features

- **Simple API**: Clean, typed endpoints for companies, operations, vehicles, and users
- **Curated data model**: Exposes only relevant business data, abstracting away internal API complexity
- **Session management**: Automatic login and session persistence
- **TypeScript first**: Full type definitions for all DTOs

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

const { companies, operations, cars, users } = makeEndpoints(client);

// Get current user information (includes company IDs)
// This is the recommended way to obtain company IDs
const currentUser = await users.getMe();
console.log(`User: ${currentUser.email}`);
console.log(`Company IDs:`, currentUser.companies.map(c => c.id));

// Get details for a specific company
const companyId = currentUser.companies[0].id;
const company = await companies.getOne(companyId);

// Get operations for a specific company
const myOps = await operations({ companyId }).getAll({ limit: 10 });

// Get cars for kilometric indemnities
const myCars = await cars({ companyId }).getAll();
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
