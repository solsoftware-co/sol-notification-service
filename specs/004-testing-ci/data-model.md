# Data Model: Automated Testing & CI Pipeline

**Feature**: 004-testing-ci
**Date**: 2026-02-27

---

## Overview

This feature adds no new database tables or persistent entities. The "data" in this feature consists of test fixtures — in-memory controlled values that replace live external dependencies during test execution. These are not persisted anywhere.

---

## Test Fixtures (In-Memory Only)

### ClientRow Fixture

Used by: `db.test.ts`, `form-notification.test.ts`

Mirrors `ClientRow` from `src/types/index.ts`. Tests supply controlled instances.

| Field | Test Value | Purpose |
|-------|-----------|---------|
| `id` | `"client-acme"` | Matches seed data — consistent across test scenarios |
| `name` | `"Acme Corp"` | Human-readable label for test output |
| `email` | `"owner@acme.com"` | Controlled recipient for asserting email targeting |
| `ga4_property_id` | `null` | Not relevant to form notification tests |
| `active` | `true` / `false` | Both states must be tested |
| `settings` | `{}` | Empty — not consumed by form notification |
| `created_at` | `new Date()` | Required by type, not asserted on |

**Inactive client variant**: Same fixture with `active: false` — used to verify the "Client inactive" error path.

---

### EmailResult Fixture

Used by: `email.test.ts`, `form-notification.test.ts`

Mirrors `EmailResult` from `src/types/index.ts`.

| Field | Mock mode value | Test mode value | Live mode value |
|-------|----------------|-----------------|-----------------|
| `mode` | `"mock"` | `"test"` | `"live"` |
| `originalTo` | `"owner@acme.com"` | `"owner@acme.com"` | `"owner@acme.com"` |
| `actualTo` | `"owner@acme.com"` | `TEST_EMAIL value` | `"owner@acme.com"` |
| `subject` | `"New form submission: contact"` | `"[TEST: owner@acme.com] New form submission: contact"` | `"New form submission: contact"` |
| `outcome` | `"logged"` | `"sent"` | `"sent"` |

---

### FormSubmittedEvent Fixture

Used by: `form-notification.test.ts`

The event passed to `InngestTestEngine`. All fields must be present for the happy-path scenario.

| Field | Value | Notes |
|-------|-------|-------|
| `name` | `"form/submitted"` | Must match function trigger exactly |
| `data.clientId` | `"client-acme"` | Matches the ClientRow fixture |
| `data.submitterName` | `"Jane Smith"` | Arbitrary — asserted in email body content |
| `data.submitterEmail` | `"jane@example.com"` | Appears in email body, not the send target |
| `data.submitterMessage` | `"Hi, I'd like a quote."` | Asserted in email body content |
| `data.formId` | `"contact"` | Optional field — test both present and absent |

**Missing-field variants**: One fixture per required field with that field set to `""` — used for validate-payload failure tests.

---

## No New Database Schema

This feature introduces no migrations, no new tables, and no schema changes. All test doubles for database queries are provided by `vi.fn()` stubs returning the fixtures above.
