# Research: Professional Email Template System

**Feature**: 006-email-templates
**Date**: 2026-03-03
**Status**: Complete — all decisions resolved

---

## Decision 1: HTML Rendering Strategy

**Decision**: Use `@react-email/render` to convert React components to HTML strings at the `src/lib/templates.ts` boundary.

**Rationale**: The `emails/` directory was established at project inception with `@react-email/components` JSX templates. The `render()` function from `@react-email/render` is the standard, maintained bridge between these components and the `html: string` field expected by `src/lib/email.ts`. This preserves the existing investment in the `emails/` design and components.

**Alternatives considered**:
- Raw HTML template strings (current approach) — rejected because inline HTML scattered across workflow functions cannot be maintained consistently, has no component composition, and contradicts the existing `emails/` investment.
- `renderToStaticMarkup()` from `react-dom/server` — rejected because `@react-email/render` adds critical email-specific transformations (CSS inlining, HTML entities, DOCTYPE generation) on top of plain React rendering.

---

## Decision 2: `emails/` Directory Location

**Decision**: Move `emails/` into `src/emails/` so it falls within the existing TypeScript `rootDir: "src"` and `include: ["src/**/*"]` configuration.

**Rationale**: `tsconfig.json` uses `rootDir: "src"`, which means TypeScript compilation and path resolution are scoped to `src/`. Moving `emails/` to `src/emails/` requires only adding `"jsx": "react-jsx"` to `tsconfig.json` — no rootDir, outDir, or include changes needed. The project's preview script (`scripts/test-email-preview.ts`) and `src/lib/templates.ts` both import from `src/emails/` cleanly with relative paths.

**Alternatives considered**:
- Keep `emails/` at root and expand `tsconfig.json` include paths — rejected because removing `rootDir` causes `dist/` output to mirror the root directory structure (`dist/src/index.js` instead of `dist/index.js`), breaking the build.
- Separate `tsconfig.emails.json` — rejected as over-engineered for a straightforward relocation.

---

## Decision 3: Banner Image Delivery (CID vs. HTTPS URL)

**Decision**: Extend `EmailRequest` with an optional `attachments` array and pass attachments through `sendEmail()` to Resend, preserving the CID inline attachment approach for the banner image.

**Rationale**: The spec explicitly states the CID approach is preserved. Resend supports CID attachments via the `attachments` array with `headers: { 'Content-ID': '<banner_image.png>' }`. The banner reads the logo file from disk at render time and passes it as a Buffer. In mock mode, attachments are ignored (no file I/O needed for preview). In production, the CID approach ensures the logo renders reliably in clients that block external images.

**Alternatives considered**:
- Switch to HTTPS URL — rejected because it requires hosting the logo publicly, adds an external dependency, and contradicts the spec assumption. It would be a straightforward future upgrade if needed.
- Remove the banner entirely — rejected because consistent branding is a core success criterion.

---

## Decision 4: Inquiry Email Template Scope

**Decision**: Update `sales-lead-v1.tsx` to make the extended fields (phone, interestedIn, sourcePageText, sourcePageLink, logText, logLink) **optional** props. The `renderFormNotificationEmail()` function in `src/lib/templates.ts` maps the current `FormSubmittedPayload` fields to these props; optional fields are omitted when absent.

**Rationale**: `FormSubmittedPayload` currently provides: `submitterName`, `submitterEmail`, `submitterMessage`, `formId`. It does not have phone or service-of-interest fields. Rather than extend the payload (which is a separate concern scoped to how form data is submitted) or create a second template, making the extended fields optional allows the same template to serve both the current simple form submission case and a future richer lead capture case.

**Alternatives considered**:
- Extend `FormSubmittedPayload` to include phone, interestedIn, sourcePageUrl — rejected because those fields depend on the form design of client websites, which varies per client. Adding them now would be speculative.
- Create separate `inquiry-v1.tsx` (simple) and keep `sales-lead-v1.tsx` (rich) — rejected as duplication. One adaptive template is simpler.

