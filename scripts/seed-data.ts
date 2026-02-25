import { db } from "../src/lib/db";

const clients = [
  {
    id: "client-acme",
    name: "Acme Corp",
    email: "test-acme@example.com",
    ga4_property_id: "properties/123456789",
    active: true,
    settings: {},
  },
  {
    id: "client-globex",
    name: "Globex Inc",
    email: "test-globex@example.com",
    ga4_property_id: null,
    active: true,
    settings: {},
  },
];

async function seed(): Promise<void> {
  console.log("[db] Running seed...");

  for (const client of clients) {
    await db.query(
      `INSERT INTO clients (id, name, email, ga4_property_id, active, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
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
