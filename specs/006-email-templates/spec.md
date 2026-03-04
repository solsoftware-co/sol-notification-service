# Feature Specification: Professional Email Template System

**Feature Branch**: `006-email-templates`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "please generate a spec that closes issue 1. Currently there are two types of email templates that need to be supported... inquiry emails, and analytics email. I've gone ahead and pasted the existing email library @emails/ to give you an idea of the current email branding templates etc. Please feel free to change these and make them more professional but the point of this spec is to up the quality of the emails being sent and to make them more reusable to promote consistent branding"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recipient Receives a Professional Inquiry Notification (Priority: P1)

A Sol Software client receives an email notification when a prospect fills out an inquiry form on their website. The email must present the prospect's details in a polished, structured format that makes it easy for the client to review and act on the lead quickly.

**Why this priority**: Inquiry emails are the most time-sensitive communication in the system. A professional, readable email directly impacts whether a client follows up on a lead promptly. This is the core value proposition for clients using the notification service.

**Independent Test**: Can be fully tested by triggering a mock form submission and reviewing the rendered inquiry email in a browser preview — delivering a complete, visually polished lead notification with no further context.

**Acceptance Scenarios**:

1. **Given** a new inquiry is submitted with a customer name, email, phone number, service of interest, and optional comments, **When** the notification email is generated, **Then** the email displays all customer fields in a clearly labelled, readable layout with the Sol Software brand visible in the header.
2. **Given** a new inquiry is submitted without optional comments, **When** the email is generated, **Then** the comments section is omitted entirely rather than displaying an empty or blank area.
3. **Given** the email is opened on a mobile device, **When** the recipient views the email, **Then** all content remains readable and no text or sections are cut off or require horizontal scrolling.
4. **Given** the email is opened in a major email client (Gmail, Outlook, Apple Mail), **When** the recipient views the email, **Then** the layout, fonts, and branding render consistently across all three clients.

---

### User Story 2 - Recipient Receives a Professional Weekly Analytics Report (Priority: P2)

A Sol Software client receives a weekly email summarising key website analytics metrics for their business. The email must present data clearly and hierarchically so the client can understand their website's performance at a glance without needing to log in to any analytics platform.

**Why this priority**: Analytics report emails are the primary recurring value touchpoint between Sol Software and its clients. High visual quality and clarity in these emails directly influence the perceived value of the service.

**Independent Test**: Can be fully tested by triggering a mock analytics workflow and reviewing the rendered report email in a browser preview — delivering a complete weekly summary with stats and charts.

**Acceptance Scenarios**:

1. **Given** an analytics report is generated with visit count, average visit duration, total users, and new users, **When** the email is rendered, **Then** each metric is displayed prominently with a human-readable description of the period or comparison context.
2. **Given** one or more chart images are included with the report, **When** the email is rendered, **Then** each chart appears inline with a title and description, and is sized appropriately for the email width without overflow.
3. **Given** no chart images are available for a given week, **When** the email is rendered, **Then** the chart sections are omitted entirely and the stats-only layout remains visually coherent.
4. **Given** the email is opened by a recipient in a preview pane or with images disabled, **When** the email loads, **Then** a preview summary line appears in the inbox preview, and stat values remain legible even without chart images.

---

### User Story 3 - Consistent Branding Across All Email Types (Priority: P3)

Any email sent through the notification service — regardless of type — shares a consistent visual identity: the Sol Software brand mark, a unified colour palette, typography hierarchy, and a professional footer with contact information. New email types added in future can be built from shared components without re-implementing brand styles.

**Why this priority**: Consistent branding across email types builds trust with recipients and makes the notification service more maintainable as more email types are added in future features.

**Independent Test**: Can be tested by rendering both an inquiry email and an analytics email side-by-side and confirming shared brand elements (logo, colours, footer) are visually identical, and that no branding elements are duplicated or missing.

**Acceptance Scenarios**:

1. **Given** both email types are rendered, **When** compared side-by-side, **Then** the Sol Software logo, background colour, primary font, link colour, and footer content are visually identical in both.
2. **Given** a developer adds a new email type using the shared components, **When** they assemble the template, **Then** they can achieve correct branding by composing existing shared components without writing new style definitions from scratch.
3. **Given** the brand colour or logo needs to be updated, **When** the change is made in a single shared location, **Then** both inquiry and analytics email templates reflect the update automatically without requiring changes to individual templates.

---

### Edge Cases

- What happens when a prospect's comments field contains very long text (e.g., multiple paragraphs)?
- How does the analytics email render when only one metric is available and others are missing?
- What is displayed in the email client inbox preview line when no explicit preview text is provided?
- How does the banner logo render in email clients that block external images? (Current implementation uses a CID inline attachment — this behaviour should be preserved.)
- What happens when a chart image reference is invalid or absent — does the chart section collapse gracefully?

