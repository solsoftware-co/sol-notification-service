# Tasks: Professional Email Template System

**Input**: Design documents from `/specs/006-email-templates/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — project already has Vitest and plan.md explicitly calls for unit tests on render functions and updated workflow function mocks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Install dependencies, configure TypeScript for JSX, relocate the `emails/` directory to `src/emails/`, and provision the banner asset.

- [x] T001 Amend `.specify/memory/constitution.md` — PATCH bump: add `react ^18`, `@react-email/components`, `@react-email/render` to Technology Stack table
- [x] T002 Install new dependencies — `npm install react react-dom @react-email/components @react-email/render` and `npm install -D @types/react @types/react-dom`
- [x] T003 [P] Update `tsconfig.json` — add `"jsx": "react-jsx"` to `compilerOptions` (no other tsconfig changes needed)
- [x] T004 Relocate `emails/` → `src/emails/` — move all 9 files (`styles.ts`, 7 components, 2 templates); update all internal import paths within the moved files (e.g. `'../styles'` remains the same relative path)
- [x] T005 Create `assets/` directory at repo root; locate existing `banner_image.png` (check `public/`, `static/`, or `emails/` subdirs) and copy it to `assets/banner_image.png`; if absent, create a 1×1 transparent PNG placeholder and add a comment in `assets/README.md` noting the real asset must be placed here before production

**Checkpoint**: `npm run type-check` should pass (modulo JSX errors in src/emails/ — expected until Phase 2 rewrites). `emails/` root directory now empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the design token system and shared brand components that EVERY template depends on. No user story work begins until these are complete.

**⚠️ CRITICAL**: Both inquiry and analytics templates compose from these shared components. Phase 3 and Phase 4 are blocked until Phase 2 is complete.

- [x] T006 Rewrite `src/emails/styles.ts` — replace all flat `CSSProperties` exports with a structured token object: `export const colors`, `export const typography`, `export const spacing`, `export const radii`, `export const borders`. Exact values from `data-model.md` Design Tokens section. Remove old `getTextStyle()`, `linkStyle`, `headerStyle`, `statTextStyle`, `infoCardStyle`, `emailSubheaderStyle`, `emailHeaderStyle`, `bodyStyle`, `containerStyle`, `contentContainerStyle` — these will be recreated inside each component using token values directly.
- [x] T007 [P] Update `src/emails/components/banner.tsx` — centre the logo image using a single-cell table; set top padding to `40px` and bottom padding to `32px` using `spacing` tokens; ensure `alt="Sol Software"` is preserved
- [x] T008 [P] Rewrite `src/emails/components/email-header.tsx` — accept props: `{ subheader: string; header: string; periodLabel?: string }`. Title: `28px / weight-700 / colors.textPrimary`. Subheader: `13px / weight-400 / colors.textMuted`. Optional `periodLabel` line: `15px / weight-400 / colors.textSecondary`, rendered below title only when present. Centre-aligned. All styles from tokens.
- [x] T009 [P] Create `src/emails/components/email-footer.tsx` — centred `<Section>` with `padding-top: 32px`. Text: `© {new Date().getFullYear()} Sol Software · Sent automatically by the notification service`. Style: `13px / weight-400 / colors.textMuted / lineHeight: '1.5'`. No props needed.
- [x] T010 [P] Create `src/emails/components/section-divider.tsx` — renders an `<Hr>` with `border: borders.tableRow`, `margin: '0'`, wrapped in a `<Section style={{ paddingTop: spacing.lg, paddingBottom: spacing.lg }}>`; no props needed

**Checkpoint**: All 5 components compile without TypeScript errors. `npm run type-check` from repo root passes on `src/emails/` files.

---

## Phase 3: User Story 1 — Recipient Receives a Professional Inquiry Notification (Priority: P1) 🎯 MVP

**Goal**: A Sol Software client receives a professional, clearly-structured inquiry notification email when a prospect submits a contact form. The email renders correctly in major clients and is wired to the live `form-notification` Inngest function.

**Independent Test**: `npm run email:preview -- --type inquiry` (or equivalent) opens a rendered inquiry HTML in the browser showing: Sol Software banner, client name subheader, "New Inquiry" title, a 2-column field grid with NAME and EMAIL, a left-accent message block with the form message, a "Reply to [Name]" CTA button, and the footer. The existing `npm test` suite continues to pass.

### Implementation for User Story 1

- [x] T011 [P] [US1] Create `src/emails/components/field-group.tsx` — props: `{ fields: Array<{ label: string; value: string; href?: string }> }`. Renders fields in a 2-column `<Row>/<Column>` grid (Outlook-safe table layout). Label style: `11px / weight-600 / ALL-CAPS / colors.textMuted / letterSpacing: typography.letterSpacing.label`. Value style: `15px / weight-400 / colors.textPrimary`. `href` present → wrap value in `<Link>` with `colors.accent`. Gap between label and value: `spacing.xs`. Gap between field pairs: `spacing.md`. Fields rendered in pairs (2 per row); odd last field spans full width.
- [x] T012 [P] [US1] Create `src/emails/components/message-block.tsx` — props: `{ message: string }`. Full-width block. Outer `<Section>`: no background. Inner `<div>`: `backgroundColor: colors.bg`, `borderLeft: borders.messageAccent`, `padding: spacing.md`, `borderRadius: '0 4px 4px 0'`. Text: `15px / weight-400 / colors.textPrimary / lineHeight: typography.lineHeights.body`. Use `whiteSpace: 'pre-wrap'` to preserve line breaks.
- [x] T013 [P] [US1] Create `src/emails/components/cta-button.tsx` — props: `{ href: string; label: string; variant?: 'primary' | 'secondary' }`. Renders as a bulletproof table-based button (not `<Button>` from react-email which has Outlook issues). Primary: `backgroundColor: colors.accent`, white text `#FFFFFF`, `borderRadius: radii.button`, `padding: '12px 24px'`, `fontSize: '15px'`, `fontWeight: 600`. Secondary: transparent bg, `border: '1.5px solid ${colors.accent}'`, `color: colors.accent`. Centred inside a `<Section style={{ textAlign: 'center', paddingTop: spacing.md }}>`.
- [x] T014 [US1] Rewrite `src/emails/templates/sales-lead-v1.tsx` — export `InquiryEmailProps` interface (from `data-model.md`) and default export component. Structure: `<Html> → <Head><Preview>{previewText}</Preview></Head> → <Body style={{ backgroundColor: colors.bg }}> → <Banner /> → <Container maxWidth="600px" padding="0 spacing.container"> → <EmailHeader subheader={...} header={...} /> → <SectionDivider /> → <FieldGroup fields={[...]} /> (NAME, EMAIL always; PHONE, INTERESTED IN conditionally) → <SectionDivider /> → {comments && <MessageBlock message={comments} />} → {comments && <SectionDivider />} → {metadata present && metadata rows} → {metadata present && <SectionDivider />} → <CTAButton href={"mailto:" + customerEmail} label={"Reply to " + customerName} /> → <EmailFooter /></Container></Body></Html>`. All conditional sections use `{condition && <Component />}` pattern.
- [x] T015 [US1] Add new types to `src/types/index.ts`: `EmailAttachment` interface, `EmailRenderResult` interface (from `contracts/templates-api.md`). Extend `EmailRequest` with `attachments?: EmailAttachment[]`.
- [x] T016 [US1] Update `src/lib/email.ts` — in `resend.emails.send()` call, spread `attachments: request.attachments` when `request.attachments` is present and non-empty. Mock and test modes: no change (attachments silently ignored). Update the `EmailRequest` import from `src/types/index.ts`.
- [x] T017 [US1] Create `src/lib/templates.ts` — implement `renderFormNotificationEmail(payload: FormSubmittedPayload, client: ClientRow): Promise<EmailRenderResult>`. Steps: (1) `fs.readFile(path.join(process.cwd(), 'assets/banner_image.png'))` → Buffer; (2) map payload fields to `InquiryEmailProps` per `data-model.md` mapping table; (3) `render(<SalesLeadV1Email {...props} />)` from `@react-email/render`; (4) return `{ subject: \`New inquiry — ${client.name}\`, html, attachments: [{ filename: 'banner_image.png', content: bannerBuffer, headers: { 'Content-ID': '<banner_image.png>' } }] }`. Import `render` from `@react-email/render`.
- [x] T018 [US1] Update `src/inngest/functions/form-notification.ts` — in `step.run("send-email", ...)`: replace inline HTML template literal with `const rendered = await renderFormNotificationEmail(data, client)` then `return sendEmail({ to: client.email, subject: rendered.subject, html: rendered.html, attachments: rendered.attachments })`. Add import for `renderFormNotificationEmail` from `../../lib/templates`.
- [x] T019 [US1] Update `scripts/test-email-preview.ts` — replace raw HTML string with: import `renderFormNotificationEmail`; create mock `FormSubmittedPayload` (name: "Casey Ramirez", email: "casey@example.com", message: multi-line mock message, formId: "Contact Form") and mock `ClientRow` (name: "Acme Corp"); call `renderFormNotificationEmail`; pass `rendered.html` to `sendEmail()`. Write output to `.email-preview/inquiry.html` via `writeEmailPreview`.
- [x] T020 [US1] Update `tests/unit/inngest/form-notification.test.ts` — add `vi.mock('../../lib/templates', () => ({ renderFormNotificationEmail: vi.fn().mockResolvedValue({ subject: 'New inquiry — Acme Corp', html: '<html>mock</html>', attachments: [] }) }))` before existing mocks. Update any assertions that previously checked the raw `html` value on `sendEmail` call args — they should now check `subject` and that `renderFormNotificationEmail` was called with the correct payload and client.

