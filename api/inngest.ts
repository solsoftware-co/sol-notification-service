import { serve } from "inngest/node";
import { inngest } from "../src/inngest/client";
import { functions } from "../src/inngest/functions";

export default serve({ client: inngest, functions });
