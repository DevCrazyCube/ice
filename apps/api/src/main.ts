import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "API server started");
});
