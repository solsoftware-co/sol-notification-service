# Implementation Plan: Google Sheets Sink for Form Notifications

**Branch**: `016-google-sheets-sink` | **Date**: 2026-04-13 | **Spec**: [spec.md](spec.md)

## Summary

Adds an optional, per-invocation Google Sheets row-append step to the form notification workflow, controlled entirely by the calling application via the `form/submitted` event payload. Simultaneously migrates the weekly analytics report from a global `GA4_SERVICE_ACCOUNT_JSON` environment variable to per-client Google service account credentials stored in the database. Both integrations share the same credential: a service account JSON key registered once per client in two new `clients` table columns (`google_service_account_email`, `google_service_account_key`).

Sheets auth uses `google-auth-library` (JWT class) — already present transitively — plus raw `fetch()` to the Google Sheets REST API. No `googleapis` package is added.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: `inngest ^3.x`, `@neondatabase/serverless ^1.x`, `resend ^3.x`, `@google-analytics/data ^4.x`, `google-auth-library ^10.x` (promote from transitive to direct dep)  
**Storage**: Neon PostgreSQL — V003 migration adds `google_service_account_email TEXT NULL` and `google_service_account_key TEXT NULL` to `clients` table  
**Testing**: Vitest 2.x  
**Target Platform**: Vercel (Node.js 20 serverless) + Inngest cloud  
**Project Type**: Event-driven workflow service  
**Performance Goals**: Sheets write must not measurably increase email delivery latency; both operations complete within a single Inngest step execution window  
**Constraints**: Sheets write is non-blocking (failure must not propagate); must stay within Inngest free tier (50k runs/month)  
**Scale/Scope**: Multi-tenant; per-client credential isolation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Event-Driven Workflow First | ✅ Pass | Sheets write added as `step.run("sync-to-google-sheets")` in existing Inngest function. GA4 refactor stays within existing step structure. |
| II — Multi-Environment Safety | ✅ Pass | Sheets write skipped in `mock` and `test` modes — only active in `live`. Mirrors email mode enforcement pattern in `src/lib/email.ts`. |
| III — Multi-Tenant by Design | ✅ Pass | Credentials fetched per-client from DB via `getClientById()`. No global credential shared across clients. |
| IV — Observability by Default | ✅ Pass | Sheets write outcome (`success`/`error`) stored in notification log `metadata`. Step name is `"sync-to-google-sheets"`. Failures logged with `clientId`. |
| V — AI-Agent Friendly | ✅ Pass | Spec exists. New module `src/lib/sheets.ts` follows same pattern as `analytics.ts`. |
| VI — Minimal Infrastructure | ⚠️ Note | `google-auth-library` added as direct dep. Already in transitive tree (via `@google-analytics/data`); no new transitive packages pulled. No constitution amendment required per research decision. |

**Post-design re-check**: All gates pass. The `src/lib/sheets.ts` abstraction mirrors the existing `analytics.ts` pattern, keeping the codebase consistent and AI-navigable.

## Project Structure

### Documentation (this feature)

```text
specs/016-google-sheets-sink/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: library choice, auth pattern, env behavior
├── data-model.md        # Phase 1: DB schema, TypeScript types, module contracts
├── quickstart.md        # Phase 1: local testing guide
├── contracts/
│   └── form-submitted-event.md   # Updated event payload contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes

```text
db/migrations/
└── V003__add_google_service_account_columns.sql   # NEW — two columns on clients

src/
├── types/
│   └── index.ts                   # MODIFY — add GoogleSheetsDestination, extend FormSubmittedPayload, update Client type
├── lib/
│   ├── config.ts                  # MODIFY — remove ga4CredentialsJson / GA4_SERVICE_ACCOUNT_JSON
│   ├── db.ts                      # MODIFY — include new columns in getClientById() SELECT
│   ├── analytics.ts               # MODIFY — accept credentialsJson param, remove config.ga4CredentialsJson ref
│   └── sheets.ts                  # NEW — appendSheetRow() abstraction
└── inngest/
    └── functions/
        ├── form-notification.ts               # MODIFY — add sync-to-google-sheets step
        └── weekly-analytics-report.ts         # MODIFY — pass client.google_service_account_key to getAnalyticsReport()

tests/
└── unit/
    └── lib/
        └── sheets.test.ts          # NEW — unit tests for appendSheetRow()
```

**Structure Decision**: Single-project layout (Option 1). No new top-level directories. New `src/lib/sheets.ts` follows the identical pattern of `src/lib/analytics.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| `google-auth-library` as new direct dep | JWT auth is required for service account → Google Sheets REST API calls | Package is already in transitive tree; promoting to direct is the minimum footprint approach. Raw JWT signing without the library would be more code and less secure. |

## Implementation Phases

### Phase A: Database Migration

**Files**: `db/migrations/V003__add_google_service_account_columns.sql`

```sql
-- V003__add_google_service_account_columns.sql
ALTER TABLE clients
  ADD COLUMN google_service_account_email TEXT NULL,
  ADD COLUMN google_service_account_key   TEXT NULL;
```

Run with `npm run db:migrate`. Idempotent if applied twice (migration runner tracks V003).

---

### Phase B: Types

**File**: `src/types/index.ts`

1. Add `GoogleSheetsDestination` interface (see `data-model.md`).
2. Add `sheetsDestination?: GoogleSheetsDestination` to `FormSubmittedPayload`.
3. Add `google_service_account_email: string | null` and `google_service_account_key: string | null` to the `Client` type (wherever it is defined — check `src/lib/db.ts` or `src/types/index.ts`).

