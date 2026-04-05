/**
 * BusinessContext CRUD — control-plane API for managing per-agent
 * business context entries.
 *
 * Phase 2: manual entry only (source = "manual"). Org-scoped, auth-protected.
 *
 * Routes:
 *   GET    /agents/:agentId/context            — list entries for agent
 *   POST   /agents/:agentId/context            — create entry
 *   PATCH  /agents/:agentId/context/:contextId — update entry
 *   DELETE /agents/:agentId/context/:contextId — soft-delete (set active = false)
 */

import express, { type Router, type Request, type Response } from "express";
import { z } from "zod";
import { getDb, recordAuditEvent } from "@ice/core";
import { createBusinessContextSchema, updateBusinessContextSchema } from "@ice/schemas";
import { requireRole } from "../../lib/auth.js";
import { logger } from "../../lib/logger.js";

export const businessContextRouter: Router = express.Router();

// ---------------------------------------------------------------------------
// Param validation
// ---------------------------------------------------------------------------

const uuidParam = z.string().uuid();

// ---------------------------------------------------------------------------
// Helper: verify agent belongs to the authenticated org
// ---------------------------------------------------------------------------

async function verifyAgentOwnership(
  agentId: string,
  orgId: string
): Promise<boolean> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM agents WHERE id = $1 AND organisation_id = $2`,
    [agentId, orgId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// GET /agents/:agentId/context — list entries (org_member+)
// ---------------------------------------------------------------------------

businessContextRouter.get(
  "/agents/:agentId/context",
  requireRole("org_member", "org_admin"),
  async (req: Request, res: Response) => {
    const agentIdResult = uuidParam.safeParse(req.params["agentId"]);
    if (!agentIdResult.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid agentId format" },
      });
      return;
    }
    const agentId = agentIdResult.data;

    // Verify agent belongs to this org (cross-org → 404)
    if (!(await verifyAgentOwnership(agentId, req.orgId))) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }

    const db = getDb();

    // Optional query params for filtering
    const activeOnly = req.query["active"] === "true";
    const category = req.query["category"] as string | undefined;

    let query = `
      SELECT id, organisation_id, agent_id, category, title, content,
             sort_order, active, source, reviewed_at, created_at, updated_at
      FROM business_context
      WHERE organisation_id = $1 AND agent_id = $2
    `;
    const params: unknown[] = [req.orgId, agentId];

    if (activeOnly) {
      query += ` AND active = true`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY category, sort_order ASC, created_at ASC`;

    const { rows } = await db.query(query, params);

    res.status(200).json({
      data: rows.map(mapRow),
    });
  }
);

// ---------------------------------------------------------------------------
// POST /agents/:agentId/context — create entry (org_admin only)
// ---------------------------------------------------------------------------

businessContextRouter.post(
  "/agents/:agentId/context",
  requireRole("org_admin"),
  async (req: Request, res: Response) => {
    const agentIdResult = uuidParam.safeParse(req.params["agentId"]);
    if (!agentIdResult.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid agentId format" },
      });
      return;
    }
    const agentId = agentIdResult.data;

    // Validate request body
    const parsed = createBusinessContextSchema.safeParse({
      ...req.body,
      agentId, // agentId comes from the URL path, not the body
    });
    if (!parsed.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      });
      return;
    }

    const { category, title, content, sortOrder, active } = parsed.data;

    // Verify agent belongs to this org
    if (!(await verifyAgentOwnership(agentId, req.orgId))) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }

    const db = getDb();

    const { rows } = await db.query<BusinessContextRow>(
      `INSERT INTO business_context
         (organisation_id, agent_id, category, title, content, sort_order, active, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
       RETURNING *`,
      [req.orgId, agentId, category, title, content, sortOrder, active]
    );

    const entry = rows[0]!;

    recordAuditEvent({
      organisationId: req.orgId,
      actorId: req.userId,
      action: "context.created",
      resourceType: "business_context",
      resourceId: entry.id,
      metadata: { agentId, category },
      ipAddress: req.ip ?? null,
    }).catch((err) =>
      logger.error({ err }, "Failed to record context.created audit event")
    );

    res.status(201).json({ data: mapRow(entry) });
  }
);

