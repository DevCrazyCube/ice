import { getDb } from "../db/index.js";

export interface AuditEventInput {
  /** Organisation the event belongs to */
  organisationId: string;
  /** User who performed the action. Null for system-initiated actions. */
  actorId?: string | null;
  /**
   * Machine-readable action code.
   * Phase 1 required: user.login, user.logout, user.created, role.assigned,
   * role.revoked, org.created, agent.created, agent.status_changed,
   * channel.created, channel.deleted, webhook.received, webhook.signature_failed
   */
  action: string;
  /** UUID of the primary resource affected */
  resourceId?: string | null;
  /** Type of the primary resource, e.g. "conversation", "agent" */
  resourceType?: string | null;
  /** Non-PII metadata. Log IDs, not content. */
  metadata?: Record<string, unknown>;
  /** Source IP address */
  ipAddress?: string | null;
}

/**
 * Append a new audit event. audit_events is INSERT-only — never UPDATE or DELETE.
 *
 * Fire-and-forget safe: errors are thrown and must be handled by the caller.
 * The caller should log the error but must NOT fail the request on audit failure.
 */
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO audit_events
       (organisation_id, actor_id, action, resource_id, resource_type, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.organisationId,
      event.actorId ?? null,
      event.action,
      event.resourceId ?? null,
      event.resourceType ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.ipAddress ?? null,
    ]
  );
}
