# Quickstart: Automated Testing & CI Pipeline

**Feature**: 004-testing-ci
**Date**: 2026-02-27

---

## Running the Tests Locally

No `.env.local` or live services required.

```bash
# Run the full suite once (CI mode)
npm test

# Run in watch mode (re-runs affected tests on file save)
npm run test:watch
```

Expected output on a clean run:
```
✓ tests/unit/lib/config.test.ts (4 tests)
✓ tests/unit/lib/db.test.ts (3 tests)
✓ tests/unit/lib/email.test.ts (3 tests)
✓ tests/unit/inngest/functions/form-notification.test.ts (9 tests)

Test Files  4 passed (4)
Tests      19 passed (19)
Duration   ~3s
```

---

## Scenario Walkthroughs

### Scenario 1: Happy Path — All Steps Complete

The engine drives the full `sendFormNotification` function with a valid event and a mocked active client.

```typescript
const t = new InngestTestEngine({
  function: sendFormNotification,
  transformCtx: (ctx) => ({ ...mockCtx(ctx), events: [validEvent] }),
});

vi.mocked(getClientById).mockResolvedValue(mockClient);
vi.mocked(sendEmail).mockResolvedValue(mockEmailResult);

const { result } = await t.execute();
// result === { clientId: "client-acme", outcome: "logged" }
```

**Verify**: `sendEmail` was called once with `to: "owner@acme.com"`.

---

### Scenario 2: Missing Required Field — Validate-Payload Fails

```typescript
const tMissing = t.clone({
  transformCtx: (ctx) => ({
    ...mockCtx(ctx),
    events: [{ ...validEvent, data: { ...validEvent.data, submitterEmail: "" } }],
  }),
});

await expect(tMissing.executeStep("validate-payload")).rejects.toThrow(
  "Missing required field: submitterEmail"
);
```

**Verify**: `sendEmail` is never called (only `validate-payload` ran).

---

### Scenario 3: Unknown Client — Fetch-Client-Config Fails

```typescript
vi.mocked(getClientById).mockRejectedValue(new Error("Client not found: bad-id"));

await expect(t.executeStep("fetch-client-config")).rejects.toThrow(
  "Client not found: bad-id"
);
```

**Verify**: Error message surfaces exactly in the Inngest dashboard (production parity).

---

### Scenario 4: Inactive Client — Fetch-Client-Config Fails

```typescript
vi.mocked(getClientById).mockRejectedValue(new Error("Client inactive: client-acme"));

await expect(t.executeStep("fetch-client-config")).rejects.toThrow(
  "Client inactive: client-acme"
);
```

---

### Scenario 5: Email Module — Mock Mode

```typescript
// In email.test.ts — config mock returns emailMode: "mock"
const result = await sendEmail({
  to: "owner@acme.com",
  subject: "New form submission: contact",
  html: "<p>Hello</p>",
});
// result.outcome === "logged"
// result.mode === "mock"
// No Resend SDK call made
```

---

### Scenario 6: Email Module — Test Mode Redirect

```typescript
// Config mock: emailMode: "test", testEmail: "dev@test.local"
const result = await sendEmail({
  to: "owner@acme.com",
  subject: "New form submission: contact",
  html: "<p>Hello</p>",
});
// result.actualTo === "dev@test.local"
// result.subject === "[TEST: owner@acme.com] New form submission: contact"
```

---

### Scenario 7: Config — Missing DATABASE_URL at Startup

```typescript
// In config.test.ts — reset modules between tests
vi.resetModules();
delete process.env.DATABASE_URL;

await expect(import("../../../src/lib/config")).rejects.toThrow(
  /DATABASE_URL/
);
```

---

## Verifying CI Locally (act)

If you have [`act`](https://github.com/nektos/act) installed, you can run the GitHub Actions workflow locally:

```bash
act pull_request --job type-check
act pull_request --job test
```

This is optional — CI runs automatically on every PR push.

---

## Configuring Branch Protection (Admin Step)

After the CI workflow is merged, a repository admin must enable required status checks:

1. GitHub → Repository → Settings → Branches → Branch protection rules
2. Add rule for `main`
3. Check **Require status checks to pass before merging**
4. Search for and add: `Type Check` and `Test`
5. Save

Once configured, GitHub will block merging any PR where either check fails or is absent.
