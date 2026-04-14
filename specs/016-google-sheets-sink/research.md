# Research: Google Sheets Sink for Form Notifications

## Decision 1: Google Sheets API Client Library

**Decision**: Use `google-auth-library` (direct dep addition) + raw `fetch()` to the Sheets REST API. Do NOT add `googleapis`.

**Rationale**:
- `googleapis` is not present in `node_modules` — it would be a new, large (~14 MB) dependency.
- `google-auth-library` IS already present transitively (via `@google-analytics/data`, v10.6.1). Making it a direct dependency is a lightweight promotion — no new code pulled in.
- The Google Sheets REST API append endpoint is a single, stable HTTP call. Wrapping it in `googleapis` client code adds no value over a typed `fetch()`.
- This approach avoids a Principle VI constitution amendment while still getting type-safe auth.

**Pattern**:
```typescript
import { JWT } from 'google-auth-library';

async function getSheetsAccessToken(credentialsJson: string): Promise<string> {
  const creds = JSON.parse(credentialsJson);
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const token = await auth.getAccessToken();
  return token.token!;
}

// Append a row via REST
async function appendRow(accessToken: string, spreadsheetId: string, sheetName: string, values: string[]) {
  const range = sheetName ? `${sheetName}!A1` : 'A1';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets API error ${response.status}: ${err}`);
  }
}
```

**Alternatives considered**:
- `googleapis` npm package: too large, not already present, adds unnecessary surface area.
- `google-spreadsheet` (npm): lightweight wrapper but still a new dep; does not justify added dep vs. raw fetch.
- Raw HTTP with manual JWT signing: more code, no benefit over `google-auth-library` JWT class.

---

## Decision 2: Multi-Environment Behavior for Sheets Writes

**Decision**: Skip the Sheets write step in `mock` and `test` email modes. Only write in `live` mode.

**Rationale**:
- Principle II requires mode-controlled behavior. Sheets writes have side effects (appending real data to a real sheet) analogous to real email sends.
- `mock` mode = local dev: no external calls, period.
- `test` mode = preview/staging: safe for email (redirected), but Sheets writes would pollute client-owned sheets with staging data.
- `live` mode = production: all external integrations active.
- This mirrors the exact pattern used by `src/lib/email.ts` for email mode enforcement.

**Implementation**: In `step.run("sync-to-google-sheets")`, check `config.emailMode !== "live"` first. If true, log "skipped (non-live mode)" and return early — no error, no throw.

---

## Decision 3: GA4 Credentials Refactor

**Decision**: Add an explicit `credentialsJson: string | null` parameter to `getAnalyticsReport()`. The existing `createClient()` internal function becomes `createClient(credentialsJson: string)`. Fall back to mock when `credentialsJson` is null.

**Rationale**:
- Current code: `createClient()` reads from `config.ga4CredentialsJson` (global env var).
- Target: `getAnalyticsReport(propertyId, period, credentialsJson, options)` — caller passes the client's stored key.
- `config.ga4CredentialsJson` is removed from `config.ts`; `GA4_SERVICE_ACCOUNT_JSON` env var no longer required.
- Mock fallback path: `if (!credentialsJson || !propertyId) → return mockReport(period)` — identical to today's behavior, just triggered by missing client credential instead of missing env var.
- Call site (`weekly-analytics-report.ts`) passes `client.google_service_account_key`.

---

## Decision 4: Database Schema (V003 Migration)

**Decision**: Two new nullable `TEXT` columns on `clients` table — `google_service_account_email` and `google_service_account_key`. No JSONB; plain columns.

**Rationale**:
- `google_service_account_email` stored as `TEXT NULL`: readable without JSON parsing, used for display during onboarding and sheet-sharing reference.
- `google_service_account_key` stored as `TEXT NULL`: stores the full JSON key file as a string (parsed at auth time). `TEXT` chosen over `JSONB` because the value is treated as an opaque secret blob, never queried by field.
- Both nullable: existing clients without Google integrations are unaffected.
- Aligns with existing `ga4_property_id TEXT NULL` pattern already on the `clients` table.

---

## Decision 5: New `src/lib/sheets.ts` Module

**Decision**: Create a new `src/lib/sheets.ts` following the same abstraction pattern as `src/lib/analytics.ts` and `src/lib/email.ts`.

**Rationale**:
- Keeps Google Sheets logic isolated and independently testable.
- Constitution Principle IV: the module is the right boundary for logging and error capture.
- Exported function: `appendSheetRow(credentialsJson, destination, submissionFields, timestamp)` returns `{ success: boolean; error?: string }` — never throws. Callers don't need to handle exceptions; they log the returned result.

---

## Decision 6: Column Mapping Logic

**Decision**: Column mapping is an ordered `string[]` in the event payload (`sheetsDestination.columns`). Each entry is a form field name or the reserved string `"_timestamp"`.

**Rules**:
- If `columns` is present: write only the listed fields in declared order. Missing fields → empty string.
- If `columns` is absent: write `[timestamp, ...Object.values(formFields)]` — timestamp first, then all fields in received order.
- `_timestamp` reserved identifier maps to the ISO-8601 submission timestamp (`event.ts` or current time).
- The column mapping is validated structurally (must be `string[]` if present) but individual field names are never validated — missing fields silently produce empty cells.

---

## Packages to Add

| Package | Version | Justification |
|---------|---------|---------------|
| `google-auth-library` | `^10.x` | Already in transitive tree; promote to direct dep for Sheets JWT auth. Minor Principle VI note — no constitution amendment required given it's not a new transitive pull. |
