import express, { type Express } from "express";
import { webhookRouter } from "./modules/webhooks/router.js";
import { healthRouter } from "./routes/health.js";

export function createApp(): Express {
  const app = express();

  // Webhook router mounted BEFORE express.json().
  // Webhook routes use express.raw() per-route to preserve the raw body
  // required for Twilio signature verification. If express.json() runs first
  // it consumes the body and signature verification breaks.
  app.use(webhookRouter);

  app.use(express.json());

  app.use(healthRouter);

  return app;
}
