# Feature Specification: Analytics Email Charts

**Feature Branch**: `007-analytics-email-charts`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "enhance the analytics report v1 email template by adding graphs (in addition to the data tables) which makes the data easier to comprehend compared to just looking at tables (but I want to keep the tables as well). As you can see there are top sources, top pages, and Daily Breakdown, please come up with graphs for each to make the data more interactive. If the graphs are rendered as images please attach them (as we did to the banner) so that we aren't having to fetch from external sources (which might be blocked by the clients computer) finally please use branding defined in @src/emails/styles.ts to retain a consistent feel between graphs and the rest of the email body"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily Traffic Trend Chart (Priority: P1)

A client opens their weekly analytics report email and, before reading any tables, can immediately see an area chart (a line chart with the area beneath it filled) visualising daily session volume across the reporting week. At a glance they can tell whether traffic trended up, down, or was flat — without having to decode a row of numbers.

**Why this priority**: The daily breakdown chart provides the single highest-value insight in the report — trajectory. It answers "is traffic growing?" instantly and is the most requested visualisation in analytics products. Delivering this first creates immediate perceived value.

**Independent Test**: Can be fully tested by running the email preview script and confirming a chart image appears above the Daily Breakdown table, showing a continuous area curve with one data point per day of the reporting period, with values that match the table data.

**Acceptance Scenarios**:

1. **Given** a weekly analytics report with 7 days of session data, **When** the email is rendered, **Then** a chart image is visible showing a filled area curve with 7 data points (one per day) and session counts that match the Daily Breakdown table.
2. **Given** a reporting period with fewer than 7 days of data, **When** the email is rendered, **Then** the chart adjusts to show only the days with available data (no phantom points or gaps).
3. **Given** a day where sessions were zero, **When** the email is rendered, **Then** the chart correctly plots a zero value for that day, bringing the area down to the baseline rather than omitting the point.

---

### User Story 2 - Top Traffic Sources Chart (Priority: P2)

A client can see a horizontal bar chart showing their top traffic sources alongside the existing Top Sources table. The chart makes it instantly obvious which source dominates and how the others compare proportionally — something a plain table cannot convey.

**Why this priority**: Source attribution is the second most actionable insight — clients need to know where to invest marketing budget. A proportional visual makes channel dominance obvious in seconds, adding clarity that the table alone does not provide.

**Independent Test**: Can be fully tested by confirming a chart image appears in the Top Sources section showing one horizontal bar per source, with bar lengths proportional to session counts, and source labels that match the table entries.

**Acceptance Scenarios**:

1. **Given** a report with 5 top traffic sources, **When** the email is rendered, **Then** a horizontal bar chart appears with 5 labelled bars, lengths proportional to session volume, alongside the existing table.
2. **Given** a report with only 1 traffic source, **When** the email is rendered, **Then** the chart renders a single bar at full width without layout errors.
3. **Given** a report with no source data, **When** the email is rendered, **Then** the chart and its section heading are omitted gracefully (no empty or broken image).

---

### User Story 3 - Top Pages Chart (Priority: P3)

A client can see a horizontal bar chart of their most-visited pages alongside the existing Top Pages table. The chart communicates relative page popularity visually so they can identify top-performing content without scanning numbers.

**Why this priority**: Page performance is the third key insight. It rounds out the visual story started by the trend chart (daily volume) and sources chart (acquisition), completing a full picture of traffic behaviour for the week.

**Independent Test**: Can be fully tested by confirming a chart image appears in the Top Pages section showing one horizontal bar per page path, with bars proportional to view counts, and path labels matching the table below.

**Acceptance Scenarios**:

1. **Given** a report with 7 top pages, **When** the email is rendered, **Then** a horizontal bar chart appears with up to 7 labelled bars, proportional to page view counts, alongside the existing table.
2. **Given** long URL paths (e.g., `/blog/how-to-do-something-very-detailed`), **When** the email is rendered, **Then** the chart truncates or wraps labels so the layout does not overflow the email width.
3. **Given** a report with no page data, **When** the email is rendered, **Then** the chart and its section heading are omitted gracefully.

