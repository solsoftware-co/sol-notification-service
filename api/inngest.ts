import { serve } from "inngest/vercel";
import { inngest } from "../src/inngest/client";
import { functions } from "../src/inngest/functions";

// Disable Vercel's built-in body parser — Inngest reads the raw body for signature verification.
export const config = { api: { bodyParser: false } };

export default serve({ client: inngest, functions });
