import "./load-env.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const handle = await createDatabase(config);
  const { app, context } = await buildApp({ config, db: handle.db });

  const recovered = await context.workflow.recoverInterruptedRuns();
  if (recovered > 0) {
    app.log.warn(`Marked ${recovered} interrupted workflow run(s) as resumable failures.`);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down Tulivu");
    try {
      await app.close();
      await handle.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    {
      mode: config.adapterMode,
      persistence: config.databaseUrl ? "postgres" : "pglite",
      model: config.model.provider,
      workflow: config.workflowInline ? "inline" : "background",
    },
    `Tulivu running at http://localhost:${config.port}`,
  );
}

main().catch((error) => {
  console.error("Tulivu failed to start:", error);
  process.exit(1);
});
