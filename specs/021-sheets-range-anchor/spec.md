# Feature Specification: Configurable Google Sheets Range Anchor

**Feature Branch**: `021-sheets-range-anchor`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "can you generate a spec that makes this configurable that if im calling this function from a client and I need to configure the range anchor I can"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Set a Custom Table Anchor for a Sheets Destination (Priority: P1)

A client integration needs to append form submissions to a Google Sheet where the table does not start at cell A1. For example, the sheet has a logo or label in row 1, the column headers in row 2 starting at column B, and data rows beginning at B3. The client needs to declare where the table lives so rows are appended in the right place.

**Why this priority**: This is the core ask. Without it, data is appended to the wrong location and the integration is broken for any non-standard sheet layout.

**Independent Test**: Send a form submission event with a `sheetsDestination` that includes a `tableAnchor` of `B2`. Verify that the new row lands immediately below the last occupied row in the B-column table, not at row 2 of column A.

**Acceptance Scenarios**:

1. **Given** a `sheetsDestination` with `tableAnchor: "B2"`, **When** a form submission is processed, **Then** the row is appended to the table anchored at B2, and data appears in the correct columns starting at B.
2. **Given** a `sheetsDestination` with no `tableAnchor` field, **When** a form submission is processed, **Then** behavior is identical to today — the row is appended starting at A1 (backwards-compatible default).
3. **Given** a `sheetsDestination` with `tableAnchor: "C5"`, **When** the sheet already has 3 data rows in that table, **Then** the new row is appended as the 4th data row below the header at C5.

---

### User Story 2 — Default Behavior Unchanged for Existing Clients (Priority: P2)

Existing clients that send a `sheetsDestination` without a `tableAnchor` continue to work without any changes to their event payloads or client configuration.

**Why this priority**: Backwards compatibility prevents regressions in live integrations. Any existing client that omits `tableAnchor` must not be affected.

**Independent Test**: Send a form submission using the current payload shape (no `tableAnchor`). Confirm the row appends to A1-anchored table exactly as before.

**Acceptance Scenarios**:

1. **Given** an existing `sheetsDestination` payload without `tableAnchor`, **When** a form submission is processed, **Then** the row appends to the sheet starting from column A as it does today.

---

### Edge Cases

- What happens when `tableAnchor` is set to an invalid cell reference (e.g., `"ZZZ999"` or an empty string)? The submission should still be attempted; the Sheets API will return an error which is captured and logged — no silent data loss.
- What happens when `tableAnchor` references a cell outside the sheet's defined range? Same as above — the error is surfaced in the step outcome and logged.
- What if `tableAnchor` is provided but `sheetName` is omitted? The anchor is used alone (e.g., `B2` without a sheet prefix), defaulting to the first sheet — acceptable behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sheet destination configuration MUST support an optional `tableAnchor` field that accepts a standard spreadsheet cell reference (e.g., `"A1"`, `"B2"`, `"C5"`).
- **FR-002**: When `tableAnchor` is provided, the row append operation MUST use that cell as the range anchor, targeting the table rooted there.
- **FR-003**: When `tableAnchor` is omitted, the system MUST default to `A1` (current behavior), preserving full backwards compatibility.
- **FR-004**: When both `sheetName` and `tableAnchor` are provided, the anchor MUST be scoped to the named sheet (e.g., `SheetName!B2`).
- **FR-005**: Errors returned by the sheet service when using a custom anchor MUST be captured and surfaced in the step outcome the same way they are today — no new silent failure modes.

### Key Entities

- **GoogleSheetsDestination**: The configuration object passed in the event payload describing where to write. Gains an optional `tableAnchor` string field.
- **Range Anchor**: A cell reference string (e.g., `"B2"`, `"C5"`) identifying the top-left corner of the target table. Combined with `sheetName` when present to form a fully-qualified range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can configure `tableAnchor` in their event payload and have data land in the correct table position on the first attempt, with no manual sheet correction needed.
- **SC-002**: All existing integrations that omit `tableAnchor` continue to append rows correctly without any payload or configuration changes.
- **SC-003**: An invalid or out-of-range `tableAnchor` value produces a captured, logged error — no submission is silently lost.
- **SC-004**: The change requires zero updates to any part of the system outside the sheets destination type definition and the row-append logic.

## Assumptions

- The `tableAnchor` value is a raw cell reference string and is not validated for format by the service — the Sheets API is the authority on whether it is valid.
- Column ordering in the appended row is still governed by the `columns` field on the destination; `tableAnchor` only controls where in the sheet the table is located.
- This feature does not change how credentials, spreadsheet IDs, or sheet names are resolved — only the range anchor portion of the append call is affected.
