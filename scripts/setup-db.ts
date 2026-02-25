import { db } from "../src/lib/db";

async function setup(): Promise<void> {
  console.log("[db] Running setup...");

  await db.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id              TEXT        PRIMARY KEY,
      name            TEXT        NOT NULL,
      email           TEXT        NOT NULL,
      ga4_property_id TEXT        NULL,
      active          BOOLEAN     NOT NULL DEFAULT TRUE,
      settings        JSONB       NOT NULL DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[db] Created table: clients");

  await db.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id          BIGSERIAL   PRIMARY KEY,
      client_id   TEXT        NOT NULL REFERENCES clients(id),
      workflow    TEXT        NOT NULL,
      event_name  TEXT        NOT NULL,
      outcome     TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[db] Created table: notification_logs");

  console.log("[db] Setup complete");
  await db.end();
}

setup().catch((err) => {
  console.error("[db] Setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
