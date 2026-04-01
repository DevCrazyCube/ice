import express, { type Router } from "express";
import { validateRequest } from "twilio";
import { enqueue, recordAuditEvent, withSpan } from "@ice/core";
import { config } from "../../lib/config.js";
import { logger } from "../../lib/logger.js";

export const webhookRouter: Router = express.Router();

/**
 * POST /webhooks/inbound/sms
 *
 * Twilio SMS inbound webhook handler.
 *
 * Flow:
 *   1. Verify Twilio signature (HMAC-SHA1) — 401 on failure
 *   2. Durably enqueue job into Postgres outbox
 *   3. Record audit event
 *   4. Return 200 OK — only after outbox INSERT succeeds
 *
 * If the outbox INSERT fails, return 500 so Twilio retries delivery.
 * The 200 ACK must never be sent before durable persistence.
 *
 * Phase 1 — Twilio SMS only. No generic multi-provider routing.
 */
webhookRouter.post(
  "/webhooks/inbound/sms",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    // TODO(phase-1-wiring): temporary — replace with channel-to-org DB lookup
    // once channel management routes are implemented.
    const organisationId =
      typeof req.query["orgId"] === "string" ? req.query["orgId"] : "";

    if (!organisationId) {
      res.status(400).json({ error: { code: "MISSING_ORG_ID" } });
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

    // Signature verification — must happen before any processing or logging
    const signature = (req.headers["x-twilio-signature"] as string) ?? "";
    const url = new URL(req.originalUrl, config.publicWebhookUrl).toString();

    const isValid = config.twilioAuthToken
      ? validateRequest(config.twilioAuthToken, signature, url, params)
      : false;

    if (!isValid) {
      logger.warn({ url }, "Twilio webhook signature invalid");

      if (organisationId) {
        recordAuditEvent({
          organisationId,
          action: "webhook.signature_failed",
          metadata: { channelType: "sms" },
          ipAddress: req.ip ?? null,
        }).catch((err) =>
          logger.error({ err }, "Failed to record signature_failed audit event")
        );
      }

      res.status(401).json({ error: { code: "INVALID_SIGNATURE" } });
      return;
    }

    // Durable enqueue BEFORE ACK.
    // Return 500 on failure so Twilio retries delivery.
    try {
      // TODO(phase-1-idempotency): add MessageSid dedup check against
      // outbox_jobs payload before enqueuing to prevent duplicate processing
      // on Twilio retries.

      await withSpan(
        "http.ingest",
        {
          "organisation.id": organisationId,
          "channel.type": "sms",
          "message.sid": messageSid,
        },
        async (_span) => {
          await enqueue({
            type: "message.process",
            organisationId,
            channelType: "sms",
            messageSid,
            body: params,
          });

          await recordAuditEvent({
            organisationId,
            action: "webhook.received",
            resourceType: "channel",
            metadata: { channelType: "sms", messageSid },
            ipAddress: req.ip ?? null,
          });
        }
      );
    } catch (err) {
      logger.error(
        { err, organisationId },
        "Webhook ingest failed — returning 500 for Twilio retry"
      );
      res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
      return;
    }

    res.status(200).json({ received: true });
  }
);
