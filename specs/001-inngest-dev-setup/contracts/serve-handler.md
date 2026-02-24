# Contract: Inngest Serve Handler

**Feature**: 001-inngest-dev-setup
**Date**: 2026-02-23

The serve handler is the HTTP interface between the application and the Inngest platform
(Dev Server locally, Cloud in production). It is automatically managed by the Inngest SDK
— developers do not implement these endpoints directly.

---

## Endpoint: `/api/inngest`

**Method**: `GET`, `POST`, `PUT`
**Handler**: `inngest/node` `serve()` adapter

### GET /api/inngest

Used by the Inngest Dev Server to discover registered functions. Returns metadata about
all functions registered with the serve handler.

**Response (200):**
```json
{
  "message": "Inngest endpoint configured correctly.",
  "hasSigningKey": false,
  "functionsFound": 1,
  "functions": [
    {
      "id": "hello-world",
      "name": "hello-world",
      "triggers": [{ "event": "test/hello.world" }],
      "steps": {}
    }
  ]
}
```

### POST /api/inngest

Used by the Inngest Dev Server to invoke a registered function when a matching event
is sent. The request body is signed by Inngest (signature verification is bypassed
in local dev mode).

**Request body**: Inngest-internal event envelope (SDK-managed, not developer-defined).

**Response (200 or 206)**: Step execution result — SDK-managed.

### PUT /api/inngest

Used by Inngest for step memoization and coordination during multi-step function runs.
SDK-managed; developers do not call this directly.

---

## Endpoint: `/health`

**Method**: `GET`
**Purpose**: Lightweight health check confirming the server is running.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Notes

- All `/api/inngest` traffic is fully managed by the `inngest/node` SDK adapter.
- In local development, the Inngest Dev Server (http://localhost:8288) polls `GET /api/inngest`
  on startup to sync function definitions.
- No authentication is applied to `/health`.
- No custom routes are defined in this feature beyond `/api/inngest` and `/health`.
