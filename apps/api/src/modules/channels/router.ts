import express, { type Router } from "express";
import { z } from "zod";
import { getDb, recordAuditEvent } from "@ice/core";
import { requireRole } from "../../lib/auth.js";
import { logger } from "../../lib/logger.js";

export const channelRouter: Router = express.Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createChannelBody = z.object({
  agentId: z.string().uuid(),
  type: z.enum(["sms", "web", "voice"]),
  provider: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional().default({}),
});

// ---------------------------------------------------------------------------
// POST /channels — create a channel (org_admin only)
// ---------------------------------------------------------------------------
channelRouter.post("/channels", requireRole("org_admin"), async (req, res) => {
  const parsed = createChannelBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
    return;
  }

  const { agentId, type, provider, config: channelConfig } = parsed.data;
  const db = getDb();

  // Verify agent exists and belongs to this organisation
  const { rows: agentRows } = await db.query<{ id: string }>(
    `SELECT id FROM agents WHERE id = $1 AND organisation_id = $2`,
    [agentId, req.orgId]
  );

  if (agentRows.length === 0) {
    // Cross-org or non-existent → 404 (not 403)
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
    return;
  }

  const { rows } = await db.query<{
    id: string;
    organisation_id: string;
    agent_id: string;
    type: string;
    provider: string;
    config: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO channels (organisation_id, agent_id, type, provider, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.orgId, agentId, type, provider, JSON.stringify(channelConfig)]
  );

  const channel = rows[0]!;

  recordAuditEvent({
    organisationId: req.orgId,
    actorId: req.userId,
    action: "channel.created",
    resourceType: "channel",
    resourceId: channel.id,
    metadata: { type, provider, agentId },
    ipAddress: req.ip ?? null,
  }).catch((err) =>
    logger.error({ err }, "Failed to record channel.created audit event")
  );

  res.status(201).json({ data: channel });
});

// ---------------------------------------------------------------------------
// GET /channels — list channels for this organisation (org_member+)
// ---------------------------------------------------------------------------
channelRouter.get(
  "/channels",
  requireRole("org_member", "org_admin"),
  async (req, res) => {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT * FROM channels WHERE organisation_id = $1 ORDER BY created_at DESC`,
      [req.orgId]
    );

    res.status(200).json({ data: rows });
  }
);
