import express, { type Express } from "express";
import { webhookRouter } from "./modules/webhooks/router.js";
import { authRouter } from "./modules/auth/router.js";
import { channelRouter } from "./modules/channels/router.js";
import { businessContextRouter } from "./modules/business-context/router.js";
import { healthRouter } from "./routes/health.js";
import { requireAuth } from "./lib/auth.js";

export function createApp(): Express {
  const app = express();

  // 1. Webhook router — raw body, no JSON parsing, no auth.
  //    Mounted BEFORE express.json() so that express.raw() per-route
  //    preserves the raw body for Twilio signature verification.
  app.use(webhookRouter);

  // 2. JSON parsing for all remaining routes.
  app.use(express.json());

  // 3. Public routes — no auth required.
  app.use(healthRouter);
  app.use(authRouter); // /auth/login, /auth/callback (public), /auth/logout (auth'd)

  // 4. Protected API routes — require auth. Individual routes add requireRole().
  app.use("/api/v1", requireAuth, channelRouter);
  app.use("/api/v1", requireAuth, businessContextRouter);

  return app;
}
