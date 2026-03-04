# Data Model: Professional Email Template System

**Feature**: 006-email-templates
**Date**: 2026-03-03

---

## Overview

This feature introduces no new database tables. All data flows from existing runtime types (`FormSubmittedPayload`, `AnalyticsReport`, `ClientRow`) through new mapping functions in `src/lib/templates.ts` to the presentation layer (`src/emails/templates/`).

The data model work in this feature is:
1. Design token definitions in `src/emails/styles.ts` (visual constants, not TypeScript types)
2. New type definitions for template props (`InquiryEmailProps`, `AnalyticsEmailProps`)
3. New type for email attachments (`EmailAttachment`)
4. Extension of `EmailRequest` with optional `attachments`
5. New render function return type (`EmailRenderResult`)

All new TypeScript types are added to `src/types/index.ts`.

---

## Design Tokens (`src/emails/styles.ts`)

These are the visual constants that underpin the entire component library. Not TypeScript types — exported as plain objects and used directly in inline style props.

### Colour tokens

```typescript
export const colors = {
  bg:            '#F4F4F5',  // email outer background
  surface:       '#FFFFFF',  // card / content block background
  border:        '#E4E4E7',  // card borders, dividers, table row separators
  textPrimary:   '#09090B',  // headings, stat numbers, field values
  textSecondary: '#52525B',  // body text, descriptions, context lines
  textMuted:     '#A1A1AA',  // footer, field labels, metadata, secondary info
  accent:        '#2563EB',  // links, CTA buttons, message-block left border
  positive:      '#16A34A',  // upward trend indicators (↑)
} as const;
```

### Typography tokens

```typescript
export const typography = {
  fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sizes: {
    display: '52px',   // stat card headline numbers
    h1:      '28px',   // email title
    h2:      '18px',   // section headings (unused currently; available for future)
    body:    '15px',   // all body / field value text
    small:   '13px',   // descriptions, context lines, footer
    label:   '11px',   // ALL-CAPS field labels (NAME, EMAIL, etc.)
  },
  weights: {
    light:   300,      // display numbers only
    regular: 400,      // body text
    medium:  600,      // labels, section headings
    bold:    700,      // email title
  },
  lineHeights: {
    tight:   '1.2',    // display numbers, large headings
    heading: '1.3',    // section headings
    body:    '1.6',    // body text, message blocks
    small:   '1.5',    // small text, footer
  },
  letterSpacing: {
    label: '0.08em',   // ALL-CAPS labels
    tight: '-0.02em',  // large display numbers
  },
} as const;
```

### Spacing tokens

```typescript
export const spacing = {
  xs:        '4px',   // label → value gap within a field
  sm:        '8px',   // between related inline elements
  md:        '16px',  // between items within a card; between field pairs
  lg:        '24px',  // card padding; between cards in a list
  xl:        '40px',  // between major template sections
  container: '32px',  // email container left/right padding
} as const;
```

### Radii and border tokens

```typescript
export const radii = {
  card:   '8px',
  button: '6px',
} as const;

export const borders = {
  card:       `1px solid ${colors.border}`,
  tableRow:   `1px solid ${colors.border}`,
  messageAccent: `4px solid ${colors.accent}`,
} as const;
```

---

## New Types in `src/types/index.ts`

### `EmailAttachment`

Represents a file attached to an outgoing email. Used for CID inline images (banner logo).

```
EmailAttachment {
  filename: string          // e.g. "banner_image.png"
  content: Buffer | string  // file contents; Buffer for binary files
  headers?: {               // optional headers for CID inline reference
    'Content-ID': string    // e.g. "<banner_image.png>"
    'Content-Disposition'?: string
  }
}
```

### `EmailRenderResult`

The output of a `src/lib/templates.ts` render function.

```
EmailRenderResult {
  subject: string           // email subject line
  html: string              // fully rendered HTML string
  previewText?: string      // inbox preview text (populated by analytics template)
  attachments: EmailAttachment[]  // CID attachments; empty array if none
}
```

### `InquiryEmailProps` (template props, lives in `src/emails/templates/`)

Props accepted by `sales-lead-v1.tsx`. Required fields map to current `FormSubmittedPayload`; extended fields are optional for future enrichment.

```
InquiryEmailProps {
  // Header
  subheader: string         // e.g. "Acme Corp" (client name)
  header: string            // e.g. "New Inquiry"
  previewText: string       // inbox preview line, e.g. "New inquiry from Casey Ramirez"

  // Required customer fields
  customerName: string      // submitterName
  customerEmail: string     // submitterEmail
  comments: string          // submitterMessage (shown in MessageBlock)
  submittedAt: string       // human-readable timestamp, e.g. "Mar 3, 2026 9:00am UTC"

  // Optional extended fields (omitted from FieldGroup when absent)
  customerPhone?: string    // shown in FieldGroup if present
  interestedIn?: string     // shown in FieldGroup if present; formId used as fallback

  // Optional metadata / contextual links (entire metadata section omitted if all absent)
  sourcePageText?: string   // display text for source page link
  sourcePageLink?: string   // URL of form submission source
  logText?: string          // display text for activity log
  logLink?: string          // URL of activity log
}
```

**Conditional rendering rules:**
- `FieldGroup` always shows `NAME` and `EMAIL` rows. `PHONE` row only when `customerPhone` is present. `INTERESTED IN` row only when `interestedIn` is present.
- `MessageBlock` only rendered when `comments` is non-empty.
- Metadata section (submitted at, source page, log) only rendered when at least one of `sourcePageLink`, `logLink`, or `submittedAt` is present.
- `CTAButton` (`mailto:` link to `customerEmail`) always rendered.

