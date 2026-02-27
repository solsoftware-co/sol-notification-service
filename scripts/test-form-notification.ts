const EVENT_URL = "http://localhost:8288/e/local";

const payload = {
  name: "form/submitted",
  data: {
    clientId: "client-acme",
    submitterName: "Jane Smith",
    submitterEmail: "jane@example.com",
    submitterMessage:
      "Hi, I'd like to get a quote for your services. Please get back to me at your earliest convenience.",
    formId: "contact",
  },
};

async function sendTestEvent(): Promise<void> {
  console.log(`Sending form/submitted event to ${EVENT_URL}...`);
  console.log("Payload:", JSON.stringify(payload.data, null, 2));

  const res = await fetch(EVENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    console.log(`✓ Event sent (HTTP ${res.status}) — check http://localhost:8288 for the run`);
  } else {
    const body = await res.text();
    console.error(`✗ Failed (HTTP ${res.status}): ${body}`);
    process.exit(1);
  }
}

sendTestEvent().catch((err) => {
  console.error("✗ Could not reach Inngest Dev Server — is `npm run dev` running?");
  console.error(err.message);
  process.exit(1);
});
