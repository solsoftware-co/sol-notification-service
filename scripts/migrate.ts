import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
import { db } from "../src/lib/db";

const MIGRATIONS_DIR = join(__dirname, "../db/migrations");

async function bootstrap(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function discoverMigrations(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => basename(f, ".sql"));
}

async function getAppliedVersions(): Promise<Set<string>> {
  const result = await db.query<{ version: string }>(
    "SELECT version FROM schema_migrations"
  );
  return new Set(result.rows.map((r) => r.version));
}

async function applyMigrations(
  pending: string[],
  applied: Set<string>
): Promise<void> {
  const pendingMigrations = pending.filter((v) => !applied.has(v));

  if (pendingMigrations.length === 0) {
    console.log("[migrate] Already up to date");
    return;
  }

  for (const version of pendingMigrations) {
    const filePath = join(MIGRATIONS_DIR, `${version}.sql`);
    const sql = await readFile(filePath, "utf-8");

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [version]
      );
      await client.query("COMMIT");
      console.log(`[migrate] ✓ applied ${version}`);
    } catch (err) {
      await client.query("ROLLBACK");
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[migrate] ✗ failed ${version}: ${message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log(`[migrate] ${pendingMigrations.length} migration(s) applied`);
}

async function printStatus(
  all: string[],
  applied: Set<string>
): Promise<void> {
  const result = await db.query<{ version: string; applied_at: Date }>(
    "SELECT version, applied_at FROM schema_migrations ORDER BY version"
  );
  const appliedMap = new Map(result.rows.map((r) => [r.version, r.applied_at]));

  let appliedCount = 0;
  let pendingCount = 0;

  for (const version of all) {
    if (appliedMap.has(version)) {
      const ts = appliedMap.get(version)!.toISOString();
      console.log(`[migrate] ✓ ${version}   applied ${ts}`);
      appliedCount++;
    } else {
      console.log(`[migrate] ○ ${version}   pending`);
      pendingCount++;
    }
  }

  console.log(`[migrate] ${appliedCount} applied, ${pendingCount} pending`);
}

async function run(): Promise<void> {
  const isStatus = process.argv.includes("--status");

  await bootstrap();
  const all = await discoverMigrations();
  const applied = await getAppliedVersions();

  if (isStatus) {
    await printStatus(all, applied);
  } else {
    await applyMigrations(all, applied);
  }

  await db.end();
}

run().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[migrate] Fatal error:", message);
  process.exit(1);
});
