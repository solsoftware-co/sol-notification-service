# Tasks: Per-Client Email Banner Configuration

**Input**: Design documents from `specs/019-client-email-banner/`
**Branch**: `019-client-email-banner`
**Tests**: Included — write tests first, ensure they fail before implementation.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

No project initialization required — all changes are within existing files and the existing TypeScript/Node.js project structure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definition required by all three user stories before any implementation can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add `ClientBannerConfig` interface to `src/types/index.ts` with optional fields: `imageUrl?: string`, `height?: number`, `width?: number`

**Checkpoint**: Type is defined — user story phases can now begin.

---

## Phase 3: User Story 1 — Custom Logo in Emails (Priority: P1) 🎯 MVP

**Goal**: Clients with a `banner.imageUrl` in their settings get their own logo embedded in both form notification and analytics report emails. Clients without config get the existing default banner — zero regression.

**Independent Test**: Set `settings.banner.imageUrl` on `client-acme` (SQL in `quickstart.md` Step 1), trigger a form notification via Inngest Dev UI, open `.email-preview/last.html`, confirm client logo appears instead of the Sol Software default.

### Tests for User Story 1 ⚠️ Write first — ensure they FAIL before implementation

- [x] T002 [P] [US1] In `tests/unit/lib/templates.test.ts` — add `parseBannerConfig` describe block: (a) valid `imageUrl` returned as-is, (b) non-URL string → field excluded, (c) `ftp://` URL → field excluded, (d) missing `banner` key → returns `{}`, (e) `banner` is not an object → returns `{}`
- [x] T003 [P] [US1] In `tests/unit/lib/templates.test.ts` — add `loadBannerAttachment` describe block: (a) no URL → calls `readFile` with local path; (b) valid URL → `vi.stubGlobal('fetch', ...)` resolves with PNG buffer → returns base64 attachment with `Content-Type` from response; (c) URL fetch rejects → falls back to `readFile`; (d) URL fetch rejects AND `readFile` rejects → returns `null`
- [x] T004 [P] [US1] In `tests/unit/lib/templates.test.ts` — extend `renderFormNotificationEmail` tests: client with valid `settings.banner.imageUrl` → `fetch` called with that URL; client with no `banner` key → `readFile` called (local fallback); `fetch` rejects → email still resolves (no throw)
- [x] T005 [P] [US1] In `tests/unit/lib/templates.test.ts` — extend `renderAnalyticsReportEmail` tests: same three cases as T004

### Implementation for User Story 1

- [x] T006 [US1] Add `parseBannerConfig(settings: Record<string, unknown>): ClientBannerConfig` function to `src/lib/templates.ts` — reads `settings.banner`, validates `imageUrl` (must parse as URL with `http:` or `https:` protocol; invalid value → return `{}` with no imageUrl)
- [x] T007 [US1] Refactor `loadBannerAttachment()` in `src/lib/templates.ts` to accept optional `imageUrl?: string` — if provided: `fetch(imageUrl)`, read response as `ArrayBuffer`, base64-encode, use `Content-Type` response header for MIME type (default `image/png`); on any fetch error: fall back to local file read; if local file also fails: return `null`
- [x] T008 [US1] Update `renderFormNotificationEmail` in `src/lib/templates.ts` — call `parseBannerConfig(client.settings)`, pass resolved `imageUrl` to `loadBannerAttachment`, use returned attachment (skip banner attachment if `null`)
- [x] T009 [US1] Update `renderAnalyticsReportEmail` in `src/lib/templates.ts` — same pattern as T008: `parseBannerConfig` → `loadBannerAttachment(imageUrl)` → conditional attachment

**Checkpoint**: Custom logo appears in both email types for configured clients. Default banner unchanged for unconfigured clients. Unreachable URLs fall back gracefully without send failure.

---

## Phase 4: User Story 2 — Banner Dimensions (Priority: P2)

**Goal**: Clients can configure `banner.height` and/or `banner.width` in their settings to control how their logo renders — supporting landscape, portrait, and square orientations.

**Independent Test**: Set `settings.banner` with `imageUrl`, `height: 80`, `width: 320` on a client, trigger an email, inspect rendered HTML to confirm the `<img>` tag has `height="80"` and `width="320"`.

### Tests for User Story 2 ⚠️ Write first — ensure they FAIL before implementation

- [x] T011 [US2] In `tests/unit/emails/components/banner.test.tsx` (new file) — render `<Banner />` with no props → `height` attribute is `"40"`, no `width` attribute; render with `height={80}` → `height="80"`; render with `width={320}` → `width="320"` present; render with both → both applied
- [x] T012 [US2] In `tests/unit/lib/templates.test.ts` — extend `parseBannerConfig` tests: valid `height: 60` → returned; `height: 0` → excluded; `height: -1` → excluded; `height: 1.5` (float) → excluded; valid `width: 200` → returned; same invalid cases for `width`
- [x] T013 [P] [US2] In `tests/unit/lib/templates.test.ts` — extend `renderFormNotificationEmail` tests: client with `banner: { height: 80, width: 320 }` → `mockSalesLeadV1EmailFn` called with `bannerHeight: 80, bannerWidth: 320`; client with no banner dims → called with `bannerHeight: undefined, bannerWidth: undefined`
- [x] T014 [P] [US2] In `tests/unit/lib/templates.test.ts` — extend `renderAnalyticsReportEmail` tests: same two cases as T013 against `mockAnalyticsReportEmailFn`

### Implementation for User Story 2

