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

## 2.2.0 release notes

- **Narrow live-proven breakdown writes:** `operations_add_breakdown_detail` appends only the UI's zero-residual uncategorized detail; category and amount setters change exactly one existing business line; `operations_set_breakdown_is_investment` changes only the dynamically discovered boolean; and `operations_remove_breakdown_detail` removes one non-counterpart, non-fee business line. No public full-vector replacement, compound reventilation, auto-association, or auto-categorization exists.
- **One-shot accounting gate:** each line write requires the exact `updatedAt` from its final GET, rejects validated/locked/draft records and ambiguous line scope, sends one POST only, then independently verifies the persisted operation. There is no provider CAS: a residual GET→POST race remains. An unknown or unverifiable post must never be replayed.
- **Intentional intermediate imbalance:** amount and removal actions require an exact expected resulting total and validity flag. They may leave an operation unbalanced; any repair must be separately authorized in a later call. Existing already-unbalanced records are permitted so that repair is possible.
- The bounded `operations_get_breakdown_association_candidates` read preflights the scoped operation/line/association/slot and returns the curated `{ descriptor, items, preferredItems }` envelope, omitting provider blobs. Record association assignment remains deliberately unavailable.
- `operations.createExpenseReport()` remains strict: every initial allocation must be in the contextual create route. This avoids claiming an unproven provider multi-line create capability.
- Adds curated accounting-category and fixed-asset reads, plus narrowly scoped generic expense, fixed-asset creation, and vendor-invoice attachment actions. Full category catalogues return curated category objects; contextual category routes return validated numeric category IDs.
- Adds `operations.createExpenseReport()` and the `operations_create_expense_report` MCP action for a personally-paid expense report with 1–20 exact-cent business allocations. The client derives the total and creates exactly one provider-owned partner counterpart; callers cannot provide a total, counterpart, or provider sentinel.
- `operations.createExpense()` remains the compatible one-line convenience wrapper. Both expense paths preflight the contextual category set and company partner once, POST once, verify the returned creation shape, then independently GET the created ID to verify the complete unordered allocation vector and persisted coherence fields. Missing POST-only coherence keys are tolerated; any explicit incoherence or failed/mismatched reconciliation GET is a static no-retry result.
- Optional client config `operationMemoTag: "jarvis"` appends a terminal `#jarvis` to operation writes, idempotently. The slug is strictly `[A-Za-z0-9][A-Za-z0-9_-]{0,31}` (without `#`); tagged final memos over the accounting limit fail rather than truncate.
- Invoice reads expose provider operation suggestions and matched-operation references only as `{ id, date, amount, type, isInbound }`. Operation reads expose source-document vendor-invoice suggestions only as `{ sourceDocumentId, date, amount, type }`. Both omit provider metadata, search indexes, wording, file data, external references, and transaction internals; malformed operation suggestions are omitted without blocking the unrelated operation read.
- Mutations are deliberately narrow and one-shot: they preflight provider-scoped inputs, never follow redirects or replay authentication, and return a static do-not-retry error when a completed write cannot be verified. For `EXPENSE_REPORT_UNVERIFIED_POST`, reconcile the possible write by tagged memo and a scoped GET; never replay the create.

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
    "DOUGS_PASSWORD": "your_password",
    "DOUGS_OPERATION_MEMO_TAG": "jarvis"
  }
}
```

`DOUGS_OPERATION_MEMO_TAG` is optional and is never accepted from MCP tool input; it is validated at server startup and applies only operation memo writes.

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
