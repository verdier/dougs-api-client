# dougs-api-client

A TypeScript client that provides an easy and clean way to interact with your Dougs.fr accounting data.

> [!WARNING]
> **Unofficial**: This client is not affiliated with Dougs.fr. Use at your own risk.

## Features

- **Simple API**: Clean, typed endpoints for companies, operations, and vehicles
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

const { companies, operations, cars } = makeEndpoints(client);

// Get all companies
const myCompanies = await companies.getAll();

// Get operations for a specific company
const myOps = await operations(12345).getAll({ limit: 10 });

// Get cars for kilometric indemnities
const myCars = await cars(12345).getAll();
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
