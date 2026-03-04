# Implementation Plan: Professional Email Template System

**Branch**: `006-email-templates` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-email-templates/spec.md`

---

## Summary

Replace inline HTML string builders in both workflow functions with a professional React Email component library. The `emails/` directory is relocated to `src/emails/`, wired to a new `src/lib/templates.ts` integration module, and rebuilt with a strict design-token system informed by current B2B SaaS email best practices. Key improvements: body text raised from 12px/weight-300 to 15px/weight-400; card padding from 12px to 24px; container padding from 8px to 32px; a system font stack replaces Geist (not email-safe); a 2×2 metric grid replaces the single-column stat stack; inquiry email gains stacked label-value fields, a left-accent message block, and a CTA reply button; analytics email gains trend indicators and data tables for top sources/pages. No new Inngest functions or database changes are required.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `@react-email/components` (new), `@react-email/render` (new), `react ^18` (new), existing: `inngest ^3`, `resend ^3`, `@neondatabase/serverless ^1`
**Storage**: Neon PostgreSQL — no schema changes
**Testing**: Vitest 2.x — new unit tests for `src/lib/templates.ts` render functions
**Target Platform**: Node.js 20+ server-side rendering; email clients (Gmail, Outlook, Apple Mail)
**Project Type**: Internal library module (email rendering) integrated into existing web service
**Performance Goals**: Template render completes in < 200ms per email (client-side non-blocking, render occurs inside `step.run()`)
**Constraints**: Inline styles only (no CSS classes/variables); CID attachment for banner logo; all tokens in single `src/emails/styles.ts` file
**Scale/Scope**: Two email templates; two workflow functions updated; one preview script updated

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design below.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I — Event-Driven Workflow First** | ✅ Pass | No new Inngest functions. Existing functions updated to call `renderXxxEmail()` inside existing `step.run("send-email")` calls. No workflow structure changes. |
| **II — Multi-Environment Safety** | ✅ Pass | Templates are pure render functions with no env-specific logic. All EMAIL_MODE routing remains in `src/lib/email.ts` unchanged. |
| **III — Multi-Tenant by Design** | ✅ Pass | Templates receive `client.name` as prop — no client data hardcoded. Each render call is scoped to the resolved `ClientRow`. |
| **IV — Observability by Default** | ✅ Pass | No logging changes needed. Template render is called inside existing `step.run()` calls. Render errors surface naturally as step failures with full stack traces in Inngest dashboard. |
| **V — AI-Agent Friendly Codebase** | ✅ Pass | Spec exists. `src/lib/templates.ts` follows the single-function-per-email-type pattern. `quickstart.md` documents the pattern for AI-generated templates. |
| **VI — Minimal Infrastructure** | ⚠️ Amendment Required | New dependencies (`react`, `@react-email/*`) are not in the approved Technology Stack. A PATCH constitution amendment is required before merge. See Complexity Tracking below. |

**Post-design re-check**: No design decisions introduced new violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-email-templates/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 decisions
├── data-model.md        # Type definitions and field mappings
├── quickstart.md        # Developer guide: previewing, adding templates, updating brand
├── contracts/
│   └── templates-api.md # src/lib/templates.ts public interface contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Changes (repository root)

```text
# New/relocated directory
src/emails/                          # relocated from emails/ at root
├── styles.ts                        # REWRITE: token object (colors, typography, spacing, radii)
│                                    #   replacing flat style exports; all components derive from tokens
├── components/
│   ├── banner.tsx                   # minor update: centred layout, increased vertical padding
│   ├── email-header.tsx             # REWRITE: 28px/700 title, subtitle, optional period/date line
│   ├── email-footer.tsx             # NEW: copyright, org name, automated notice; muted styling
│   ├── stat-card.tsx                # REWRITE: left-aligned number, ALL-CAPS label, optional trend line
│   ├── chart-card.tsx               # minor update: new card border/padding treatment
│   ├── field-group.tsx              # NEW: replaces customer-info; stacked label-value fields
│   │                                #   via table layout; Outlook-safe; accepts {label, value}[] array
│   ├── message-block.tsx            # NEW: full-width message display; 4px left accent border;
│   │                                #   light background; preserves line breaks
│   ├── cta-button.tsx               # NEW: primary (#2563EB) and secondary (outlined) variants;
│   │                                #   renders as table-based bulletproof button for Outlook
│   ├── data-table.tsx               # NEW: header row (ALL-CAPS, muted bg) + data rows with
│   │                                #   1px border-bottom separators; max 7 rows
│   └── section-divider.tsx          # NEW: thin <Hr> wrapper with standard vertical spacing
└── templates/
    ├── sales-lead-v1.tsx            # REWRITE: new layout (field-group, message-block, cta-button,
    │                                #   footer, preview text); optional extended fields
    └── analytics-report-v1.tsx     # REWRITE: 2×2 metric grid, section-divider, data tables for
                                     #   top sources/pages/daily, footer, preview text

src/lib/
└── templates.ts                     # NEW: renderFormNotificationEmail(), renderAnalyticsReportEmail()

src/types/
└── index.ts                         # updated: EmailAttachment, EmailRenderResult, EmailRequest.attachments

src/inngest/functions/
├── form-notification.ts             # updated: call renderFormNotificationEmail() in send-email step
└── weekly-analytics-report.ts      # updated: call renderAnalyticsReportEmail(); remove buildReportEmail()

scripts/
└── test-email-preview.ts            # updated: use real templates with mock data for preview

assets/                              # NEW directory
└── banner_image.png                 # banner logo (may already exist elsewhere — locate and move)

tsconfig.json                        # updated: add "jsx": "react-jsx"

package.json                         # updated: add react, react-dom, @react-email/components,
                                     #   @react-email/render to dependencies;
                                     #   add @types/react, @types/react-dom to devDependencies

.specify/memory/constitution.md      # PATCH amendment: add react + react-email to Technology Stack

# Deleted
emails/                              # removed after relocation to src/emails/
```

**Structure Decision**: Single project layout. The `emails/` directory at root is relocated to `src/emails/` to align with the existing `tsconfig.json` `rootDir: "src"` configuration, requiring only the addition of `"jsx": "react-jsx"` to compiler options. The existing `src/lib/` pattern is extended with `templates.ts` as the integration bridge.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|---------------------------------------|
| Adding `react`, `react-dom`, `@react-email/components`, `@react-email/render` — not in approved Technology Stack (Principle VI) | The `emails/` directory was established with React Email JSX components at project inception, making these dependencies the intended integration path. Without them, the `emails/` investment is unusable. | Raw HTML template strings (current approach) cannot be composed with shared components, cannot enforce design tokens across templates, and contradict the existing `emails/` artefact. The approach is also more error-prone and harder to maintain than JSX components. |

---

## Design Reference

### Inquiry Email Layout

```
┌─────────────────────────────────────────────┐  bg: #F4F4F5
│                                             │
│              [Sol Software logo]            │  banner; 32px top padding
│                                             │
│  ┌───────────────────────────────────────┐  │  card; bg: #FFF; border: 1px #E4E4E7
│  │                                       │  │  padding: 24px
│  │    Acme Corp                          │  │  subheader: 13px/400/#A1A1AA
│  │    New Inquiry                        │  │  title: 28px/700/#09090B
│  │                                       │  │
│  │  ─────────────────────────────────    │  │  <SectionDivider />
│  │                                       │  │
│  │  NAME                  EMAIL          │  │  <FieldGroup /> 2-col grid
│  │  Casey Ramirez         casey@...      │  │  label: 11px/600/CAPS/#A1A1AA
│  │                                       │  │  value: 15px/400/#09090B
│  │  PHONE                 INTERESTED IN  │  │
│  │  +1 (555) 000-0000     Web Design     │  │  optional fields omitted if absent
│  │                                       │  │
│  │  ─────────────────────────────────    │  │  <SectionDivider />
│  │                                       │  │
│  │  MESSAGE                              │  │  <MessageBlock />
│  │  ┃ Hi, I'm interested in a new        │  │  bg: #F4F4F5
│  │  ┃ website for my business...         │  │  left border: 4px solid #2563EB
│  │  ┃                                    │  │  padding: 16px; 15px/400/1.6
│  │                                       │  │
│  │  ─────────────────────────────────    │  │  <SectionDivider />
│  │                                       │  │
│  │  SUBMITTED    Mar 3, 2026 9:00am UTC  │  │  additional info (metadata)
│  │  SOURCE PAGE  example.com/contact     │  │  omitted if absent
│  │                                       │  │
│  │  [ Reply to Casey Ramirez  →  ]       │  │  <CTAButton /> mailto link
│  │                                       │  │  bg: #2563EB; white text; radius: 6px
│  │                                       │  │
│  │  ─────────────────────────────────    │  │
│  │  © 2026 Sol Software · Automated     │  │  <EmailFooter />
│  └───────────────────────────────────────┘  │  13px/400/#A1A1AA; centred
│                                             │
└─────────────────────────────────────────────┘
```

### Analytics Email Layout

```
┌─────────────────────────────────────────────┐  bg: #F4F4F5
│                                             │
│              [Sol Software logo]            │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │    Acme Corp                          │  │
│  │    Weekly Analytics Report            │  │
│  │    Feb 24 – Mar 2, 2026               │  │  period line: 15px/400/#52525B
│  │                                       │  │
│  │  ─────────────────────────────────    │  │  <SectionDivider />
│  │                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐    │  │  <StatCard /> 2×2 grid via Row+Column
│  │  │ SESSIONS     │  │ AVG DURATION│    │  │  label: 11px/600/CAPS/#A1A1AA
│  │  │ 12,340       │  │ 2m 34s      │    │  │  value: 52px/300/#09090B
│  │  │ ↑ +8.2%      │  │ → steady    │    │  │  trend: 13px; green/muted
│  │  │ vs last week │  │ vs last week│    │  │  desc: 13px/400/#52525B
│  │  └─────────────┘  └─────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ ACTIVE USERS│  │ NEW USERS   │    │  │
│  │  │ 8,900        │  │ 1,240       │    │  │
│  │  │ ↑ +5.1%      │  │ ↑ +22.4%   │    │  │
│  │  └─────────────┘  └─────────────┘    │  │
│  │                                       │  │
│  │  ─────────────────────────────────    │  │  <SectionDivider />
│  │                                       │  │
│  │  TOP TRAFFIC SOURCES                  │  │  <DataTable /> (omitted if empty)
│  │  SOURCE              SESSIONS         │  │  header: 11px/600/CAPS/#A1A1AA/#F4F4F5
│  │  google              4,210            │  │  rows: 14px/400/#09090B
│  │  direct              2,880            │  │  separator: 1px solid #E4E4E7
│  │  instagram           1,050            │  │  max 7 rows
│  │                                       │  │
│  │  ─────────────────────────────────    │  │
│  │                                       │  │
│  │  TOP PAGES                            │  │  <DataTable /> (omitted if empty)
│  │  PAGE                VIEWS            │  │
│  │  /                   5,420            │  │
│  │  /about              1,830            │  │
│  │                                       │  │
│  │  ─────────────────────────────────    │  │
│  │  © 2026 Sol Software · Automated     │  │  <EmailFooter />
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase A — Foundation

1. **Constitution PATCH** (`constitution.md`) — Add `@react-email/components`, `@react-email/render`, and `react ^18` to Technology Stack table.
2. **Install dependencies** — `npm install react react-dom @react-email/components @react-email/render` and dev deps `@types/react @types/react-dom`.
3. **Update `tsconfig.json`** — Add `"jsx": "react-jsx"` to `compilerOptions`.
4. **Relocate `emails/` → `src/emails/`** — Move all files; update import paths within the emails directory.
5. **Locate/create `assets/banner_image.png`** — Find existing banner image in codebase; if absent, create a placeholder and document where the real asset must be placed.

### Phase B — Design Token System

6. **Rewrite `src/emails/styles.ts`** — Replace flat style-object exports with a structured `tokens` object: `tokens.colors.*`, `tokens.typography.*`, `tokens.spacing.*`, `tokens.radii.*`. All component style objects derive from tokens. Specific values from research Decision 8–10:
   - Body text: `fontSize: '15px', fontWeight: 400, lineHeight: '1.6'`
   - Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
   - Card: `padding: '24px', borderRadius: '8px', border: '1px solid #E4E4E7'`
   - Container side padding: `32px`

### Phase C — New Components

7. **Rewrite `src/emails/components/email-header.tsx`** — 28px/700 title, 13px muted subheader, optional period/date subtitle line below the title.
8. **Create `src/emails/components/email-footer.tsx`** — Centred footer: `© {year} Sol Software · Sent automatically by the notification service`. Font: 13px/400/`#A1A1AA`.
9. **Rewrite `src/emails/components/stat-card.tsx`** — Left-aligned 52px/300 number, 11px/600/ALL-CAPS label, 13px context description, optional trend line (`↑ +X%` in `#16A34A`, `→` in `#A1A1AA`).
10. **Create `src/emails/components/field-group.tsx`** — Accepts `fields: Array<{label: string, value: string}>`. Renders in a 2-column `<Row>/<Column>` grid (Outlook-safe table). Label style: 11px/600/ALL-CAPS/`#A1A1AA`. Value style: 15px/400/`#09090B`. Gap 2px between label and value; 16px between field pairs.
11. **Create `src/emails/components/message-block.tsx`** — Full-width block for form message/comments. Background: `#F4F4F5`. Left border: `4px solid #2563EB`. Padding: `16px`. Font: 15px/400/1.6/`#09090B`. Preserves whitespace.
12. **Create `src/emails/components/cta-button.tsx`** — Bulletproof button (table-based for Outlook). Props: `href`, `label`, `variant: 'primary' | 'secondary'`. Primary: `background: #2563EB`, white text, `border-radius: 6px`, `padding: 12px 24px`. Secondary: transparent background with `border: 1.5px solid #2563EB`, `#2563EB` text.
13. **Create `src/emails/components/data-table.tsx`** — Props: `columns: string[]`, `rows: string[][]`. Header row: 11px/600/ALL-CAPS/`#A1A1AA`, `background: #F4F4F5`. Data rows: 14px/400/`#09090B`, `border-bottom: 1px solid #E4E4E7`. Cell padding: `10px 12px`. Max 7 rows enforced by the caller.
14. **Create `src/emails/components/section-divider.tsx`** — `<Hr>` with `border: 1px solid #E4E4E7`, `margin: 0`, wrapped in a `<Section>` with `padding: '24px 0'`.
15. **Update `src/emails/components/chart-card.tsx`** — Apply new card border/padding treatment from tokens.

### Phase D — Template Rewrites

16. **Rewrite `src/emails/templates/sales-lead-v1.tsx`** — New layout using `FieldGroup`, `MessageBlock`, `CTAButton`, `SectionDivider`, `EmailFooter`. Add `<Preview>` in `<Head>`. Make `customerPhone`, `interestedIn`, `sourcePageText/Link`, `logText/Link` optional; omit their sections when absent. Export `InquiryEmailProps` interface.
17. **Rewrite `src/emails/templates/analytics-report-v1.tsx`** — New layout using 2×2 `StatCard` grid (`<Row>/<Column>`), `SectionDivider`, `DataTable` for top sources / top pages / daily metrics (each conditional on non-empty array), optional `ChartCard` sections, `EmailFooter`. Add `<Preview>` in `<Head>`. Export `AnalyticsEmailProps` interface.

### Phase E — Integration Layer

18. **Add types to `src/types/index.ts`** — `EmailAttachment`, `EmailRenderResult`; extend `EmailRequest` with `attachments?: EmailAttachment[]`.
19. **Create `src/lib/templates.ts`** — Implement `renderFormNotificationEmail()` and `renderAnalyticsReportEmail()`. Read banner from `assets/banner_image.png`. Call `render()`. Return `EmailRenderResult`.
20. **Update `src/lib/email.ts`** — Forward `request.attachments` to `resend.emails.send()` when present. Mock mode: skip attachments.

### Phase F — Workflow Wiring

21. **Update `src/inngest/functions/form-notification.ts`** — Replace inline HTML with `await renderFormNotificationEmail(data, client)` inside `step.run("send-email")`.
22. **Update `src/inngest/functions/weekly-analytics-report.ts`** — Replace `buildReportEmail()` with `await renderAnalyticsReportEmail(report, client, resolvedPeriod)`. Remove `buildReportEmail()`, `formatDuration()`, and table row helpers.

### Phase G — Preview Script & Tests

23. **Update `scripts/test-email-preview.ts`** — Render both templates with realistic mock data (include all optional fields, top sources/pages with 5 entries each, daily metrics for 7 days). Write separate `.email-preview/inquiry.html` and `.email-preview/analytics.html`.
24. **Add unit tests** in `tests/unit/lib/templates.test.ts` — Test both render functions with mock inputs. Assert `html` contains expected content. Assert `subject` is correctly formatted. Assert `attachments` contains banner. Assert optional fields are absent from rendered HTML when not provided. Mock `fs.readFile`.

### Phase H — Cleanup

25. **Delete `emails/` root directory** — Fully relocated to `src/emails/`.
26. **Run type-check** — `npm run type-check`; resolve any TypeScript errors.
27. **Run full test suite** — `npm test`; all existing tests must pass; new template tests must pass.
28. **Run email preview** — `npm run email:preview`; visually verify both templates in browser.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CID attachments not rendering in email clients that block inline images | Low | Banner falls back to alt text; email remains readable without the logo. Future upgrade path: switch to HTTPS URL. |
| `@react-email/render` async API changes between minor versions | Low | Pin to specific minor version in package.json (`^1.0.0`). |
| Resend `attachments` parameter shape differs from EmailAttachment type | Medium | Verify against Resend SDK types during Phase E; adjust `EmailAttachment` interface if needed. |
| `tsx` hot-reload not picking up moved `emails/` files on first run | Low | Restart dev server after relocation; no runtime behaviour change expected. |
| Existing `weekly-analytics-report` tests break due to removed `buildReportEmail` helper | Medium | Update `tests/unit/inngest/weekly-analytics-report.test.ts` to mock `src/lib/templates.ts` instead of mocking the removed helper. |
