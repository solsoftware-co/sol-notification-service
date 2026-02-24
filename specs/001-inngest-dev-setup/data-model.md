# Data Model: Inngest Dev Server Setup

**Feature**: 001-inngest-dev-setup
**Date**: 2026-02-23

---

## Overview

This feature contains no database entities. The data model consists of in-process
configuration objects and the Inngest event schema used by the example function.

---

## Inngest Client Configuration

An in-memory configuration object passed to the Inngest SDK on initialization.

| Field | Type | Value | Notes |
|-------|------|-------|-------|
| `id` | string | `"notification-service"` | Stable identifier for this app in Inngest |

No signing key or event key required in local development — the Dev Server handles
authentication. These will be added in the multi-environment feature.

---

## Inngest Function Registry

A list of registered Inngest functions exported from `src/inngest/functions/index.ts`
and passed to the serve handler. For this feature, one function is registered.

| Function ID | Trigger Event | Steps |
|-------------|--------------|-------|
| `hello-world` | `test/hello.world` | `log-message` |

---

## Event Schemas

### `test/hello.world`

Fired manually from the Inngest Dev UI to test the end-to-end pipeline. No specific
payload shape is required — any JSON object is accepted.

```typescript
{
  name: "test/hello.world";
  data: Record<string, unknown>; // Any JSON payload; no required fields
}
```

### Function Output

The `hello-world` function returns a plain object from its `log-message` step:

```typescript
{
  message: string;       // Always "Hello, world!"
  receivedAt: string;    // ISO 8601 timestamp of when the step ran
}
```

---

## Environment Variable Schema

All variables read by the server at runtime. No variable is required for local
development; defaults are used automatically.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | App server listen port |
| `INNGEST_EVENT_KEY` | No (dev) | none | Inngest event key (required in production) |
| `INNGEST_SIGNING_KEY` | No (dev) | none | Inngest signing key (required in production) |
| `VERCEL_ENV` | No | `development` | Deployment environment identifier |
| `EMAIL_MODE` | No | `mock` | Email sending mode (mock/test/live) |
| `TEST_EMAIL` | No | — | Redirect address for test email mode |
| `DATABASE_URL` | No | — | Database connection string (no DB in this feature) |
| `RESEND_API_KEY` | No | — | Email provider key (not used in this feature) |
| `ANTHROPIC_API_KEY` | No | — | AI provider key (not used in this feature) |