**Checkpoint**: `npm run email:preview` renders a professional inquiry email. `npm test` passes all existing and new tests.

---

## Phase 4: User Story 2 — Recipient Receives a Professional Weekly Analytics Report (Priority: P2)

**Goal**: A Sol Software client receives a professional weekly analytics email with a 2×2 metric grid, data tables for top sources and pages, and all data from the GA4 report rendered without loss. Wired to the live `weekly-analytics-report` Inngest function.

**Independent Test**: `npm run email:preview -- --type analytics` opens a rendered analytics HTML showing: Sol Software banner, client name subheader, "Weekly Analytics Report" title with period label, a 2×2 metric grid (sessions, avg duration, active users, new users), top sources table, top pages table, and footer. Existing tests pass.

### Implementation for User Story 2

- [x] T021 [P] [US2] Rewrite `src/emails/components/stat-card.tsx` — props: `{ metric: StatMetric }` where `StatMetric = { value: string; label: string; description: string; trend?: { direction: 'up' | 'neutral' | 'down'; text: string } }`. Layout: stacked — label (11px/600/ALL-CAPS/textMuted), value (52px/300/textPrimary/tight line-height), optional trend line (13px: `#16A34A` for 'up', textMuted for 'neutral'/'down'), description (13px/400/textSecondary). Card: `backgroundColor: colors.surface`, `border: borders.card`, `borderRadius: radii.card`, `padding: spacing.lg`.
- [x] T022 [P] [US2] Create `src/emails/components/data-table.tsx` — props: `{ title: string; columns: string[]; rows: string[][] }`. Renders a section heading (`15px / weight-600 / textPrimary`) followed by a full-width `<table role="presentation">`. Header row: `11px / weight-600 / ALL-CAPS / textMuted / backgroundColor: colors.bg / padding: '10px 12px'`. Data rows: `14px / weight-400 / textPrimary / borderBottom: borders.tableRow / padding: '10px 12px'`. Caller is responsible for slicing to max 7 rows before passing.
- [x] T023 [P] [US2] Update `src/emails/components/chart-card.tsx` — apply new card treatment: `border: borders.card`, `borderRadius: radii.card`, `padding: spacing.lg`. Update title to use `18px / weight-600 / textPrimary`. Update description text to `13px / weight-400 / textSecondary`. All values from tokens.
- [x] T024 [US2] Rewrite `src/emails/templates/analytics-report-v1.tsx` — export `AnalyticsEmailProps` and `StatMetric` interfaces (from `data-model.md`). Structure: `<Html> → <Head><Preview>{previewText}</Preview></Head> → <Body style={{ backgroundColor: colors.bg }}> → <Banner /> → <Container> → <EmailHeader subheader={subheader} header={header} periodLabel={periodLabel} /> → <SectionDivider /> → <Row><Column style={{ paddingRight: '8px' }}><StatCard metric={sessions} /></Column><Column style={{ paddingLeft: '8px' }}><StatCard metric={avgDuration} /></Column></Row> → <Row><Column style={{ paddingRight: '8px' }}><StatCard metric={activeUsers} /></Column><Column style={{ paddingLeft: '8px' }}><StatCard metric={newUsers} /></Column></Row> → {topSources.length > 0 && <><SectionDivider /><DataTable title="" columns={['SOURCE','SESSIONS']} rows={topSources.map(s => [s.source, s.sessions])} /></>} → {topPages.length > 0 && <><SectionDivider /><DataTable title="" columns={['PAGE','VIEWS']} rows={topPages.map(p => [p.path, p.views])} /></>} → {dailyMetrics.length > 0 && daily table} → {charts.map(...)} → <SectionDivider /> → <EmailFooter /></Container></Body></Html>`.
- [x] T025 [US2] Add `renderAnalyticsReportEmail(report: AnalyticsReport, client: ClientRow, period: ResolvedPeriod): Promise<EmailRenderResult>` to `src/lib/templates.ts`. Map fields per `data-model.md` mapping table (sessions, avgDuration, activeUsers, newUsers as `StatMetric` objects; topSources/topPages sliced to 7; dailyMetrics formatted). Call `render(<AnalyticsReportV1Email {...props} />)`. Return same `{ subject, html, attachments }` shape as `renderFormNotificationEmail`.
- [x] T026 [US2] Update `src/inngest/functions/weekly-analytics-report.ts` — in `step.run("send-email", ...)`: replace `buildReportEmail()` call with `const rendered = await renderAnalyticsReportEmail(report, client, resolvedPeriod)` then `return sendEmail({ to: client.email, subject: rendered.subject, html: rendered.html, attachments: rendered.attachments })`. Remove `buildReportEmail()`, `formatDuration()`, `topSourcesRows`, `topPagesRows`, `dailyRows` helper functions — these now live in `templates.ts`. Add import for `renderAnalyticsReportEmail`.
- [x] T027 [US2] Update `scripts/test-email-preview.ts` — add analytics preview alongside inquiry preview. Create realistic mock `AnalyticsReport` (sessions: 12340, activeUsers: 8900, newUsers: 1240, avgSessionDurationSecs: 154, topSources: 5 entries, topPages: 7 entries, dailyMetrics: 7 days). Call `renderAnalyticsReportEmail` with mock data and write to `.email-preview/analytics.html`. Update script to write both `inquiry.html` and `analytics.html` and open both in browser.
- [x] T028 [US2] Create `tests/unit/lib/templates.test.ts` — tests for both render functions. Mock `fs.readFile` to return a Buffer without disk I/O (`vi.mock('fs/promises', ...)`). Mock `@react-email/render` to return a deterministic HTML string. Test `renderFormNotificationEmail`: assert `subject` contains client name; assert `html` is non-empty string; assert `attachments` array has 1 item with `filename: 'banner_image.png'`; assert optional fields absent from HTML when not provided. Test `renderAnalyticsReportEmail`: assert `subject` contains period label; assert `html` is non-empty; assert `previewText` contains session count; assert empty `topSources` results in section omission.
- [x] T029 [US2] Update `tests/unit/inngest/weekly-analytics-report.test.ts` — add `vi.mock('../../lib/templates', () => ({ renderAnalyticsReportEmail: vi.fn().mockResolvedValue({ subject: 'Your analytics report — Feb 24 – Mar 2, 2026', html: '<html>mock</html>', attachments: [] }) }))`. Remove any existing mock for `buildReportEmail` (function is deleted). Update assertions to check that `renderAnalyticsReportEmail` is called with the correct `report`, `client`, and `resolvedPeriod` arguments.

