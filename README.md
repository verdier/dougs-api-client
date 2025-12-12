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
import { Client } from 'dougs-api-client';

const client = new Client({
    email: "your@email.com",
    password: "your_password",
    sessionPath: '.session.json' // Optional: persists login session
});

// Get current user information
const currentUser = await client.api.users.getMe();
console.log(`User: ${currentUser.email}`);
console.log(`Company IDs:`, currentUser.companies.map(c => c.id));

// Get details for a specific company
const companyId = currentUser.companies[0].id;
const company = await client.api.companies.getOne(companyId);

// Get operations for a specific company
const myOps = await client.api.operations({ companyId }).getAll({ limit: 10 });
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
