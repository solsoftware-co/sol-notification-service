# Research: Inngest Dev Server Setup

**Feature**: 001-inngest-dev-setup
**Date**: 2026-02-23
**Status**: Complete — all unknowns resolved

---

## Decision 1: Inngest Node.js Adapter

**Decision**: Use `inngest/node` adapter from the main `inngest` package (no separate adapter package).

**Rationale**: The `inngest/node` export returns a raw Node.js HTTP handler with the signature
`(req: IncomingMessage, res: ServerResponse) => void`. This is passed directly to
`http.createServer()` with zero framework overhead. All adapters ship inside the `inngest`
package itself — no additional install required.

**Serve handler pattern:**
```typescript
import { serve } from "inngest/node";
const handler = serve({ client: inngest, functions });
createServer((req, res) => {
  if (req.url?.startsWith("/api/inngest")) return handler(req, res);
  // ... other routes
}).listen(3000);
```

**Alternatives considered:**
- `inngest/express`: Returns Express middleware, not a raw handler. Adds Express as a
  runtime dependency — unnecessary for a simple serve endpoint.
- `inngest/hono`: Hono would be cleaner for Vercel compatibility but adds framework
  overhead. Can be introduced later if needed.
- Direct framework-less fetch adapter: Too complex for local dev; no benefit at this stage.

---

## Decision 2: TypeScript Module Format

**Decision**: CommonJS (`"module": "CommonJS"`, `"moduleResolution": "node"`).

**Rationale**: CommonJS avoids the `.js` extension requirement on local imports in ESM
(`import { foo } from "./foo.js"` boilerplate). The `inngest` SDK fully supports CommonJS.
`tsx` runs CommonJS TypeScript without compilation. The `tsconfig.json` targets `ES2022`
to access modern language features while remaining compatible with Node.js 20+.

**Alternatives considered:**
- ESM (`"module": "NodeNext"`): Requires `.js` extensions on all local imports. Adds
  friction for developers and AI-assisted code generation. No benefit at this stage.

---

## Decision 3: Concurrent Dev Process Management

**Decision**: `concurrently` v9 with named processes; `tsx watch --env-file .env.local` for
hot reload; `npx inngest-cli@latest dev` for the Inngest Dev Server.

**Rationale:**
- `concurrently` is the standard tool for running multiple npm scripts in parallel in one
  terminal. The `--kill-others-on-fail` flag ensures a crashing server stops both processes
  cleanly rather than leaving orphan processes.
- `tsx watch` provides TypeScript hot reload without a separate compilation step.
  The `--env-file .env.local` flag (tsx 4.x+) loads environment variables without `dotenv`.
- `npx inngest-cli@latest` invokes the Inngest CLI without adding it to `devDependencies`,
  keeping the install clean and ensuring the latest CLI version is always used.

**Resulting `dev` script:**
```
concurrently
  --names "server,inngest"
  --prefix-colors "cyan,yellow"
  --kill-others-on-fail
  "tsx watch --env-file .env.local src/index.ts"
  "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"
```

**Alternatives considered:**
- `nodemon + ts-node`: Older pattern, slower startup, deprecated in favour of `tsx`.
- Installing `inngest-cli` as a devDependency: Pins the CLI version and adds an extra
  binary to install. `npx` is the pattern Inngest's own docs recommend.
- `npm-run-all`: Less ergonomic than `concurrently` for parallel processes with labelled output.

---

## Decision 4: Inngest Client Configuration

**Decision**: Minimal client with only `id: "notification-service"`. No `eventKey` or
`signingKey` required for local dev — the Inngest Dev Server handles auth locally.

**Rationale**: In development mode (local Inngest Dev Server), no signing key or event key
is needed. The client ID `notification-service` matches the PRD specification. Environment-
aware config (reading `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) will be added in a later
feature when multi-environment support is implemented.

---

## Decision 5: Example Function Design

**Decision**: A single `hello-world` function triggered by `test/hello.world` events, with
one `step.run()` call that logs and returns a message.

**Rationale:**
- Establishes the canonical function structure (Principle V: AI-Agent Friendly)
- Uses `step.run()` to verify the Inngest step execution pipeline end-to-end (Principle I)
- Named step (`"log-message"`) satisfies Principle IV observability requirements
- No external integrations (no DB, no email) — pure scaffold

---

## Resolved Unknowns Summary

| Unknown | Resolution |
|---------|-----------|
| Inngest adapter import path | `inngest/node` (inside main package) |
| serve() return type | Raw Node.js `(req, res) => void` handler |
| TypeScript module format | CommonJS (no .js extension boilerplate) |
| Hot reload tooling | `tsx watch --env-file .env.local` |
| Concurrent process runner | `concurrently` v9 |
| Inngest CLI invocation | `npx inngest-cli@latest dev -u <url>` |
| Event key required locally? | No — Dev Server handles auth locally |