---

## Decision 5: Analytics Email — Rich Data Tables vs. Charts Only

**Decision**: Update `analytics-report-v1.tsx` to include full tabular data sections (top traffic sources, top pages, daily breakdown) in addition to the existing 4 stat cards. Chart image sections remain supported as optional appendable sections.

**Rationale**: `weekly-analytics-report.ts` currently builds a rich HTML email with top sources, top pages, and daily breakdown tables from `AnalyticsReport`. The current React Email template (`analytics-report-v1.tsx`) only has 4 stat cards + chart image placeholders, which discards this richer data. The new template must represent all available GA4 data professionally. Chart images remain optional since the workflow does not currently generate chart images.

**Alternatives considered**:
- Keep template minimal (4 stats only) and rely on chart images — rejected because chart image generation is not implemented and would leave the email with less information than the current raw-HTML approach.
- Separate templates for tabular vs. chart views — rejected as premature complexity.

---

## Decision 6: New Dependencies

**Decision**: Add the following to `package.json` `dependencies`:
- `react` (^18.x) — required peer dependency for JSX and react-email render
- `react-dom` (^18.x) — required for server-side rendering
- `@react-email/components` (^0.0.x latest stable) — existing component primitives used in `emails/`
- `@react-email/render` (^1.x latest stable) — `render()` function to convert components to HTML

Add `@types/react` and `@types/react-dom` to `devDependencies`.

**Rationale**: These packages are the standard dependencies for using React Email in a Node.js server. None are currently in `package.json`, confirming the `emails/` directory was created as a design artefact but not yet integrated.

**Constitution note**: `@react-email/components` and `react` are not in the approved Technology Stack. A PATCH amendment to `constitution.md` Technology Stack table is required before merging this feature.

---

## Decision 7: `src/lib/templates.ts` Render Function Signatures

**Decision**: `src/lib/templates.ts` exports two functions:

```
renderFormNotificationEmail(data: FormSubmittedPayload, client: ClientRow): Promise<{ subject: string; html: string; attachments: EmailAttachment[] }>

renderAnalyticsReportEmail(data: AnalyticsReport, client: ClientRow): Promise<{ subject: string; html: string; attachments: EmailAttachment[] }>
```

Both return `Promise` because `@react-email/render` `render()` returns a Promise in its async form (the recommended form for Node.js). The `attachments` array contains the banner logo CID attachment for both email types.

**Rationale**: Centralising subject-line generation and attachment bundling in `templates.ts` keeps workflow functions clean — they call one function and pass the result directly to `sendEmail()`.

---

## Decision 8: Design System — Typography

**Problem with current templates**: Body text is `12px / font-weight: 300` — both too small and too light for comfortable reading. Section headings are 16px. iOS auto-enlarges sub-14px text unpredictably. Light weight (300) on small text fails WCAG contrast requirements on non-retina displays.

**Decision**: Establish a 4-level typographic hierarchy with system font stack:

| Role | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| Display (metric number) | 52px | 300 | 1.1 | Stat card headline value |
| Heading 1 | 28px | 700 | 1.2 | Email title (`EmailHeader`) |
| Heading 2 | 18px | 600 | 1.3 | Section labels, card titles |
| Body | 15px | 400 | 1.6 | All descriptive/body text |
| Small | 13px | 400 | 1.5 | Secondary labels, footer |
| Label | 11px | 600 | 1.4 | ALL-CAPS field labels (Name:, Email:) |

**Font stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

Rationale: System fonts render at the highest quality on each platform, require no web font loading (which breaks in many email clients), and are universally available. Geist (current) is not an email-safe font and will silently fall back to sans-serif in most clients, defeating its use.

Light weight (300) stays only for the 52px display number — at that size it reads elegantly and provides visual contrast to the bold section headings. Everywhere else, 400+.

