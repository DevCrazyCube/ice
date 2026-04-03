# Security Baseline

This baseline applies from Phase 1 onward. Security is not a future concern — it is a Day 1 requirement.

Primary standards: **NIST SP 800-53 Rev.5** (controls), **NIST SP 800-207** (zero trust), **NIST SP 800-61 Rev.3** (incident response), **NIST SP 800-218 SSDF** (secure SDLC), **OWASP API Security Top 10 (2023)**, **OWASP LLM Top 10**.

---

## 1. Tenant Isolation

**Every database query that touches business data must filter by `organisation_id`.**

Enforced at the repository layer — not just API middleware. No ambient tenant from request context is sufficient; the repository function must accept and apply `organisation_id` explicitly.

```typescript
// Correct
async function getConversations(orgId: string) {
  return db.query(
    "SELECT * FROM conversations WHERE organisation_id = $1",
    [orgId]
  );
}

// Never
async function getConversations() {
  return db.query("SELECT * FROM conversations"); // cross-tenant leak
}
```

Return `404 NOT_FOUND` when a resource exists but belongs to a different organisation. Never `403` — that leaks existence information.

---

## 2. Identity and Access Management

- **OIDC** for human login (dashboard) — industry standard identity layer on OAuth 2.0
- **OAuth 2.0** (RFC 6749) for delegated access
- **RFC 9700** (OAuth security best current practice) — deprecates insecure implicit flow; must be followed
- **JWT validation** (RFC 7519): verify issuer, audience, and signature; rotate via JWKS endpoint

JWT payload must include: `sub` (user ID), `org` (organisation ID), `roles` (array).

```typescript
// Pattern: jose library for JWT verification
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URL!));

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: process.env.OIDC_ISSUER,
      audience: process.env.OIDC_AUDIENCE,
    });
    req.orgId = payload.org as string;
    req.userId = payload.sub as string;
    req.roles = (payload.roles as string[]) ?? [];
    next();
  } catch {
    res.status(401).json({ error: { code: "INVALID_TOKEN" } });
  }
}
```

---

## 3. RBAC

Permission checks are deterministic and explicit — not derived from ambient context.

| Role | Scope | Access |
|------|-------|--------|
| `platform_admin` | Platform | All organisations (internal ICE staff only) |
| `org_admin` | Organisation | Full access within org |
| `org_member` | Organisation | Read + limited write |

RBAC enforcement: middleware checks the role claim from JWT; service layer additionally checks on sensitive operations.

---

## 4. Webhook Security

All inbound webhooks must:
1. Preserve the **raw request body** — do not parse JSON before signature verification. Express `body-parser` must be applied **after** the raw body buffer is captured. (Stripe explicitly documents that body mutation breaks `constructEvent`.)
2. **Verify the signature** before any processing
3. Return `401` for missing or invalid signatures
4. Be **idempotent** — store the provider's delivery ID; reject duplicates with `200` (not `400` — prevents retry loops)

### Twilio
```typescript
import { validateRequest } from "twilio";

function verifyTwilio(req): boolean {
  return validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    req.headers["x-twilio-signature"] as string,
    process.env.PUBLIC_WEBHOOK_URL!,
    req.body
  );
}
```

### Stripe
```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function verifyStripe(rawBody: Buffer, sig: string): Stripe.Event {
  // rawBody must be the unparsed Buffer — use express.raw() on this route
  return stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
```

### Idempotency Pattern
```typescript
// Store delivery ID before processing
const existing = await webhookRepo.findDelivery(orgId, deliveryId);
if (existing) return res.status(200).json({ status: "duplicate" });
await webhookRepo.storeDelivery(orgId, deliveryId);
// Now safe to process
```

---

## 5. Rate Limiting and Cost Controls

Rate limiting is a Phase 1 requirement per OWASP API Security (API4: Unrestricted Resource Consumption), which explicitly includes costs paid per API request (SMS, LLM tokens).

- Per-tenant inbound rate limit on all webhook endpoints
- Per-tenant concurrent run caps (Phase 2+)
- Per-tenant token budgets per run and per day (Phase 2+)

Phase 1: use Redis token counter or in-memory for webhook rate limiting. Use `Retry-After` header on `429` responses.

---

## 6. Audit Logging

Security-sensitive actions that **must** produce an audit event in Phase 1:

- `user.login` / `user.logout`
- `user.created`, `role.assigned`, `role.revoked`
- `org.created`
- `agent.created`, `agent.status_changed`
- `channel.created`, `channel.deleted`
- `webhook.received` (delivery ID, org, result)
- `webhook.signature_failed` (provider, ip_address)