---

### Edge Cases

- What happens when all values in a dataset are equal (every bar would be the same length)?
- How does the chart handle a single data point (single source, single page, or single day)?
- What happens if chart generation fails for one section — does the whole email fail, or does it fall back gracefully to the table-only layout?
- How are very long source names (e.g., full referral URLs) handled in chart labels?
- What happens if the reporting period spans a partial week (e.g., only 3 days of data)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analytics report email MUST include an area chart in the Daily Breakdown section showing session volume per day across the reporting period, with the area beneath the line filled to give visual weight to the trend curve.
- **FR-002**: The analytics report email MUST include a visual chart in the Top Sources section showing relative session volume per source.
- **FR-003**: The analytics report email MUST include a visual chart in the Top Pages section showing relative page view volume per page path.
- **FR-004**: All charts MUST be embedded directly in the email as self-contained images with no dependency on external servers or URLs at render time.
- **FR-005**: All charts MUST use the brand colour palette and typography defined in the project design tokens to ensure visual consistency with the rest of the email.
- **FR-006**: All existing data tables (Daily Breakdown, Top Sources, Top Pages) MUST be retained alongside their corresponding charts — charts supplement the tables, they do not replace them.
- **FR-007**: Each chart MUST be positioned immediately above its corresponding data table within the same email section.
- **FR-008**: When a data section is empty (no sources, no pages, or no daily metrics), both the chart and the table for that section MUST be omitted from the email.
- **FR-009**: Chart labels MUST be readable at standard email rendering widths (minimum 320px, maximum 800px) and MUST truncate or wrap gracefully when content is long.
- **FR-010**: Chart generation MUST NOT block or break email delivery — if a chart cannot be produced, the email MUST still send with the table-only layout for that section.

### Key Entities

- **Chart Image**: A rendered visual representation of a single data series (sessions by day, sessions by source, or views by page). Delivered as an embedded binary attachment with no external URL dependency.
- **Daily Metric**: A day-level data point with a date and session count, used to populate the daily trend chart.
- **Traffic Source**: A named acquisition channel with a session count, used to populate the sources bar chart.
- **Page Entry**: A URL path with a view count, used to populate the pages bar chart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three chart types (daily trend, top sources, top pages) render correctly in the email preview with no broken images or layout errors.
- **SC-002**: Each chart uses only colours present in the design token system — no unbranded colours appear in any chart.
- **SC-003**: The total size increase to the email due to embedded chart images is less than 2 MB per report, keeping the email within standard deliverability limits.
- **SC-004**: Chart generation adds less than 3 seconds to total email render time under normal operating conditions.
- **SC-005**: A reviewer can identify the top traffic source and whether daily sessions trended up or down without reading any table data — purely from the charts.
- **SC-006**: All edge cases (empty data section, single data point, all-equal values) render without errors, broken images, or layout overflow.

## Assumptions

- Charts are rendered server-side at email generation time, so no JavaScript or client-side rendering is required in the email client.
- The email template already has access to the full analytics data payload (sources, pages, daily metrics) used by the existing tables — no new data fetching is required.
- The design token file (`src/emails/styles.ts`) is the authoritative source for all colours used in charts; no new brand colours will be introduced for this feature.
- Charts are delivered as image attachments using the same CID inline attachment mechanism as the banner image, ensuring compatibility across email clients including Outlook.
- A maximum of 10 items is sufficient for top sources and top pages charts (consistent with existing table caps).
- For the email preview script, charts will be base64-inlined (matching the existing banner preview approach) so they render correctly in browsers during development.
- The daily trend chart uses an area chart style (line with filled area beneath) rather than a plain bar chart — the filled area gives visual weight to a 7-point series and makes the trend curve immediately readable, matching the convention used by major analytics dashboards.
