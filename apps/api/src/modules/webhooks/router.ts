import express, { type Router } from "express";
import { validateRequest } from "twilio";
import { enqueue, getDb, recordAuditEvent, withSpan } from "@ice/core";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";
import { createRateLimiter } from "../../lib/rate-limit.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ChannelRow {
  id: string;
  organisation_id: string;
  agent_id: string;
  type: string;
}

export const webhookRouter: Router = express.Router();

/**
 * Per-organisation rate limiter for inbound webhooks.
 * Fixed window: 60 requests per minute per organisation.
 *
 * ⚠️  Single-instance only — see rate-limit.ts for details.
 */
const webhookLimiter = createRateLimiter(60_000, 60);

/**
 * POST /webhooks/inbound/:channelId
 *
 * Twilio SMS inbound webhook handler.
 *
 * Flow:
 *   1. Look up channel by ID — 404 if not found, 400 if not SMS
 *   2. Verify Twilio signature (HMAC-SHA1) — 401 on failure
 *   3. Durably enqueue job into Postgres outbox (idempotent via delivery_id)
 *   4. Record audit event (skipped for duplicate deliveries)
 *   5. Return 200 OK — only after outbox INSERT succeeds
 *
 * If the outbox INSERT fails, return 500 so Twilio retries delivery.
 * The 200 ACK must never be sent before durable persistence.
 *
 * Phase 1 — Twilio SMS only. No generic multi-provider routing.
 */
webhookRouter.post(
  "/webhooks/inbound/:channelId",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const { channelId } = req.params;

    // Validate UUID format before hitting the DB
    if (!UUID_RE.test(channelId)) {
      res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND" } });
      return;
    }

    // Channel-to-org lookup
    const db = getDb();
    const { rows } = await db.query<ChannelRow>(
      `SELECT id, organisation_id, agent_id, type FROM channels WHERE id = $1`,
      [channelId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND" } });
      return;
    }

    const channel = rows[0]!;

    if (channel.type !== "sms") {
      res.status(400).json({ error: { code: "UNSUPPORTED_CHANNEL_TYPE" } });
      return;
    }

    const organisationId = channel.organisation_id;
    const agentId = channel.agent_id;

    // Rate limit — per organisation, before signature verification
    const { allowed, retryAfterMs } = webhookLimiter.check(organisationId);
    if (!allowed) {
      res.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({ error: { code: "RATE_LIMITED" } });
      return;
    }

    // Parse the URLSearchParams body Twilio sends
    const bodyString = (req.body as Buffer).toString("utf-8");
    const params: Record<string, string> = {};
    new URLSearchParams(bodyString).forEach((value, key) => {
      params[key] = value;
    });

    const messageSid = params["MessageSid"];
    if (!messageSid) {
      res.status(400).json({ error: { code: "MISSING_MESSAGE_SID" } });
      return;
    }

    // Signature verification — must happen before any processing
    const signature = (req.headers["x-twilio-signature"] as string) ?? "";
    const url = new URL(req.originalUrl, config.publicWebhookUrl).toString();

    const isValid = config.twilioAuthToken
      ? validateRequest(config.twilioAuthToken, signature, url, params)
      : false;

    if (!isValid) {
      logger.warn({ url, channelId }, "Twilio webhook signature invalid");

      recordAuditEvent({
        organisationId,
        action: "webhook.signature_failed",
        metadata: { channelType: "sms", channelId },
        ipAddress: req.ip ?? null,
      }).catch((err) =>
        logger.error({ err }, "Failed to record signature_failed audit event")
      );

      res.status(401).json({ error: { code: "INVALID_SIGNATURE" } });
      return;
    }

    // Durable enqueue BEFORE ACK.
    // Return 500 on failure so Twilio retries delivery.
    try {
      const { inserted } = await withSpan(
        "http.ingest",
        {
          "organisation.id": organisationId,
          "channel.id": channelId,
          "channel.type": "sms",
          "agent.id": agentId,
          "message.sid": messageSid,
        },
        async (_span) => {
          const result = await enqueue({
            type: "message.process",
            organisationId,
            deliveryId: messageSid,
            channelId,
            channelType: "sms",
            agentId,
            messageSid,
            body: params,
          });

          if (result.inserted) {
            await recordAuditEvent({
              organisationId,
              action: "webhook.received",
              resourceType: "channel",
              resourceId: channelId,
              metadata: { channelType: "sms", messageSid },
              ipAddress: req.ip ?? null,
            });
          }

          return result;
        }
      );

      res.status(200).json({ received: true, duplicate: !inserted });
    } catch (err) {
      logger.error(
        { err, organisationId, channelId },
        "Webhook ingest failed — returning 500 for Twilio retry"
      );
      res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
  }
);
