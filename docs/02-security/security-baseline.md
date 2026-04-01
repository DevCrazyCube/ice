# Security Baseline

## Principles

1. **Tenant isolation is non-negotiable.** No query may return data from a different organization.
2. **Secrets never in source.** No hardcoded credentials, tokens, or keys anywhere in the codebase.
3. **Auditability by design.** Side effects that matter must produce an audit log entry.
4. **Defense in depth.** Security is not only at the API boundary — it is enforced at the data layer.

---

## Tenant Isolation

Every database table that contains business data must have an `organization_id` column.

Every query must filter by `organization_id`. This is enforced at the data layer, not only by API middleware.

```typescript
// Every data access function must accept orgId
async function getConversations(orgId: string, filters: ...) {
  return db.query(
    "SELECT * FROM conversations WHERE organization_id = $1 ...",
    [orgId, ...]
  );
}
```

No "list all" queries without tenant scoping are permitted in production code.

---

## RBAC (Role-Based Access Control)

Planned roles (to be implemented in auth phase):

| Role | Scope | Permissions |
|------|-------|-------------|
| `platform_admin` | Platform | All organizations |
| `org_admin` | Organization | Full access within org |
| `org_member` | Organization | Read + limited write |
| `agent` | System | Internal service calls only |

Permission checks must be explicit and deterministic — no ambient permission from context alone.

---

## Secret Management

- Development: `.env` file (never committed)
- Production: secrets manager (AWS Secrets Manager, Doppler, or equivalent)
- Rotation: all secrets must be rotatable without code deployment

Never log secrets. Never return secrets in API responses.

---

## Webhook Security

All inbound webhooks must:
1. Verify the request signature before processing
2. Use HMAC-SHA256 with a per-tenant or per-integration secret
3. Reject requests with missing or invalid signatures with `401`
4. Be idempotent — duplicate delivery must not cause duplicate effects

```typescript
// Future implementation pattern
function verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## Audit Logging

Every side effect that affects business data must produce an audit log entry including:

- `organization_id`
- `actor_id` (user or system)
- `action` (e.g., `conversation.created`)
- `resource_id`
- `timestamp`
- `ip_address` (for human-initiated actions)

Audit logs must be append-only. No audit log entry may be deleted or mutated.

---

## PII-Conscious Logging

- Never log raw conversation content at INFO or above
- Never log user-provided input at INFO or above without explicit sanitization
- Use structured logging (pino) — no string interpolation of sensitive values
- Log `conversation_id` instead of conversation content

---

## Input Validation

All external inputs (HTTP bodies, query params, webhook payloads) must be validated with Zod schemas before use. Reject invalid input at the boundary — do not propagate unvalidated data into service layers.

---

## Dependency Security

- Keep dependencies minimal and well-maintained
- Run `pnpm audit` before releases
- Do not add dependencies for single utility functions (use stdlib or write inline)
