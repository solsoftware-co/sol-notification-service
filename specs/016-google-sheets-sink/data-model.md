# Data Model: Google Sheets Sink for Form Notifications

## Database Changes

### V003 Migration — `clients` table additions

Two nullable columns added to the existing `clients` table:

```sql
ALTER TABLE clients
  ADD COLUMN google_service_account_email TEXT NULL,
  ADD COLUMN google_service_account_key   TEXT NULL;
```

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `google_service_account_email` | TEXT | YES | Service account email (e.g. `name@project.iam.gserviceaccount.com`). Plain text for easy reference — copied when sharing sheets or GA4 access. |
| `google_service_account_key` | TEXT | YES | Full contents of the GCP-generated service account JSON key file, stored as a string. Parsed at authentication time. Treated as an opaque secret. |

**Existing columns unchanged**: `id`, `name`, `email`, `ga4_property_id`, `active`, `settings`, `created_at`.

---

## TypeScript Types

### New: `GoogleSheetsDestination`

Carried in the `form/submitted` event payload. Absent = no Sheets write.

```typescript
export interface GoogleSheetsDestination {
  /** ID of the target Google Spreadsheet (from the sheet URL) */
  spreadsheetId: string;
  /** Tab/sheet name within the spreadsheet. Defaults to the first sheet if omitted. */
  sheetName?: string;
  /**
   * Ordered list of field identifiers mapping submission fields to columns.
   * Use "_timestamp" for the submission timestamp.
   * If omitted: writes [timestamp, ...all form fields in received order].
   */
  columns?: string[];
}
```

### Updated: `FormSubmittedPayload`

```typescript
export interface FormSubmittedPayload extends BaseEventPayload {
  // --- existing fields ---
  submitterName?: string;
  submitterEmail?: string;
  submitterMessage?: string;
  submitterPhone?: string;
  submittedFrom?: string;
  formName?: string;
  customFields?: Record<string, string>;
  /** @deprecated Use formName instead. */
  formId?: string;

  // --- new field ---
  /**
   * Optional Google Sheets destination. When present (and client has credentials),
   * the workflow appends a row to the specified sheet after sending the email.
   */
  sheetsDestination?: GoogleSheetsDestination;
}
```

### Updated: `Client` (DB row type)

Add the two new credential columns to the existing client type in `src/types/index.ts` or `src/lib/db.ts`:

```typescript
export interface Client {
  id: string;
  name: string;
  email: string;
  ga4_property_id: string | null;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  // new
  google_service_account_email: string | null;
  google_service_account_key: string | null;
}
```

---

## New Module: `src/lib/sheets.ts`

Public surface area of the new module:

```typescript
export interface SheetAppendResult {
  success: boolean;
  rowsAppended?: number;
  error?: string;
}

/**
 * Appends one row to a Google Sheet using the client's service account credentials.
 * Never throws — returns { success: false, error } on failure.
 *
 * @param credentialsJson  Full service account JSON key string
 * @param destination      Sheet destination from the event payload
 * @param fields           Flat map of all submitted form fields (name → value)
 * @param timestamp        ISO-8601 submission timestamp
 */
export async function appendSheetRow(
  credentialsJson: string,
  destination: GoogleSheetsDestination,
  fields: Record<string, string>,
  timestamp: string,
): Promise<SheetAppendResult>;
```

Internal responsibilities:
- Parse `credentialsJson` and create a `JWT` auth client (`google-auth-library`)
- Resolve column values: apply `destination.columns` mapping, or default order
- Call `sheets.googleapis.com` append REST endpoint
- Return `SheetAppendResult` — never propagates thrown errors to caller

---

## Updated Module: `src/lib/analytics.ts`

Signature change to `getAnalyticsReport`:

```typescript
// Before
export async function getAnalyticsReport(
  propertyId: string,
  period: ResolvedPeriod,
  options?: AnalyticsReportOptions,
): Promise<AnalyticsReport>

// After
export async function getAnalyticsReport(
  propertyId: string,
  period: ResolvedPeriod,
  credentialsJson: string | null,   // <-- new, replaces config.ga4CredentialsJson
  options?: AnalyticsReportOptions,
): Promise<AnalyticsReport>
```

Mock fallback condition (unchanged behavior, new trigger):
- Before: `if (!config.ga4CredentialsJson || !propertyId)`
- After: `if (!credentialsJson || !propertyId)`

---

## Column Mapping Resolution

Given `destination.columns` and `fields` (plus `timestamp`):

| Scenario | Output row |
|----------|------------|
| `columns` absent | `[timestamp, field1Value, field2Value, ...]` in received key order |
| `columns: ["_timestamp", "email", "name"]` | `[timestamp, fields["email"] ?? "", fields["name"] ?? ""]` |
| `columns: ["name"]` and `name` missing from submission | `[""]` |
| `columns: []` (empty array) | `[]` — empty row appended |

Reserved identifiers:
- `"_timestamp"` → ISO-8601 UTC timestamp of the submission event
