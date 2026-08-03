# dougs-api-client

A TypeScript client that provides an easy and clean way to interact with your Dougs.fr accounting data.

> [!WARNING]
> **Unofficial**: This client is not affiliated with Dougs.fr. Use at your own risk.

## Features

- **Simple API**: Clean, typed endpoints for companies, operations, vehicles, and users
- **Curated data model**: Exposes only relevant business data, abstracting away internal API complexity
- **Session management**: Automatic login and session persistence
- **TypeScript first**: Full type definitions for all DTOs
- **Reusable action contract**: Stable names, Zod input schemas, dispatch, and safety metadata for all endpoint actions
- **MCP server included**: The `dougs-mcp-server` stdio executable exposes the same action contract with MCP safety annotations

## Installation

```bash
npm install dougs-api-client
```

## 2.0.1 release notes

**Breaking change:** this unofficial wrapper no longer exports the legacy generated `registry` or `types` catalogs. Use the public `actions` runtime contract instead. The MCP stdio executable (`dougs-mcp-server`) is now bundled with the package.

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

## MCP stdio server

The package installs `dougs-mcp-server`. Configure its environment and launch it from any MCP client:

```json
{
  "command": "dougs-mcp-server",
  "env": {
    "DOUGS_EMAIL": "your@email.com",
    "DOUGS_PASSWORD": "your_password"
  }
}
```

The public `actions` export is transport-neutral and can be reused by other adapters. HTTP paths and response mapping remain owned by the endpoint implementations.

## Security & privacy

- This is an **unofficial** client, not affiliated with Dougs.fr. Use it only with an account and environment you trust.
- Keep `DOUGS_EMAIL`, `DOUGS_PASSWORD`, cookies, and access tokens out of source control and logs. Prefer your secret manager or MCP host credential store over plaintext files.
- `sessionPath` (including `.session.json`) stores reusable authenticated session material. Treat it like a password: keep it private, do not share it, and delete it to force a fresh login. Put it in a private, application-owned directory (for example mode `0700`); the cache itself is hardened to owner-only permissions (`0600`) where the operating system permits it. Do not place it in a shared directory or replace it with a symlink.
- MCP tool responses can contain sensitive financial and personal data. Run the stdio server only for trusted MCP clients and avoid forwarding its output to third parties.
- Login and authenticated API redirects are followed manually and only within the configured Dougs credential-free HTTPS origin. File-download redirects to signed S3/CDN URLs remain a separate, cookie-free flow.
- P2 deferred hardening: callers must keep the session directory private; session-path symlink/TOCTOU defenses are not yet enforced by the client.

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Development & Testing

The default suite is offline/unit-only and never reads credentials or calls Dougs:

```bash
npm test
```

Live integration tests are opt-in and may create and delete financial test data. Configure dedicated test credentials outside the repository; never commit credentials or a session cache.

```bash
npm run test:integration
```
