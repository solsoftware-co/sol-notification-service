# Data Model: Per-Client Notification Preferences

## No schema changes required

All changes are contained within the existing `clients.settings JSONB` column. No new tables, columns, or migrations are needed.

---

## `clients.settings` — extended structure

The `settings` column already exists as `JSONB NOT NULL DEFAULT '{}'`.

This feature introduces a convention for the `notifications` key within that column.

### Structure

```json
{
  "notifications": {
    "<workflow_key>": ["<email_address>", "..."]
  }
}
```

### Known workflow keys

| Key | Workflow |
|-----|---------|
| `form_submitted` | `send-form-notification` (`form/submitted` event) |
| `analytics_report` | `generate-analytics-report` (`analytics/report.requested` event) |

### Rules

- The `notifications` key is optional. When absent, workflows fall back to `client.email`.
- Each workflow key maps to an array of strings. Empty array (`[]`) triggers the fallback.
- Invalid addresses within the array are filtered and logged as warnings. If all are invalid, the fallback applies.
- Any future workflow can register a new key by convention — no migration required.

---

## TypeScript type changes

### `EmailRequest` (in `src/types/index.ts`)

```ts
// Before
to: string;

// After
to: string | string[];
```

### `EmailResult` (in `src/types/index.ts`)

```ts
// Before
originalTo: string;
actualTo: string;

// After
originalTo: string | string[];
actualTo: string | string[];
```

---

## New module: `src/lib/notifications.ts`

Exports a single pure function:

```ts
function resolveRecipients(client: ClientRow, workflowKey: string): string[]
```

### Resolution logic

```
1. Read client.settings.notifications?.[workflowKey]
2. If absent or not an array → return [client.email]
3. Filter array: keep only strings that are non-empty and contain "@"
4. Log a warning for each filtered-out address
5. If filtered array is empty → return [client.email]
6. Return filtered array
```

### Return value

Always returns a non-empty `string[]`. Callers pass this directly to `sendEmail({ to: recipients, ... })`.

---

## Example seeded client settings

```sql
UPDATE clients
SET settings = jsonb_set(
  settings,
  '{notifications}',
  '{"form_submitted": ["sales@hwh.com", "owner@hwh.com"], "analytics_report": ["marketing@hwh.com"]}'::jsonb
)
WHERE id = 'hwhomes';
```