---

### Phase C: Database Query Update

**File**: `src/lib/db.ts`

Ensure `getClientById()` includes the two new columns in its `SELECT`. If the query uses `SELECT *` already, no change needed. If it has an explicit column list, add both columns.

---

### Phase D: New `src/lib/sheets.ts`

New module. Full implementation:

```typescript
import { JWT } from 'google-auth-library';
import { log, logError } from '../utils/logger';
import type { GoogleSheetsDestination } from '../types/index';

export interface SheetAppendResult {
  success: boolean;
  rowsAppended?: number;
  error?: string;
}

export async function appendSheetRow(
  credentialsJson: string,
  destination: GoogleSheetsDestination,
  fields: Record<string, string>,
  timestamp: string,
): Promise<SheetAppendResult> {
  try {
    const creds = JSON.parse(credentialsJson);
    const auth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const tokenResponse = await auth.getAccessToken();
    const accessToken = tokenResponse.token;
    if (!accessToken) throw new Error('Failed to obtain access token from service account');

    const row = resolveRow(destination, fields, timestamp);
    const range = destination.sheetName ? `${destination.sheetName}!A1` : 'A1';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sheets API ${response.status}: ${errText}`);
    }

    const body = await response.json() as { updates?: { updatedRows?: number } };
    const rowsAppended = body.updates?.updatedRows ?? 1;
    log('[sheets] Row appended', { spreadsheetId: destination.spreadsheetId, rowsAppended });
    return { success: true, rowsAppended };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError('[sheets] Failed to append row', { error: message, spreadsheetId: destination.spreadsheetId });
    return { success: false, error: message };
  }
}

function resolveRow(
  destination: GoogleSheetsDestination,
  fields: Record<string, string>,
  timestamp: string,
): string[] {
  if (!destination.columns) {
    return [timestamp, ...Object.values(fields)];
  }
  return destination.columns.map((col) =>
    col === '_timestamp' ? timestamp : (fields[col] ?? ''),
  );
}
```

---

### Phase E: Update `src/lib/analytics.ts`

1. Change `getAnalyticsReport` signature to accept `credentialsJson: string | null` as the third argument (before `options`).
2. Update `createClient()` to accept and use the passed-in `credentialsJson` instead of `config.ga4CredentialsJson`.
3. Update mock-fallback condition: `if (!credentialsJson || !propertyId)`.
4. All internal `runReport` / `getReportData` calls go through the already-refactored `createClient`.

---

### Phase F: Update `src/lib/config.ts`

Remove `ga4CredentialsJson` property and `GA4_SERVICE_ACCOUNT_JSON` env var reference. Update any associated type declarations.

---

### Phase G: Update `src/inngest/functions/weekly-analytics-report.ts`

Pass `client.google_service_account_key` to `getAnalyticsReport()`:

```typescript
const report = await step.run("fetch-analytics-data", async () => {
  return getAnalyticsReport(
    client.ga4_property_id,
    period,
    client.google_service_account_key,  // <-- replaces config.ga4CredentialsJson
    options,
  );
});
```

---

### Phase H: Update `src/inngest/functions/form-notification.ts`

Add a new step after `"send-email"` and before `"log-result"`. The step must:
1. Skip if `data.sheetsDestination` is absent.
2. Skip if `client.google_service_account_key` is absent.
3. Skip if `config.emailMode !== "live"` (log "skipped (non-live mode)").
4. Otherwise call `appendSheetRow(...)` and capture the result.
5. Never throw — the step returns a result object regardless of outcome.

The `sheetsOutcome` result is passed into the `"log-result"` step and stored in `metadata`:

```typescript
const sheetsOutcome = await step.run("sync-to-google-sheets", async () => {
  if (!data.sheetsDestination) return { skipped: true, reason: 'no destination in payload' };
  if (!client.google_service_account_key) return { skipped: true, reason: 'no credentials on client' };
  if (config.emailMode !== 'live') return { skipped: true, reason: 'non-live mode' };

  const fields = buildFieldMap(data);  // flatten FormSubmittedPayload to Record<string, string>
  const timestamp = new Date().toISOString();
  return appendSheetRow(client.google_service_account_key, data.sheetsDestination, fields, timestamp);
});
```

In `"log-result"`, include `sheetsOutcome` in the `metadata` written to `notification_logs`.

---

### Phase I: Unit Tests

**File**: `tests/unit/lib/sheets.test.ts`

Cover:
- `resolveRow` with explicit columns (including `_timestamp`, missing fields)
- `resolveRow` with no columns (default order)
- `appendSheetRow` returns `{ success: false }` when Sheets API returns non-200
- `appendSheetRow` returns `{ success: true }` on successful append
- Auth failure (bad credentials JSON) returns `{ success: false, error: ... }`

Mock `google-auth-library` JWT and `fetch` — do not make live API calls in unit tests.

Update existing analytics tests to pass `credentialsJson` to `getAnalyticsReport` (mock it as `null` for mock-data tests, as a JSON string for live-data tests).

---

## Dependency Change

```bash
npm install google-auth-library
```

This promotes an already-present transitive package to a direct dependency. No new transitive packages are pulled.

## Environment Variables

| Variable | Change |
|----------|--------|
| `GA4_SERVICE_ACCOUNT_JSON` | **Removed** — no longer read by the application |

No new environment variables are added. Client credentials live in the database.