// ---------------------------------------------------------------------------
// PATCH /agents/:agentId/context/:contextId — update entry (org_admin only)
// ---------------------------------------------------------------------------

businessContextRouter.patch(
  "/agents/:agentId/context/:contextId",
  requireRole("org_admin"),
  async (req: Request, res: Response) => {
    const agentIdResult = uuidParam.safeParse(req.params["agentId"]);
    const contextIdResult = uuidParam.safeParse(req.params["contextId"]);
    if (!agentIdResult.success || !contextIdResult.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid UUID format" },
      });
      return;
    }
    const agentId = agentIdResult.data;
    const contextId = contextIdResult.data;

    // Validate request body
    const parsed = updateBusinessContextSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      });
      return;
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "No fields to update" },
      });
      return;
    }

    // Build dynamic SET clause from validated fields
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      params.push(updates.category);
    }
    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      params.push(updates.content);
    }
    if (updates.sortOrder !== undefined) {
      setClauses.push(`sort_order = $${paramIndex++}`);
      params.push(updates.sortOrder);
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramIndex++}`);
      params.push(updates.active);
    }

    // Always update updated_at
    setClauses.push(`updated_at = now()`);

    // Tenant-isolated update: filter by org + agent + id
    params.push(contextId);   // $N
    params.push(agentId);     // $N+1
    params.push(req.orgId);   // $N+2

    const query = `
      UPDATE business_context
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex++}
        AND agent_id = $${paramIndex++}
        AND organisation_id = $${paramIndex++}
      RETURNING *
    `;

    const db = getDb();
    const { rows } = await db.query<BusinessContextRow>(query, params);

    if (rows.length === 0) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Context entry not found" },
      });
      return;
    }

    const entry = rows[0]!;

    recordAuditEvent({
      organisationId: req.orgId,
      actorId: req.userId,
      action: "context.updated",
      resourceType: "business_context",
      resourceId: entry.id,
      metadata: { agentId, updatedFields: Object.keys(updates) },
      ipAddress: req.ip ?? null,
    }).catch((err) =>
      logger.error({ err }, "Failed to record context.updated audit event")
    );

    res.status(200).json({ data: mapRow(entry) });
  }
);

// ---------------------------------------------------------------------------
// DELETE /agents/:agentId/context/:contextId — soft delete (org_admin only)
//
// Sets active = false rather than removing the row. This preserves the
// audit trail and allows reactivation via PATCH.
// ---------------------------------------------------------------------------

businessContextRouter.delete(
  "/agents/:agentId/context/:contextId",
  requireRole("org_admin"),
  async (req: Request, res: Response) => {
    const agentIdResult = uuidParam.safeParse(req.params["agentId"]);
    const contextIdResult = uuidParam.safeParse(req.params["contextId"]);
    if (!agentIdResult.success || !contextIdResult.success) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid UUID format" },
      });
      return;
    }
    const agentId = agentIdResult.data;
    const contextId = contextIdResult.data;

    const db = getDb();
    const { rows } = await db.query<BusinessContextRow>(
      `UPDATE business_context
       SET active = false, updated_at = now()
       WHERE id = $1 AND agent_id = $2 AND organisation_id = $3
       RETURNING *`,
      [contextId, agentId, req.orgId]
    );

    if (rows.length === 0) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Context entry not found" },
      });
      return;
    }

    const entry = rows[0]!;

    recordAuditEvent({
      organisationId: req.orgId,
      actorId: req.userId,
      action: "context.deactivated",
      resourceType: "business_context",
      resourceId: entry.id,
      metadata: { agentId },
      ipAddress: req.ip ?? null,
    }).catch((err) =>
      logger.error({ err }, "Failed to record context.deactivated audit event")
    );

    res.status(200).json({ data: mapRow(entry) });
  }
);

// ---------------------------------------------------------------------------
// Row mapper — snake_case DB row → camelCase API response
// ---------------------------------------------------------------------------

interface BusinessContextRow {
  id: string;
  organisation_id: string;
  agent_id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  active: boolean;
  source: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: BusinessContextRow) {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    agentId: row.agent_id,
    category: row.category,
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    active: row.active,
    source: row.source,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