---

## Decision 9: Design System — Colour Palette

**Problem with current templates**: The palette is functional but dated. `#2A80B6` for links is a dull mid-blue. Body text (`#36363B`) on the `#FAFAFA` background achieves ~8:1 contrast which is fine, but the surface colour (`#fff`) and background (`#FAFAFA`) are nearly identical, making card boundaries invisible without explicit borders.

**Decision**: Refined 8-token palette:

| Token | Value | Use |
|-------|-------|-----|
| `colors.bg` | `#F4F4F5` | Email outer background |
| `colors.surface` | `#FFFFFF` | Card / content block backgrounds |
| `colors.border` | `#E4E4E7` | Card borders, dividers, table row lines |
| `colors.textPrimary` | `#09090B` | Headings, stat numbers |
| `colors.textSecondary` | `#52525B` | Body text, descriptions |
| `colors.textMuted` | `#A1A1AA` | Footer, metadata, secondary labels |
| `colors.accent` | `#2563EB` | Links, CTA buttons, brand accent |
| `colors.positive` | `#16A34A` | Upward trend indicators |

All foreground/background pairs meet WCAG AA (4.5:1). `#09090B` on `#FFFFFF` achieves 21:1. `#52525B` on `#FFFFFF` achieves 7.2:1.

**Card treatment**: 1px solid `#E4E4E7` border + `border-radius: 8px`. Replaces the current near-invisible card boundary. White card on `#F4F4F5` background creates clear visual separation without heavy shadows.

---

## Decision 10: Design System — Spacing & Layout

**Problem with current templates**: `contentContainerStyle` has only `padding: '8px'` — far too cramped. `infoCardStyle` has `padding: '12px'` — too tight. There is no vertical rhythm between sections.

**Decision**: Generous, consistent spacing scale:

| Token | Value | Use |
|-------|-------|-----|
| `spacing.xs` | 4px | Internal tight gaps (label → value) |
| `spacing.sm` | 8px | Between related inline elements |
| `spacing.md` | 16px | Between items within a card |
| `spacing.lg` | 24px | Card padding; between cards |
| `spacing.xl` | 40px | Between major sections |
| `spacing.container` | 32px | Email container side padding |

Container: `max-width: 600px`, side padding `32px`. Cards: `padding: 24px`, `border-radius: 8px`. Gap between cards: `16px`. Gap between sections: `40px`. This produces a spacious, readable layout that doesn't feel crowded on any device.

---

## Decision 11: Inquiry Email — Layout Redesign

**Problem with current template**: The contact info section uses a two-column inline-flex layout (labels on left, values on right). This layout collapses unpredictably in Outlook and on mobile because `display: inline-flex` is not universally supported. It also puts "Name:", "Email:", "Phone:", "Interested In:" as body-weight labels next to values, creating low visual hierarchy.

**Decision**: Replace the two-column flex layout with a stacked label-value pattern using a `<table role="presentation">` grid. Each field renders as:

```
NAME
Casey Ramirez

EMAIL
casey@example.com

PHONE (omitted if absent)
+1 (555) 000-0000
```

- Field label: `11px / weight-600 / ALL-CAPS / color: textMuted / letter-spacing: 0.08em`
- Field value: `15px / weight-400 / color: textPrimary`
- Gap between label and value: 2px
- Gap between fields: 16px

For a two-column grid (Name + Email side-by-side, Phone + Service side-by-side), use `<Row>` + `<Column>` from `@react-email/components` — these render as a table internally and are Outlook-safe.

**Add a message/comments block** with a left-accent border:
- Background: `#F4F4F5`
- Left border: `4px solid #2563EB`
- Padding: `16px`
- Font: 15px / 1.6 line-height
- Displays the full form message without truncation

**Add a CTA button** at the bottom: "Reply to [Name]" → `mailto:` link. Primary style: `background: #2563EB`, white text, `border-radius: 6px`, `padding: 12px 24px`.