### `AnalyticsEmailProps` (template props, lives in `src/emails/templates/`)

Props accepted by `analytics-report-v1.tsx`. Metrics are required; all data table sections and charts are optional arrays — empty array → section omitted.

```
AnalyticsEmailProps {
  // Header
  subheader: string              // e.g. "Acme Corp" (client name)
  header: string                 // e.g. "Weekly Analytics Report"
  periodLabel: string            // e.g. "Feb 24 – Mar 2, 2026" (shown below title)
  previewText: string            // inbox preview, e.g. "Acme Corp — Feb 24–Mar 2: 12,340 sessions"

  // Headline metrics — displayed in 2×2 StatCard grid
  // Each metric: { value, label, description, trend? }
  // trend: { direction: 'up' | 'neutral' | 'down', text: string }
  //   e.g. { direction: 'up', text: '↑ +8.2% vs last week' }
  sessions: StatMetric           // total sessions
  avgDuration: StatMetric        // average session duration
  activeUsers: StatMetric        // active users
  newUsers: StatMetric           // new users

  // Optional data tables (empty array → section + SectionDivider both omitted)
  topSources: Array<{
    source: string               // e.g. "google"
    sessions: string             // formatted, e.g. "4,210"
  }>

  topPages: Array<{
    path: string                 // e.g. "/about"
    views: string                // formatted, e.g. "1,830"
  }>

  dailyMetrics: Array<{
    date: string                 // e.g. "Feb 24"
    sessions: string
    activeUsers: string
    newUsers: string
  }>

  // Optional chart images (empty array → section omitted)
  charts: Array<{
    title: string
    description: string
    image: string                // CID reference, e.g. "cid:chart_0.png"
  }>
}

// Shared metric type
StatMetric {
  value: string                  // formatted display value, e.g. "12,340" or "2m 34s"
  label: string                  // ALL-CAPS short label, e.g. "SESSIONS"
  description: string            // context line, e.g. "Total sessions — Feb 24–Mar 2"
  trend?: {
    direction: 'up' | 'neutral' | 'down'
    text: string                 // e.g. "↑ +8.2% vs last week"
  }
}
```

---

## Updated Types in `src/types/index.ts`

### `EmailRequest` (extended)

```diff
 export interface EmailRequest {
   to: string;
   subject: string;
   html: string;
   from?: string;
+  attachments?: EmailAttachment[];   // optional; CID inline images
 }
```

---

## Mapping: `FormSubmittedPayload` + `ClientRow` → `InquiryEmailProps`

Performed by `renderFormNotificationEmail()` in `src/lib/templates.ts`:

| Template Prop | Source |
|---|---|
| `subheader` | `client.name` |
| `header` | `"New Inquiry"` (static) |
| `customerName` | `payload.submitterName` |
| `customerEmail` | `payload.submitterEmail` |
| `comments` | `payload.submitterMessage` |
| `customerPhone` | `undefined` (not in current payload) |
| `interestedIn` | `payload.formId ?? undefined` |
| `submittedAt` | `new Date().toLocaleString("en-US", { timeZone: "UTC" })` |
| `sourcePageText` | `undefined` |
| `sourcePageLink` | `undefined` |
| `logText` | `undefined` |
| `logLink` | `undefined` |

---

## Mapping: `AnalyticsReport` + `ClientRow` + `ResolvedPeriod` → `AnalyticsEmailProps`

Performed by `renderAnalyticsReportEmail()` in `src/lib/templates.ts`:

| Template Prop | Source |
|---|---|
| `subheader` | `client.name` |
| `header` | `"Weekly Analytics Report"` (static) |
| `periodLabel` | `period.label` (e.g. `"Feb 24 – Mar 2, 2026"`) |
| `previewText` | `"${client.name} — ${period.label}: ${report.sessions.toLocaleString()} sessions"` |
| `sessions.value` | `report.sessions.toLocaleString()` |
| `sessions.label` | `"SESSIONS"` |
| `sessions.description` | `"Total sessions — ${period.label}"` |
| `sessions.trend` | `undefined` (no prior-period data in current workflow) |
| `avgDuration.value` | `formatDuration(report.avgSessionDurationSecs)` |
| `avgDuration.label` | `"AVG DURATION"` |
| `avgDuration.description` | `"Average session duration"` |
| `activeUsers.value` | `report.activeUsers.toLocaleString()` |
| `activeUsers.label` | `"ACTIVE USERS"` |
| `activeUsers.description` | `"Active users — ${period.label}"` |
| `newUsers.value` | `report.newUsers.toLocaleString()` |
| `newUsers.label` | `"NEW USERS"` |
| `newUsers.description` | `"New users — ${period.label}"` |
| `topSources` | `report.topSources.slice(0, 7).map(s => ({ source: s.source, sessions: s.sessions.toLocaleString() }))` |
| `topPages` | `report.topPages.slice(0, 7).map(p => ({ path: p.path, views: p.views.toLocaleString() }))` |
| `dailyMetrics` | `report.dailyMetrics.map(d => ({ date: d.date, sessions: ..., activeUsers: ..., newUsers: ... }))` |
| `charts` | `[]` (chart generation not implemented in current workflow) |

Note: trend indicators are left as `undefined` in the initial implementation. When the workflow is enhanced to compare against the previous period, the mapping can be updated to populate `trend.direction` and `trend.text` without any template changes.

---

## No Database Schema Changes

This feature does not add, remove, or modify any database tables or columns. All existing `clients` and `notification_logs` tables are unchanged.
