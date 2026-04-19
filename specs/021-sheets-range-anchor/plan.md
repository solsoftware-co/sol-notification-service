# Implementation Plan: Configurable Google Sheets Range Anchor

**Branch**: `021-sheets-range-anchor` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/021-sheets-range-anchor/spec.md`

## Summary

Add an optional `tableAnchor` field to the `GoogleSheetsDestination` event payload type so clients can specify the top-left cell of their sheet table (e.g., `"B2"`). The row-append logic in `src/lib/sheets.ts` uses this anchor when building the Sheets API range string, defaulting to `"A1"` when omitted. No new packages, no DB changes, no new Inngest functions.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+
**Primary Dependencies**: `google-auth-library ^10.x` (existing), Node.js native `fetch` (existing)
**Storage**: N/A — no schema changes
**Testing**: Vitest 2.x
**Target Platform**: Vercel (Node 20 runtime)
**Project Type**: Web service (Inngest worker)
**Performance Goals**: No change — single API call per submission
**Constraints**: Must be 100% backwards-compatible; omitting `tableAnchor` must produce identical behavior to today
**Scale/Scope**: Affects every `form/submitted` event that includes a `sheetsDestination`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Event-Driven Workflow First | ✅ Pass | No new function; change is within existing `sync-to-google-sheets` step |
| II. Multi-Environment Safety | ✅ Pass | Step already gates on `config.emailMode === "live"` — no change needed |
| III. Multi-Tenant by Design | ✅ Pass | `appendSheetRow` already scoped to per-client credentials |
| IV. Observability by Default | ✅ Pass | Existing error capture in `appendSheetRow` covers new anchor errors |
| V. AI-Agent Friendly | ✅ Pass | Spec exists; type change goes in `src/types/index.ts` per convention |
| VI. Minimal Infrastructure | ✅ Pass | Zero new packages or infrastructure components |

*No violations. Complexity Tracking table not required.*

## Project Structure

### Documentation (this feature)

```text
specs/021-sheets-range-anchor/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── event-payload.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
src/
├── types/
│   └── index.ts              ← add tableAnchor?: string to GoogleSheetsDestination
└── lib/
    └── sheets.ts             ← update range string to use tableAnchor ?? "A1"

tests/unit/lib/
└── sheets.test.ts            ← add/update resolveRow tests + new range-building tests
```

**Structure Decision**: Single-project, no new files. Two source files change; one test file is updated.