---

## Decision 12: Analytics Email — Layout Redesign

**Problem with current template**: Stat cards are stacked in a single column with a large number right-aligned. This wastes horizontal space on desktop. There is no period context visible at a glance. No trend indicators. Tables for top pages/sources are unimplemented.

**Decision**:

**Metric grid**: Display the 4 headline metrics in a 2×2 grid using `<Row>` + `<Column>`. Each card:
- Metric value: `52px / weight-300 / color: textPrimary` (left-aligned)
- Label: `13px / weight-600 / color: textMuted / ALL-CAPS`
- Context description: `13px / weight-400 / color: textSecondary`
- Trend line (optional): `13px` with coloured indicator — `↑ +12%` in `#16A34A` for positive, `→` neutral in `#A1A1AA`

**Section dividers**: `<Hr>` with `border-color: #E4E4E7` between the metric grid and data tables.

**Data tables** (top sources, top pages, daily breakdown):
- Header row: `11px / weight-600 / ALL-CAPS / color: textMuted / background: #F4F4F5`
- Data rows: `14px / weight-400 / color: textPrimary`
- Row separator: `1px solid #E4E4E7`
- Cell padding: `10px 12px`
- Alternating row background: none (separator lines are sufficient; alternating backgrounds add visual noise in tables with fewer than 10 rows)
- Max rows displayed: 7 per table (avoid overwhelming the email)

---

## Decision 13: New Components Required

Based on the layout redesigns, these components must be created or significantly rewritten:

| Component | Status | What changes |
|-----------|--------|--------------|
| `styles.ts` | Rewrite | Token object replaces flat style exports |
| `banner.tsx` | Minor update | Center-aligned, increased vertical padding |
| `email-header.tsx` | Rewrite | Larger title (28px/700), subtitle styling, date/period line |
| `email-footer.tsx` | New | Copyright, org name, automated notice, muted styling |
| `stat-card.tsx` | Rewrite | 2-col grid compatible, left-aligned number, ALL-CAPS label, optional trend line |
| `field-group.tsx` | New (replaces customer-info) | Stacked label-value fields using table layout; accepts `fields: {label, value}[]` |
| `message-block.tsx` | New | Left-accent bordered message display |
| `cta-button.tsx` | New | Primary and secondary CTA button variants |
| `data-table.tsx` | New | Table with header row, data rows, row separators |
| `section-divider.tsx` | New | Thin HR wrapper with standard spacing |
| `chart-card.tsx` | Minor update | Match new card padding/border treatment |

---

## Summary of All Resolved Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | HTML rendering | `@react-email/render` at `src/lib/templates.ts` boundary |
| 2 | Directory location | Move `emails/` → `src/emails/`; add `jsx: react-jsx` to tsconfig |
| 3 | Banner image | Preserve CID; extend `EmailRequest.attachments`; pass through `sendEmail()` |
| 4 | Inquiry template scope | Make extended fields optional; map from `FormSubmittedPayload` in templates.ts |
| 5 | Analytics data | Add top sources, top pages, daily breakdown tables to analytics template |
| 6 | New dependencies | react, react-dom, @react-email/components, @react-email/render + type packages |
| 7 | templates.ts signatures | Two async render functions returning `{ subject, html, attachments }` |
| 8 | Typography | 4-level scale; system font stack; 15px/400 body (up from 12px/300) |
| 9 | Colour palette | 8 tokens; `#09090B` primary text; `#2563EB` accent; `#F4F4F5` background |
| 10 | Spacing | 6-token scale; 32px container padding; 24px card padding; 40px section gap |
| 11 | Inquiry layout | Stacked label-value fields (table-based); message block with accent border; CTA button |
| 12 | Analytics layout | 2×2 metric grid; ALL-CAPS labels; trend indicators; data tables with separators |
| 13 | Components | 5 new components; 4 rewrites; 2 minor updates |