**Checkpoint**: `npm run email:preview` renders both inquiry and analytics emails. `npm test` passes all tests including new template unit tests.

---

## Phase 5: User Story 3 — Consistent Branding Across All Email Types (Priority: P3)

**Goal**: Both email types share identical brand elements (banner, colours, footer, typography) derived from a single token file. A developer can compose a new branded template from shared components without writing raw style values.

**Independent Test**: Open `inquiry.html` and `analytics.html` side-by-side in a browser and verify: Sol Software banner is identical in both; background colour, card border, link colour, and footer text are visually identical; no raw hex colour or font-size value exists outside `src/emails/styles.ts`.

### Implementation for User Story 3

- [x] T030 [P] [US3] Audit all files in `src/emails/components/` and `src/emails/templates/` — search for any raw colour hex values (e.g. `#2A80B6`, `#36363B`), raw pixel sizes in font/padding not derived from tokens, or direct `fontFamily` strings not referencing `typography.fontStack`. Fix every violation by replacing with the appropriate token reference. This enforces SC-005 (single-point brand update).
- [x] T031 [US3] Visual validation pass — run `npm run email:preview`, open both `.email-preview/inquiry.html` and `.email-preview/analytics.html`. Verify side-by-side: banner height/position matches; `colors.bg` (#F4F4F5) background visible in both; `colors.accent` (#2563EB) appears on CTA button (inquiry) and links; footer text and styling are identical; card border treatment matches. Document any visual discrepancies found and fix them before marking complete.

**Checkpoint**: Both templates visually consistent. Token file is the single source of truth — verified by code audit in T030.

---

## Phase 6: Polish & Cleanup

**Purpose**: Delete the now-empty root `emails/` directory, confirm type-safety, and confirm the full test suite is green.

- [x] T032 [P] Delete `emails/` root directory — `git rm -r emails/` (the directory should be empty after T004 moved all files to `src/emails/`)
- [x] T033 [P] Run `npm run type-check` — fix any remaining TypeScript errors. Common issues: missing `React` import in `.tsx` files (add `import React from 'react'` if needed for older JSX transform), type mismatches in `EmailRequest.attachments`, `StatMetric` type not exported from correct location.
- [x] T034 Run `npm test` — all tests must pass. Verify: existing 47+ tests unchanged; new `templates.test.ts` tests pass; updated `form-notification.test.ts` and `weekly-analytics-report.test.ts` tests pass. Fix any failures before marking complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T004 (files relocated) and T006 (tokens written) — **BLOCKS all user story phases**
- **User Story 1 (Phase 3)**: Depends on Phase 2 complete
- **User Story 2 (Phase 4)**: Depends on Phase 2 complete and T015 (types) + T016 (email.ts update) from Phase 3
- **User Story 3 (Phase 5)**: Depends on Phase 3 and Phase 4 complete
- **Polish (Phase 6)**: Depends on Phase 5 complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Depends on T015 (`EmailAttachment` type) and T016 (`email.ts` attachments update) from US1 — otherwise independent
- **US3 (P3)**: Depends on both US1 and US2 complete (validates consistency across both)

### Within Each User Story

- T011, T012, T013 [P] — all parallel (different new files)
- T014 — depends on T011, T012, T013 (composes them)
- T015 — independent (just type additions)
- T016 — depends on T015
- T017 — depends on T014 + T015
- T018 — depends on T017 + T016
- T019, T020 — both depend on T017; can run in parallel with each other
- T021, T022, T023 [P] — all parallel (different files)
- T024 — depends on T021, T022, T023
- T025 — depends on T024 + T015
- T026 — depends on T025 + T016
- T027, T028, T029 — all depend on T025; can run in parallel with each other

### Parallel Opportunities

- **Phase 2**: T007, T008, T009, T010 — all 4 run in parallel after T006
- **Phase 3**: T011, T012, T013 — run in parallel to build components before T014
- **Phase 4**: T021, T022, T023 — run in parallel to build components before T024; can start alongside Phase 3 if staffed
- **Phase 4 tail**: T027, T028, T029 — all parallel after T025
- **Phase 6**: T032, T033 — parallel (different operations)

---

## Parallel Example: User Story 1

```
# After Phase 2 complete, launch all US1 components together:
T011: Create src/emails/components/field-group.tsx
T012: Create src/emails/components/message-block.tsx
T013: Create src/emails/components/cta-button.tsx

# Then compose the template:
T014: Rewrite src/emails/templates/sales-lead-v1.tsx  ← depends on T011-T013

# Independently, add types and update email.ts:
T015: Update src/types/index.ts                       ← parallel with T011-T014
T016: Update src/lib/email.ts                         ← depends on T015

# Then wire everything:
T017: Create src/lib/templates.ts (inquiry fn)        ← depends on T014 + T015
T018: Update form-notification.ts                     ← depends on T017 + T016

# Finally, preview + test in parallel:
T019: Update scripts/test-email-preview.ts            ← depends on T017
T020: Update form-notification.test.ts                ← depends on T017
```

## Parallel Example: User Story 2

```
# Can start T021-T023 while US1 T011-T014 is in flight (different files):
T021: Rewrite src/emails/components/stat-card.tsx
T022: Create src/emails/components/data-table.tsx
T023: Update src/emails/components/chart-card.tsx

# Then compose the template:
T024: Rewrite src/emails/templates/analytics-report-v1.tsx  ← depends on T021-T023

# Add render function (needs T015 from US1 for types):
T025: Add renderAnalyticsReportEmail() to src/lib/templates.ts  ← depends on T024 + T015

# Wire + test in parallel:
T026: Update weekly-analytics-report.ts               ← depends on T025 + T016
T027: Update test-email-preview.ts (analytics)        ← depends on T025
T028: Create tests/unit/lib/templates.test.ts         ← depends on T025
T029: Update weekly-analytics-report.test.ts          ← depends on T025
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational — **required before ANY templates** (T006–T010)
3. Complete Phase 3: User Story 1 — Inquiry Email (T011–T020)
4. **STOP and VALIDATE**: `npm run email:preview` shows professional inquiry email; `npm test` passes
5. Merge or demo — the form-notification workflow now sends polished, branded emails

### Incremental Delivery

1. Setup + Foundational → design token system and shared brand components ready
2. US1 → inquiry email wired and live → `npm run email:preview` shows inquiry
3. US2 → analytics email wired and live → `npm run email:preview` shows both
4. US3 + Polish → branding audit, visual validation, cleanup

---

## Notes

- [P] tasks have no file conflicts and can be worked on simultaneously
- [US1]/[US2]/[US3] labels map each task to its user story for traceability
- T015 (types) and T016 (email.ts) are in Phase 3 but are prerequisites for Phase 4 — complete them early within US1
- The `assets/banner_image.png` placeholder (T005) only matters for production sends; mock mode ignores attachments, so development previews still work without the real asset
- `@react-email/render` `render()` is async — all template render calls must be `await`ed
- Vitest `vi.mock` for `fs/promises` must use the exact module specifier used in `templates.ts` (e.g. `'node:fs/promises'` vs `'fs/promises'`)