---

## Requirements *(mandatory)*

### Functional Requirements

**Shared Design System**

- **FR-001**: The email library MUST define a single, shared set of design tokens (colours, typography scale, spacing) used by all components and templates — no component may define its own independent colour or font values outside the token definitions.
- **FR-002**: All email templates MUST include a consistent header region displaying the Sol Software brand mark.
- **FR-003**: All email templates MUST include a consistent footer region containing at minimum: a copyright notice, the sending organisation name, and a note that the email was sent automatically by the notification service.
- **FR-004**: The shared component library MUST expose individually reusable components for: brand header (logo/banner), section heading, body text block, labelled data row pair, metric/stat display card, chart display card, and footer.

**Inquiry Email Template**

- **FR-005**: The inquiry email template MUST display the following customer fields: full name, email address, phone number, and service of interest.
- **FR-006**: The inquiry email template MUST conditionally display a customer comments section only when comments are present; the section MUST be omitted entirely when comments are empty or absent.
- **FR-007**: The inquiry email template MUST display contextual metadata including: the date and time the form was submitted, a link to the source page where the form was submitted, and a link to the associated activity log.
- **FR-008**: The inquiry email template MUST render the customer email address as a `mailto:` link and the phone number as a `tel:` link where those values are present.

**Analytics Email Template**

- **FR-009**: The analytics email template MUST display the following metrics: total website visits, average visit duration, total users, and new users — each accompanied by a human-readable context description supplied at render time.
- **FR-010**: The analytics email template MUST support an ordered list of chart sections, each containing a title, a description, and an inline chart image.
- **FR-011**: Each chart section MUST be omitted individually if its image reference is absent; remaining chart sections and all stat sections MUST be unaffected.
- **FR-012**: The analytics email template MUST support an inbox preview text value (the summary line displayed in email client inbox before the email is opened) that is supplied at render time and summarises the report period.

**Quality & Compatibility**

- **FR-013**: All templates MUST render without layout defects in Gmail (web), Outlook 2019+, and Apple Mail.
- **FR-014**: All templates MUST be readable on viewports as narrow as 375px without horizontal scrolling or text truncation.
- **FR-015**: All email components MUST use inline styles only — no external stylesheets, no CSS class names, no CSS custom properties — to ensure compatibility with major email clients.

### Key Entities

- **Email Template**: A complete, self-contained email document composed from shared components. Accepts typed input data and produces a renderable HTML email. Two concrete templates exist: Inquiry and Analytics Report.
- **Shared Component**: A reusable UI building block (banner, section heading, stat card, chart card, data row, footer, etc.) that encapsulates a piece of email layout. All styles are sourced exclusively from the shared design token definitions.
- **Design Token**: A named, single-source-of-truth value for a visual property (colour, font size, spacing, border radius) referenced by all components — no component defines these values independently.
- **Inquiry Email Data**: The structured input to the inquiry template — customer contact fields (name, email, phone, service of interest), optional comments, submission timestamp, source page reference, and activity log reference.
- **Analytics Report Email Data**: The structured input to the analytics template — report header text, four metric objects (value + description each), an optional inbox preview text string, and an ordered list of chart objects (title, description, image reference).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both email types render without visual defects (broken layout, missing sections, unstyled text) in Gmail web, Outlook 2019, and Apple Mail — verified via the `email:preview` script and manual review.
- **SC-002**: A developer can produce a correctly branded new email template by composing only existing shared components, without writing any new colour, font, or spacing values.
- **SC-003**: The inquiry email clearly presents the customer's name, contact method, and service of interest such that a recipient can identify the lead within 10 seconds of opening the email.
- **SC-004**: The analytics email presents all four headline metrics without requiring the recipient to scroll on a standard desktop email client (1280px viewport width).
- **SC-005**: Updating a brand colour in the single shared token definition propagates to both templates without any changes to individual template or component files.
- **SC-006**: The inquiry email renders correctly both with and without the comments field populated — confirmed by two separate preview renders.

---

## Assumptions

- The Sol Software brand mark (logo image) is supplied as a CID inline email attachment. The template references it by CID identifier. This approach is preserved from the existing implementation.
- Emails are rendered using the `@react-email/components` library already present in the project.
- The primary recipients of inquiry emails are Sol Software clients (business owners or account managers), not end consumers — a professional but approachable tone is appropriate.
- Analytics report emails are fully automated. No personalised narrative text beyond the metric descriptions supplied by the workflow is expected.
- No unsubscribe mechanism is required for transactional inquiry emails. Analytics report emails should include a note that the email is automated, but a full unsubscribe flow is out of scope for this feature.
- Dark mode email rendering is a desirable stretch goal but is not mandated by this spec.
- The `npm run email:preview` script is the primary mechanism for validating rendered output during development.
