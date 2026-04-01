import { initDb, closeDb } from "@ice/core";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { runMigrations } from "./lib/migrate.js";
import { stopTelemetry } from "./lib/telemetry.js";
import { startWorker, stopWorker } from "./workers/outbox.js";

async function main(): Promise<void> {
  initDb(config.databaseUrl);
  await runMigrations();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, "API server started");
  });

  startWorker();

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down gracefully...");
    stopWorker();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDb();
    await stopTelemetry();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal startup error: ${message}\n`);
  process.exit(1);
});
