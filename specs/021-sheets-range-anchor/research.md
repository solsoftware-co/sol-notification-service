# Research: Configurable Google Sheets Range Anchor

**Feature**: 021-sheets-range-anchor
**Date**: 2026-04-19

---

## Decision: How the Sheets API `append` range parameter works

**Decision**: Use the existing `values.append` endpoint with a custom range string. No API or SDK changes required.

**Rationale**: The Google Sheets API `values.append` endpoint uses the provided range to locate the target table, then finds the first empty row after the last occupied row in that range and inserts there. Changing `A1` to `B2` (or `Sheet1!B2`) is sufficient — the API handles the rest. This is exactly the behavior we need: anchor at the header row, get appended to the correct column offset automatically.

**Alternatives considered**:
- `values.update` with a computed row index: rejected — requires a prior `values.get` call to find the last row, adding latency and complexity.
- `batchUpdate` with `appendCells`: rejected — lower-level and requires more boilerplate; no benefit for single-row appends.

---

## Decision: Where to build the range string

**Decision**: Build the range string inside `src/lib/sheets.ts` in `appendSheetRow`, using `destination.tableAnchor ?? "A1"` as the cell portion.

**Rationale**: The current range string is already assembled in one line (`line 52` of `sheets.ts`). Extending it to substitute the anchor there keeps the change minimal and localised. The full range becomes:
- No `sheetName`, no `tableAnchor` → `A1` (current default)
- `sheetName` only → `SheetName!A1` (current)
- `tableAnchor` only → `B2` (new)
- Both → `SheetName!B2` (new)

**Alternatives considered**:
- Accepting a fully-qualified range string from the caller: rejected — puts formatting burden on every caller and is error-prone.
- Adding a `startColumn` + `startRow` pair instead of a cell string: rejected — more fields, same outcome, less readable.

---

## Decision: Validation of `tableAnchor` value

**Decision**: No format validation in the service. The Sheets API returns a clear error for invalid cell references, which is already caught and returned as `{ success: false, error: "..." }`.

**Rationale**: The spec explicitly states the Sheets API is the authority on cell reference validity. Adding a regex guard would duplicate that authority, add maintenance burden, and could reject valid references we haven't anticipated (e.g., very wide sheets with column `AAA`).

---

## No NEEDS CLARIFICATION items remain.