- [x] T015 [US2] Update `Banner` component in `src/emails/components/banner.tsx` — add optional `height?: number` and `width?: number` props; use `height ?? 40` in the `<Img>` tag; add `width` attribute only when provided
- [x] T016 [P] [US2] Update `InquiryEmailProps` in `src/emails/templates/sales-lead-v1.tsx` — add `bannerHeight?: number` and `bannerWidth?: number`; pass to `<Banner height={bannerHeight} width={bannerWidth} />`
- [x] T017 [P] [US2] Update analytics email component props in `src/emails/templates/analytics-report-v1.tsx` — add `bannerHeight?: number` and `bannerWidth?: number`; pass to `<Banner height={bannerHeight} width={bannerWidth} />`
- [x] T018 [US2] Extend `parseBannerConfig()` in `src/lib/templates.ts` to also read and validate `height` and `width` — each must be a positive integer (`Number.isInteger(v) && v > 0`); invalid values excluded from return (not passed downstream)
- [x] T019 [US2] Update `renderFormNotificationEmail` in `src/lib/templates.ts` — pass `height` and `width` from parsed banner config to `SalesLeadV1Email` as `bannerHeight` and `bannerWidth`
- [x] T020 [US2] Update `renderAnalyticsReportEmail` in `src/lib/templates.ts` — pass `height` and `width` from parsed banner config to analytics email component as `bannerHeight` and `bannerWidth`

**Checkpoint**: Emails render at client-configured dimensions. Unconfigured dimensions fall back to defaults (height 40, no width constraint). Each dimension is independently optional.

---

## Phase 5: User Story 3 — Validation & Observability (Priority: P3)

**Goal**: Invalid banner configuration (bad URL, non-positive dimensions) is caught at render time, logged with enough context to diagnose, and never causes an email send failure.

**Independent Test**: Set `settings.banner.imageUrl` to a non-URL string on a client, trigger an email, confirm (a) email still delivers with default banner, (b) a warning log entry appears identifying the client and the invalid value.

### Tests for User Story 3 ⚠️ Write first — ensure they FAIL before implementation

- [x] T022 [P] [US3] In `tests/unit/lib/templates.test.ts` — add `mockLogError` to hoisted mocks and `vi.mock('../../../src/utils/logger', ...)`; assert `logError` called when `parseBannerConfig` receives invalid `imageUrl`, invalid `height`, invalid `width` — each case independently
- [x] T023 [P] [US3] In `tests/unit/lib/templates.test.ts` — assert `logError` called with the attempted URL when `loadBannerAttachment` URL fetch rejects

### Implementation for User Story 3

- [x] T024 [US3] Harden `parseBannerConfig()` in `src/lib/templates.ts` — add `logError` call for each invalid field: invalid `imageUrl` (not a parseable http/https URL), `height` not a positive integer, `width` not a positive integer; each warning must include the field name and the invalid value received
- [x] T025 [US3] Add `logError` warning to `loadBannerAttachment()` in `src/lib/templates.ts` when URL fetch fails — log the attempted URL and the caught error message so operators can diagnose misconfigured or stale image URLs

**Checkpoint**: Misconfigured banner config produces a visible warning log and falls back gracefully. Email delivery is never blocked by banner errors.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T026 [P] Run `npm run type-check` — confirm TypeScript compilation passes across all changed files (`src/types/index.ts`, `banner.tsx`, both template files, `templates.ts`)
- [x] T027 [P] Run `npm test` — confirm all new and existing unit tests pass
- [ ] T028 Run full local validation per `quickstart.md` — execute Steps 1–6 in order: custom banner, unreachable URL fallback, no-config regression, analytics report banner

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Requires T001 (type definition)
- **US2 (Phase 4)**: Requires T001 and T006/T018 (parseBannerConfig foundation from US1)
- **US3 (Phase 5)**: Requires T006 and T007 (functions to harden from US1)
- **Polish (Phase 6)**: Requires all desired story phases complete

### Within Phase 3 (US1)

```
T001 → T002 [P], T003 [P], T004 [P], T005 [P]   ← tests (write first, verify fail)
     → T006 → T007 → T008
                   → T009
```

Test tasks T002–T005 are parallel (same file but independent describe blocks). Implementation tasks T006–T009 are sequential (same file).

### Within Phase 4 (US2)

```
T011 → T012 → T013 [P], T014 [P]   ← tests
T015 → T016 [P]                     ← Banner component + template files (parallel)
     → T017 [P]
T018 → T019 → T020                  ← parseBannerConfig extension + render wiring
```

T016 and T017 are parallel (different template files). T013 and T014 are parallel (different describe blocks, same file).

### Parallel Opportunities

```bash
# US1 test tasks — all target templates.test.ts but are independent describe blocks:
T002: parseBannerConfig tests
T003: loadBannerAttachment URL tests
T004: renderFormNotificationEmail banner tests
T005: renderAnalyticsReportEmail banner tests

# US2 template file updates — different files:
T016: sales-lead-v1.tsx
T017: analytics-report-v1.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001)
2. Write US1 tests (T002–T005) — verify they fail
3. Complete US1 implementation (T006–T009)
4. **STOP and VALIDATE**: Run `npm test` — US1 tests pass; trigger a form notification with `banner.imageUrl` set; confirm custom logo in `.email-preview/last.html`
5. If validated, continue to US2

### Incremental Delivery

1. T001 → foundation ready
2. T002–T009 → US1 complete (custom image in both email types, tests passing)
3. T011–T020 → US2 complete (dimension control, tests passing)
4. T022–T025 → US3 complete (validation hardening, tests passing)
5. T026–T028 → type-check passes, full test suite green, quickstart validated

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps each task to its user story for traceability
- `templates.ts` is the central file — most changes land there; avoid parallel edits to it
- T006 (`banner.tsx`) is safe to work in parallel with T002–T005 since it touches a different file
- No new npm packages, no DB migration, no new Inngest functions
- Commit after each checkpoint (end of US1, US2, US3) to keep rollback options clean
