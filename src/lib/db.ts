import { Pool, neonConfig } from "@neondatabase/serverless";
import type { QueryResult, QueryResultRow } from "@neondatabase/serverless";
import ws from "ws";
import { config } from "./config";
import type { ClientRow } from "../types/index";

// Required for Node.js — native WebSocket is not available until Node 22
neonConfig.webSocketConstructor = ws;

function createPool(): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (err: Error) => {
    console.error("[db] Pool idle client error:", err.message);
  });

  return pool;
}

export const db: Pool = createPool();

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}

export async function getClientById(id: string): Promise<ClientRow> {
  const result = await query<ClientRow>(
    "SELECT id, name, email, ga4_property_id, active, settings, created_at FROM clients WHERE id = $1",
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error(`Client not found: ${id}`);
  }

  const client = result.rows[0];

  if (!client.active) {
    throw new Error(`Client inactive: ${id}`);
  }

  return client;
}

export async function checkDbConnection(): Promise<void> {
  try {
    await db.query("SELECT 1");
    console.log("[db] Connection ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[db] Startup connection check failed:", message);
    process.exit(1);
  }
}
