# Feature Specification: Inngest Dev Server Setup

**Feature Branch**: `001-inngest-dev-setup`
**Created**: 2026-02-23
**Status**: Draft
**Input**: Set up the basic repo with the bare minimum requirements to spin up the Inngest dev server.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Starts Local Dev Environment (Priority: P1)

A developer clones the repository, installs dependencies with a single command,
and starts the local development environment. The Inngest Dev UI becomes accessible
in their browser with a registered function visible and ready to accept test events.

**Why this priority**: This is the entire scope of this feature. Nothing else can be
built or tested until a developer can run the service locally and interact with Inngest.

**Independent Test**: Run `npm install && npm run dev`, open http://localhost:8288 in a
browser, confirm the Inngest Dev UI loads and shows at least one registered function.

**Acceptance Scenarios**:

1. **Given** a freshly cloned repository, **When** a developer runs `npm install`,
   **Then** all dependencies install without errors.

2. **Given** dependencies are installed, **When** a developer runs `npm run dev`,
   **Then** the application server and Inngest Dev Server both start without errors,
   and the Inngest Dev UI is accessible at http://localhost:8288.

3. **Given** the dev environment is running, **When** a developer opens the Inngest Dev
   UI at http://localhost:8288, **Then** at least one registered Inngest function appears
   in the functions list.

4. **Given** the Inngest Dev UI shows a registered function, **When** a developer sends
   a test event matching that function's trigger, **Then** the function run appears in
   the Inngest UI with a successful status.

5. **Given** a new developer joins the project, **When** they follow only the README
   setup instructions, **Then** they can reach the Inngest Dev UI and trigger a test
   function run in under 15 minutes.

---

### Edge Cases

- What happens when port 8288 (Inngest Dev Server) or the app server port is already
  in use? The dev script should fail with a clear error message rather than silently hang.
- What happens if no `.env.local` file exists? The service should start successfully with
  development defaults; `.env.example` must document all variables so there are no
  hidden configuration requirements.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST include a `package.json` with all required dependencies and
  a `dev` npm script that starts the complete local development environment in one command.
- **FR-002**: The project MUST include TypeScript configuration (`tsconfig.json`) so
  TypeScript source files compile and execute correctly in development.
- **FR-003**: The project MUST define an Inngest client instance in `src/inngest/client.ts`
  configured for the development environment.
- **FR-004**: The project MUST expose an Inngest serve handler (HTTP endpoint) that
  registers functions with the Inngest Dev Server so it can discover and invoke them.
- **FR-005**: The project MUST include at least one example Inngest function in
  `src/inngest/functions/` that the serve handler registers, to confirm the pipeline works end-to-end.
- **FR-006**: The project MUST include `src/inngest/functions/index.ts` that exports all
  registered Inngest functions as a single array for the serve handler to consume.
- **FR-007**: The project MUST include a `.env.example` file documenting every environment
  variable the service reads, with placeholder values and inline comments explaining each.
- **FR-008**: The project MUST include a `.gitignore` that excludes `.env.local`,
  `node_modules/`, and any compiled output directories.
- **FR-009**: Running `npm run dev` MUST concurrently start both the application server
  and the Inngest Dev Server, with the Dev Server pointed at the serve handler endpoint.

### Key Entities

- **Inngest Client**: The configured Inngest SDK instance shared by all functions and the
  serve handler. Scoped to the `notification-service` application ID.
- **Inngest Function**: A named, event-triggered unit of work registered with the serve
  handler. At minimum one example function must be present for end-to-end validation.
- **Serve Handler**: The HTTP endpoint the Inngest Dev Server polls to discover registered
  functions and deliver event payloads for execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with Node.js installed can go from `git clone` to a running
  Inngest Dev UI in under 15 minutes by following only the README instructions.
- **SC-002**: `npm run dev` exits with zero errors and produces console output confirming
  both the application server and Inngest Dev Server are running.
- **SC-003**: The Inngest Dev UI at http://localhost:8288 displays at least one registered
  function within 10 seconds of the dev environment starting.
- **SC-004**: A test event triggered from the Inngest Dev UI results in a visible function
  run with a completed status within 10 seconds.
- **SC-005**: Every environment variable the service reads at runtime has a corresponding
  entry in `.env.example`, leaving zero hidden configuration for developers to discover.

## Assumptions

- Runtime is Node.js 20+ and the package manager is npm (per PRD).
- TypeScript execution in dev mode uses `tsx` — no separate compile step is required locally.
- The application server runs on port 3000 by default; Inngest Dev Server uses port 8288.
- The example function is a minimal stub with no external service integrations (no database,
  no email provider) — it exists solely to prove the Inngest pipeline works.
- Environment variables not present default to safe development values; missing optional
  keys do not crash the application.
- The serve handler is implemented as a standalone Node.js HTTP server (not tied to any
  web framework), consistent with a Vercel Functions deployment model.
