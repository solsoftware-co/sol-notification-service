# Feature Specification: Analytics Excel Export Attachment

**Feature Branch**: `013-analytics-excel-export`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "whenever the analytics-report function is invoked the user receives not only the email but also an excel attached that contains the same data in an easy to understand format"

## Overview

Each time a client receives their weekly analytics report email, they also receive an Excel spreadsheet as an email attachment. The spreadsheet contains all the same data shown in the visual email — summary metrics, top pages, traffic sources, and day-by-day breakdown — organized into clearly labeled sheets. Clients can then sort, filter, chart, or share the data however they wish without manually copying from the email HTML.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Excel with Analytics Email (Priority: P1)

A client receives their scheduled weekly analytics report email. Along with the visual HTML email they are already familiar with, they find an Excel file (.xlsx) attached. They open it in their preferred spreadsheet application and immediately see all the same numbers from the email — total sessions, active users, new users, top pages, traffic sources, and the daily breakdown — organized across clearly labeled sheets.

**Why this priority**: This is the core deliverable. Without the attachment, the feature does not exist. All other stories build on this.

**Independent Test**: Trigger the analytics report for any configured client and verify the email arrives with a valid, openable .xlsx attachment containing all four data sections.

**Acceptance Scenarios**:

1. **Given** a client with a configured GA4 property, **When** an analytics report is triggered for any period preset, **Then** the client receives an email with a `.xlsx` file attached named after the client and date range (e.g., `analytics-report-feb-16-feb-22-2026.xlsx`)
2. **Given** the attached spreadsheet is opened, **When** the user views the first sheet, **Then** they see a summary section with the report period label and four headline metrics: Total Sessions, Active Users, New Users, and Average Session Duration (formatted as minutes and seconds)
3. **Given** the attached spreadsheet is opened, **When** the user navigates the sheets, **Then** they find a sheet for Top Pages (page path and view count), a sheet for Traffic Sources (source name and session count), and a sheet for Daily Breakdown (date, sessions, active users, new users per row)

---

### User Story 2 - Historical Comparison Data Included (Priority: P2)

When historical period data is included in the report (prior period snapshots for trend comparison), that data is also present in the Excel spreadsheet so the client can perform their own period-over-period analysis beyond what the email chart shows.

**Why this priority**: Historical context is already fetched and shown visually in the email. Including it in the spreadsheet at no extra cost significantly increases the data's analytical value.

**Independent Test**: Trigger a `last_week` or `last_month` report (which include historical snapshots) and verify the Excel contains a Historical Comparison sheet with one row per historical period.

**Acceptance Scenarios**:

1. **Given** a report that includes prior period snapshots, **When** the Excel is opened, **Then** a "Historical Comparison" sheet is present with one row per period (period label, sessions, active users, new users, average session duration)
2. **Given** a report with no historical period data (e.g., a custom range with no comparison), **When** the Excel is opened, **Then** no Historical Comparison sheet is present and the remaining sheets are unaffected

---

### User Story 3 - Attachment Works Across All Report Triggers (Priority: P3)

The Excel attachment is generated and included regardless of how the analytics report was triggered — whether by the automated weekly scheduler, a manual Inngest event from the Dev UI, or a future on-demand trigger.

**Why this priority**: Consistency across trigger methods prevents confusion and ensures the feature is reliable for both automated and manual workflows.

**Independent Test**: Trigger the report manually via the Inngest Dev UI and confirm the resulting email includes the Excel attachment with correct data.

**Acceptance Scenarios**:

1. **Given** a manual trigger with a custom date range, **When** the report runs, **Then** the email includes an Excel attachment reflecting the custom date range data
2. **Given** the automated Tuesday scheduler fires and fans out per-client events, **When** each client report runs, **Then** every client email includes an Excel attachment

---

### Edge Cases

