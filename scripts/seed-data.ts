import { db } from "../src/lib/db";

const clients = [
  {
    id: "client-acme",
    name: "Acme Corp",
    email: "test-acme@example.com",
    ga4_property_id: "123456789", // numeric ID only — analytics.ts prefixes "properties/" internally
    active: true,
    settings: {
      notifications: {
        // form_submitted: two recipients — exercises multi-recipient send path
        form_submitted: ["sales-test@acme-test.com", "owner-test@acme-test.com"],
        // analytics_report: one recipient — exercises single-item list path
        analytics_report: ["marketing-test@acme-test.com"],
      },
    },
  },
  {
    id: "client-globex",
    name: "Globex Inc",
    email: "test-globex@example.com",
    ga4_property_id: null, // intentionally no GA4 — tests the "not configured" error path
    active: true,
    settings: {}, // no notifications key — exercises the client.email fallback path
  },
];

async function seed(): Promise<void> {
  console.log("[db] Running seed...");

  for (const client of clients) {
    await db.query(
      `INSERT INTO clients (id, name, email, ga4_property_id, active, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         ga4_property_id = EXCLUDED.ga4_property_id,
         active = EXCLUDED.active,
         settings = EXCLUDED.settings`,
      [
        client.id,
        client.name,
        client.email,
        client.ga4_property_id,
        client.active,
        JSON.stringify(client.settings),
      ]
    );
    console.log(`[db] Seeded client: ${client.id} (${client.name})`);
  }

  console.log(`[db] Seed complete — ${clients.length} clients available`);
  await db.end();
}

seed().catch((err) => {
  console.error("[db] Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
