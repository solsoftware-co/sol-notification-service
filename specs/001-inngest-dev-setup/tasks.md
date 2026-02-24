---

description: "Task list for Inngest Dev Server Setup"
---

# Tasks: Inngest Dev Server Setup

**Input**: Design documents from `/specs/001-inngest-dev-setup/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: No tests — not requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing. There is one user story (P1), which is also the full MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create all project configuration files. These files have no dependencies
on each other and can all be created in parallel.

- [x] T001 [P] Create `package.json` with `name`, `version`, `private`, `engines` (node >=20), `scripts` (`dev`, `build`, `start`, `type-check`), `dependencies` (`inngest ^3.0.0`), and `devDependencies` (`@types/node ^20.0.0`, `concurrently ^9.0.0`, `tsx ^4.0.0`, `typescript ^5.0.0`). The `dev` script must be: `concurrently --names "server,inngest" --prefix-colors "cyan,yellow" --kill-others-on-fail "tsx watch --env-file .env.local src/index.ts" "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"`
- [x] T002 [P] Create `tsconfig.json` with `compilerOptions`: `target: "ES2022"`, `module: "CommonJS"`, `moduleResolution: "node"`, `lib: ["ES2022"]`, `outDir: "dist"`, `rootDir: "src"`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`, `resolveJsonModule: true`, `sourceMap: true`. Include `["src/**/*"]` and exclude `["node_modules", "dist"]`
- [x] T003 [P] Create `.gitignore` excluding: `node_modules/`, `dist/`, `.env.local`, `*.js.map`, `.DS_Store`
- [x] T004 [P] Create `.env.example` with all 9 environment variables from `data-model.md` (PORT, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, VERCEL_ENV, EMAIL_MODE, TEST_EMAIL, DATABASE_URL, RESEND_API_KEY, ANTHROPIC_API_KEY), each with a placeholder value and an inline comment explaining its purpose. Set `PORT=3000`, `VERCEL_ENV=development`, `EMAIL_MODE=mock`

**Checkpoint**: All config files exist. Run `npm install` to verify package.json is valid.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the Inngest client — required by all functions and the serve handler.
This MUST complete before any Phase 3 work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Create `src/inngest/client.ts` exporting a single `inngest` constant: `new Inngest({ id: "notification-service" })`. Import `Inngest` from `"inngest"`. No signing key or event key — the Dev Server handles auth locally.

**Checkpoint**: Foundation ready — `src/inngest/client.ts` exists and exports `inngest`. User story implementation can now begin.

---

## Phase 3: User Story 1 - Developer Starts Local Dev Environment (Priority: P1) 🎯 MVP

**Goal**: `npm install && npm run dev` starts both the app server and Inngest Dev Server.
The Inngest Dev UI at http://localhost:8288 shows a registered function. Sending a
`test/hello.world` event produces a Completed run in the UI.

**Independent Test**: `npm install && npm run dev` → open http://localhost:8288 → confirm
`hello-world` function appears in the Functions list → send event `test/hello.world` with
any JSON payload → verify run status is `Completed` within 10 seconds.

### Implementation for User Story 1

- [x] T006 [US1] Create `src/inngest/functions/hello-world.ts` exporting a `helloWorld` constant. Use `inngest.createFunction({ id: "hello-world" }, { event: "test/hello.world" }, async ({ event, step }) => {...})`. Inside the handler, call `step.run("log-message", async () => { console.log("Hello from Inngest!", event.data); return { message: "Hello, world!", receivedAt: new Date().toISOString() }; })` and return its result. Import `inngest` from `"../client"`. (Depends on T005)
- [x] T007 [US1] Create `src/inngest/functions/index.ts` that imports `helloWorld` from `"./hello-world"` and exports both the named export `helloWorld` and a `functions` array: `export const functions = [helloWorld]`. (Depends on T006)
- [x] T008 [US1] Create `src/index.ts` as the HTTP server entry point. Import `createServer` from `"node:http"`, `serve` from `"inngest/node"`, `inngest` from `"./inngest/client"`, and `functions` from `"./inngest/functions/index"`. Create `const handler = serve({ client: inngest, functions })`. Create a `createServer` that routes `req.url?.startsWith("/api/inngest")` to `handler(req, res)`, routes `req.url === "/health"` to a JSON `{ status: "ok" }` response (200), and returns 404 for all other paths. Parse `PORT` from `process.env.PORT` defaulting to `3000`. Log `"Server listening on http://localhost:${PORT}"` and `"Inngest serve handler ready at http://localhost:${PORT}/api/inngest"` on start. (Depends on T005, T007)

**Checkpoint**: At this point, User Story 1 is fully implemented and independently testable.
Run the independent test above to validate before proceeding to Polish.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and end-to-end validation.

- [x] T009 [P] Update `README.md` with setup instructions based on `specs/001-inngest-dev-setup/quickstart.md`. Include: prerequisites (Node.js 20+), three-step setup (`git clone`, `npm install`, `cp .env.example .env.local`, `npm run dev`), URL list (app server http://localhost:3000, Inngest Dev UI http://localhost:8288), and the test event payload for `test/hello.world`
- [x] T010 Manually run the validation checklist from `specs/001-inngest-dev-setup/quickstart.md` to confirm all 6 items pass: `npm install` clean, `npm run dev` zero errors, `/health` returns 200, Dev UI accessible, `hello-world` function visible, `test/hello.world` event produces a Completed run

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all 4 tasks can start immediately and in parallel
- **Foundational (Phase 2)**: Depends on Setup completion (needs `package.json` for imports)
- **User Story 1 (Phase 3)**: Depends on Foundational (T005 must exist before T006)
- **Polish (Phase 4)**: Depends on User Story 1 completion

### Within User Story 1

- T006 → T007 → T008 (strictly sequential — each imports from the prior file)
- T005 is also a prerequisite for T008 (T008 imports `inngest` directly from `client.ts`)

### Parallel Opportunities

- **Phase 1**: T001, T002, T003, T004 — all four can run simultaneously (separate files)
- **Phase 4**: T009 can run while T010 validation is in progress

---

## Parallel Example: Phase 1

```bash
# Launch all Phase 1 tasks simultaneously:
Task: "Create package.json at repo root (T001)"
Task: "Create tsconfig.json at repo root (T002)"
Task: "Create .gitignore at repo root (T003)"
Task: "Create .env.example at repo root (T004)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only = Full MVP)

This feature has one user story, which IS the MVP:

1. Complete **Phase 1** (Setup) — all tasks in parallel
2. Complete **Phase 2** (Foundational) — T005 only
3. Complete **Phase 3** (User Story 1) — T006 → T007 → T008 sequentially
4. **STOP and VALIDATE**: Run the independent test for User Story 1
5. Complete **Phase 4** (Polish) — T009 + T010

### Incremental Delivery

After Phase 3 T008 is complete, the full feature is functional:
- Developer can run `npm run dev`
- Inngest Dev UI shows `hello-world` function
- Test events produce visible runs

Phase 4 adds documentation and confirms the setup is reproducible by a new developer.

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [US1] label maps all Phase 3 tasks to User Story 1
- No tests generated — not requested in the specification
- All Phase 1 tasks are parallelizable; Phase 3 tasks are strictly sequential (import chain)
- Commit after T008 to capture a working state before Polish
- T010 is a manual validation step — run it interactively, not as a script
