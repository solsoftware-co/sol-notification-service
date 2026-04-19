# Tasks: Configurable Google Sheets Range Anchor

**Input**: Design documents from `specs/021-sheets-range-anchor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Not explicitly requested in spec — test tasks are included for the range-builder only, as it is pure logic with no side effects and 4 distinct cases to verify.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Single project at repo root: `src/`, `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new packages, files, or structure required — this phase is a no-op.

*No setup tasks needed. Proceed directly to Phase 2.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the `GoogleSheetsDestination` type. This change is required before any implementation task can compile.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add optional `tableAnchor?: string` field to the `GoogleSheetsDestination` interface in `src/types/index.ts` (after the `columns` field; include a JSDoc comment: `/** Cell reference for the top-left corner of the target table, e.g. "B2". Defaults to "A1". */`)

**Checkpoint**: `npm run type-check` passes after T001.

---

## Phase 3: User Story 1 — Set a Custom Table Anchor (Priority: P1) 🎯 MVP

**Goal**: A client can pass `tableAnchor` in `sheetsDestination` and have the row appended to the correct table in the sheet.

**Independent Test**: Send a `form/submitted` event with `sheetsDestination.tableAnchor: "B2"` in live mode and observe the row lands in the B-column table.

### Unit Tests for User Story 1

> **Write tests first — they must FAIL before T003 is implemented**

- [x] T002 [P] [US1] Add unit tests for the `resolveRow`-to-range integration in `tests/unit/lib/sheets.test.ts` — cover all 4 range combinations from `data-model.md`:
  - no `sheetName`, no `tableAnchor` → range is `A1`
  - `sheetName` only → range is `SheetName!A1`
  - `tableAnchor` only (e.g., `"B2"`) → range is `B2`
  - both `sheetName` and `tableAnchor` → range is `SheetName!B2`

  > Note: `resolveRow` is already exported from `src/lib/sheets.ts`; export a `buildRange(destination)` helper (see T003) and import it in the test.

### Implementation for User Story 1

- [x] T003 [US1] In `src/lib/sheets.ts`, extract a small `buildRange(destination: GoogleSheetsDestination): string` helper and replace the hardcoded `A1` on line 52:
  - Helper returns `destination.tableAnchor ?? "A1"` as the cell portion
  - When `destination.sheetName` is present, prefix with `${destination.sheetName}!`
  - Export `buildRange` so unit tests in T002 can import it
  - Replace line 52's inline range expression with a call to `buildRange(destination)`

**Checkpoint**: `npm run type-check` passes; unit tests in T002 all pass; omitting `tableAnchor` produces identical range to today.

---

## Phase 4: User Story 2 — Default Behavior Unchanged for Existing Clients (Priority: P2)

**Goal**: Existing `sheetsDestination` payloads without `tableAnchor` continue to work without modification.

**Independent Test**: Existing `form/submitted` events that omit `tableAnchor` append rows to the A1-anchored table as before.

### Implementation for User Story 2

No new code required. Backwards compatibility is guaranteed by the `?? "A1"` default in T003. This phase validates that guarantee.

- [x] T004 [US2] Verify backwards compatibility: confirm `npm run type-check` passes with no changes to any existing call site or test that uses `GoogleSheetsDestination` without `tableAnchor`

**Checkpoint**: All existing tests pass; `npm run type-check` clean; no call site needed updating.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T005 [P] Run `npm run type-check` and `npm test` to confirm zero regressions across the full test suite
- [x] T006 Update `CLAUDE.md` Recent Changes entry for `021-sheets-range-anchor`: `GoogleSheetsDestination` gains optional `tableAnchor` field; `buildRange()` extracted in `src/lib/sheets.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **User Story 1 (Phase 3)**: Depends on T001
  - T002 (tests) and T003 (implementation) can proceed in parallel once T001 is done
  - T003 must be complete before T002 tests pass
- **User Story 2 (Phase 4)**: T004 depends on T003 being complete
- **Polish (Phase 5)**: Depends on T001–T004 all being complete

### User Story Dependencies

- **US1 (P1)**: Depends on T001 (type field) — no other story dependencies
- **US2 (P2)**: Fully covered by T003's `?? "A1"` default — T004 is verification only

### Within Each User Story

- T002 (tests) written before T003 (implementation), expected to fail first
- T003 (range builder) before T004 (backwards-compat check)

### Parallel Opportunities

- T002 (writing test file) and T003 (implementation) can be authored in parallel once T001 is merged, as they touch different files

---

## Parallel Example: User Story 1

```bash
# After T001 lands:
Task A: T002 — write failing tests in tests/unit/lib/sheets.test.ts
Task B: T003 — implement buildRange() helper in src/lib/sheets.ts
# Then: run tests — T002 should now pass
```

---

## Implementation Strategy

### MVP (User Story 1 only — 3 tasks)

1. T001 — extend the type
2. T002 — write tests (fail first)
3. T003 — implement `buildRange()`
4. **STOP and VALIDATE**: `npm run type-check && npm test`

### Full Delivery (all stories — 6 tasks)

1. T001 → T002 + T003 (parallel) → T004 → T005 + T006 (parallel)
2. Each step is independently verifiable via type-check and unit tests

---

## Notes

- [P] tasks touch different files — safe to parallelise
- [US1]/[US2] labels map tasks to spec.md user stories
- Total: **6 tasks** across 4 phases
- Zero new packages, zero migrations, zero new Inngest functions
- Entire change surface: 2 source files (`src/types/index.ts`, `src/lib/sheets.ts`), 1 test file
