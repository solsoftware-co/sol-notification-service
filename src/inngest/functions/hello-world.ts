import { inngest } from "../client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const result = await step.run("log-message", async () => {
      console.log("Hello from Inngest!", event.data);
      return { message: "Hello, world!", receivedAt: new Date().toISOString() };
    });
    return result;
  }
);