Audit log table (`audit_events`) is append-only. No UPDATE or DELETE on audit records. Ever.

Do not log PII in `metadata`. Log resource IDs and action codes, not content.

---

## 7. PII-Conscious Logging

- Never log conversation content at INFO or above
- Never log user-provided input at INFO or above without explicit sanitisation
- Log `conversation_id` references, not message content
- Use structured pino logging — no string interpolation of sensitive values

---

## 8. LLM Safety Baseline (Phase 2+)

Documented here for architectural awareness. Implement when Phase 2 begins.

Controls mapped to OWASP LLM Top 10:

| OWASP LLM Risk | Control |
|----------------|---------|
| LLM01 Prompt injection | Structural separation of policy instructions vs. user content; never interpolate raw input into SYSTEM role |
| LLM02 Insecure output handling | JSON schema validation on all LLM outputs before use; reject/repair invalid outputs |
| LLM04 Model DoS | Per-tenant token budgets; per-run token caps; queue backpressure |
| LLM06 Excessive agency | Tool allowlist; default-deny; high-sensitivity tools require explicit consent or approval gate |
| LLM08 Excessive permissions | Principle of least privilege on tool specs; `requireApprovalForHighSensitivityTools: true` in TenantPolicy for sensitive tools (Phase 4 enforcement) |

---

## 8a. Business Context Ingestion Security (Phase 2+)

ICE agents derive business-specific behavior from **business context** — structured data about the business (profile, services, FAQ, tone, policies). In later phases, this context may be ingested from external sources (websites, documents, social profiles). All ingested content is **untrusted input** regardless of source.

### Trust Boundaries

| Context Source | Trust Level | Required Controls |
|---------------|-------------|-------------------|
| Org admin manual entry (dashboard forms) | Semi-trusted | Zod validation, length limits, sanitisation |
| Website scrape (Phase 3+) | Untrusted | Validation, sanitisation, size bounds, human review before activation |
| Document upload (Phase 3+) | Untrusted | Validation, sanitisation, size bounds, human review before activation |
| Social profile import (Phase 4+) | Untrusted | Validation, sanitisation, size bounds, human review before activation |

### Security Requirements for All Business Context

1. **Structural separation from system instructions.** Business context is injected into the DEVELOPER layer of the prompt, never into the SYSTEM layer. Safety rules and core behavior remain in SYSTEM, isolated from context that could contain adversarial content.

2. **Validation and sanitisation.** All business context — whether entered manually or ingested — must pass through Zod schema validation. Content must be bounded (max lengths), stripped of executable content (scripts, HTML), and checked for obvious injection patterns.

3. **Size limits.** Per-tenant limits on total context volume. Prevents resource exhaustion and prompt stuffing.

4. **Human review gate for automated ingestion.** Content ingested from websites, documents, or social profiles must be staged for org admin review before it becomes active context. No scraped content enters the live prompt without explicit approval.

5. **Audit trail.** All business context changes (create, update, delete, approve) must produce audit events. Source of ingestion recorded.

6. **No executable content.** Business context is treated as data, never as instructions. The engine reads context to understand what the business does — it does not execute arbitrary instructions found in context.

7. **Tenant isolation.** Business context is scoped to `organisation_id`. No cross-tenant context access. Context retrieval (pgvector, Phase 4+) must enforce tenant boundaries in every query.

---

## 9. Secret Management

- Development: `.env` file (never committed)
- Production: secrets manager (AWS Secrets Manager, Doppler, or equivalent)
- All secrets must be rotatable without code deployment
- Never log secrets; never return secrets in API responses
- Webhook signing secrets are per-integration (not shared across tenants)

---

## 10. Incident Response

Aligned to **NIST SP 800-61 Rev.3** (final 2025) lifecycle integrated with risk management:
1. Preparation — runbooks, alerting, access procedures
2. Detection and analysis — OTel metrics, audit log review
3. Containment, eradication, recovery — documented per threat class
4. Post-incident activity — written retrospective

Incident response runbooks are not required in Phase 1 but the audit and OTel foundations that enable detection are.

---

## 11. Secure SDLC

Following **NIST SP 800-218 SSDF**:
- Security requirements defined before implementation (this document)
- Dependency scanning (`pnpm audit`) before releases
- No secrets in source control (enforced by `.gitignore`)
- Input validation at all system boundaries (Zod schemas)
- Code review for security-sensitive paths (auth, webhook handlers, data access)