- What happens when a client has no data for the selected period (zero sessions, empty top pages)? The attachment should still be generated with the appropriate empty rows and zero values — not omitted.
- What happens when the Excel generation fails (e.g., out of memory, corrupted data)? The email should still be sent with the HTML report, and the failure should be logged — the attachment failure must not block email delivery.
- What happens when a client has no GA4 property configured? The workflow already skips email for these clients — no attachment is generated since there is no data to attach.
- What happens when the report runs in mock mode (no real GA4 credentials)? The attachment should still be generated using the same mock data that populates the email, so developers can test the full flow locally.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate an Excel spreadsheet containing all analytics report data each time an analytics report email is produced
- **FR-002**: The Excel file MUST be attached to the outgoing email alongside (not replacing) the existing HTML report
- **FR-003**: The Excel file MUST contain a **Summary** sheet with: report period label, total sessions, total active users, total new users, and average session duration formatted as human-readable time (e.g., "2m 34s")
- **FR-004**: The Excel file MUST contain a **Top Pages** sheet with columns: Page Path, Page Views — one row per page in the report
- **FR-005**: The Excel file MUST contain a **Traffic Sources** sheet with columns: Source, Sessions — one row per source in the report
- **FR-006**: The Excel file MUST contain a **Daily Breakdown** sheet with columns: Date, Sessions, Active Users, New Users — one row per day in the report period
- **FR-007**: When historical period snapshots are present in the report data, the Excel file MUST include a **Historical Comparison** sheet with columns: Period, Sessions, Active Users, New Users, Avg Session Duration
- **FR-008**: When historical period snapshots are absent, the Excel file MUST NOT include a Historical Comparison sheet
- **FR-009**: The Excel filename MUST include the client name and report date range in a human-readable format (e.g., `analytics-acme-feb-16-feb-22-2026.xlsx`)
- **FR-010**: If Excel generation fails for any reason, the system MUST still send the HTML email and log the attachment failure — email delivery must not be blocked
- **FR-011**: The Excel attachment MUST be generated in mock mode using the same mock data as the email, so the full flow can be tested without live GA4 credentials
- **FR-012**: Column headers in each sheet MUST be clearly labeled and match the terminology used in the email report

### Key Entities

- **Analytics Report**: The full dataset for a given client and period — summary metrics, top pages, traffic sources, daily metrics, and optional historical snapshots. This is the single source of truth for both the email and the spreadsheet.
- **Excel Attachment**: A multi-sheet spreadsheet derived entirely from the Analytics Report. It has no data of its own — all values come from the report.
- **Report Period**: The date range the report covers, resolved from a preset (last week, last month, etc.) or a custom range. Appears in the filename and Summary sheet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every analytics report email that is successfully sent includes a valid, openable Excel attachment — 100% of triggered reports produce an attachment
- **SC-002**: The Excel attachment contains the same numeric values as the email HTML for all four data sections (summary, pages, sources, daily) — zero data discrepancies
- **SC-003**: Clients can open the attachment in standard spreadsheet applications (Excel, Google Sheets, LibreOffice) without errors or import warnings
- **SC-004**: An Excel generation failure does not prevent email delivery — the HTML email arrives even when the attachment cannot be produced
- **SC-005**: The attachment file size remains under 1 MB for any standard weekly or monthly report (typical data volumes: 7–90 daily rows, up to 20 top pages, up to 10 traffic sources)

## Assumptions

- The attachment format is `.xlsx` (modern Excel format), which is compatible with all major spreadsheet applications without plugins or conversion
- Sheet tab names will be short and descriptive: "Summary", "Top Pages", "Traffic Sources", "Daily Breakdown", "Historical"
- No password protection, sheet locking, or conditional formatting is required — plain tabular data is sufficient
- The client name used in the filename is taken from the `client.name` field already available in the workflow
- No new database schema changes are needed — all data is already fetched during the report workflow
- The attachment is generated in memory during the email-send step and is not persisted to disk or any storage service
