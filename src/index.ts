import { createServer } from "node:http";
import { serve } from "inngest/node";
import { inngest } from "./inngest/client";
import { functions } from "./inngest/functions/index";

const handler = serve({ client: inngest, functions });

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const server = createServer((req, res) => {
  if (req.url?.startsWith("/api/inngest")) {
    return handler(req, res);
  }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Inngest serve handler ready at http://localhost:${PORT}/api/inngest`);
});
