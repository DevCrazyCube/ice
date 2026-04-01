# Skill: Audit Logging

## Status: Not Implemented (Foundation Phase)

The audit log table and helpers will be implemented in the data phase.

## What Requires an Audit Log Entry

Any action that:
- Creates, modifies, or deletes a business record
- Changes permissions or roles
- Accesses sensitive data (e.g., exports)
- Triggers an external side effect (webhook sent, message sent)

## Planned Schema

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_id        UUID,          -- null for system-initiated actions
  action          TEXT NOT NULL, -- e.g., "conversation.created"
  resource_id     UUID,
  resource_type   TEXT,
  metadata        JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Planned Usage

```typescript
await auditLog.record({
  organizationId: orgId,
  actorId: req.userId,
  action: "conversation.created",
  resourceId: conversation.id,
  resourceType: "conversation",
  ipAddress: req.ip,
});
```

## Rules

- Audit logs are **append-only** — no UPDATE or DELETE on audit_logs
- Never log PII (names, emails, message content) in the `metadata` field
- Log `resource_id` references, not copies of the resource
- Audit logging must not block the main operation — use fire-and-forget or enqueue
- Failures in audit logging should be logged as errors but must not fail the request
