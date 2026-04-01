# CLAUDE.md — ICE Platform Operating Contract

Every Claude session working in this repo must read this document in full before writing any code.
This is not a style guide. It is a hard operating contract.

---

## 0. Start Every Session Here

Before any implementation work:

1. Read `docs/07-roadmap/current-phase.md` — know which phase is active and what is in scope
2. Read `docs/07-roadmap/non-goals.md` — know what you are not allowed to build
3. Identify which phase the requested work belongs to
4. If the work is in a future phase, refuse and say which phase it belongs to
5. Read the task-relevant docs for the area being changed (mandatory, not advisory):
   - Architecture work → `docs/01-architecture/system-overview.md`
   - Backend / domain work → `docs/03-backend/domain-model.md` and `docs/03-backend/api-contracts.md`
   - Security / auth / webhooks → `docs/02-security/security-baseline.md`
   - Frontend / control-plane work → `docs/04-frontend/frontend-architecture.md`
   - Agent / runtime work → `docs/05-agents/agents-overview.md`
6. Confirm that task-relevant schemas in `packages/schemas/` match the docs you just read

**If you skip step 1, 2, or 5, you are operating out of contract.**

---

## 1. What ICE Is

ICE is a **multi-tenant agent platform** for businesses that need to automate conversations.

It has exactly **two products**:

1. **Acquisition Agent** — qualifies new leads, educates on the product, makes a timed offer, triggers checkout/provisioning with explicit user consent.
2. **Client Inbound Agent** — handles inbound conversations for client businesses using configured knowledge and policy; answers, qualifies, routes, or escalates safely.

**Single-agent runs only.** One conversation is handled by one agent. No swarms, no multi-agent coordination.

---

## 2. What ICE Is NOT

- Not a generic agent framework
- Not a workflow / orchestration builder
- Not a canvas or drag-and-drop UI
- Not a CRM replacement
- Not a multi-agent playground
- Not an AI sandbox or experimentation platform
- Not a streaming pipeline system

If a request would add any of the above, stop and ask before proceeding.

---

## 3. The Four Phases (PDF-Defined, Non-Negotiable)

Do not invent phases. Do not rename phases. The delivery plan has exactly four phases:

| # | Name | Core Deliverables |
|---|------|-------------------|
| 1 | **Foundations** | Tenancy + auth + audit + webhook ingest + outbox/queue + worker skeleton + OTel |
| 2 | **Agent capabilities** | Runtime loop + tool gateway + pgvector/RAG + guardrails + eval harness |
| 3 | **Revenue-ready acquisition** | Conversation state machine + Stripe + Twilio + idempotent provisioning |
| 4 | **Scaling / Agent OS** | Dashboard v1 + policy-as-config + quotas + approvals + SLOs |

**Current active phase: read `docs/07-roadmap/current-phase.md`.**

All new work must declare which phase it belongs to. Code for a future phase must not be implemented until that phase is active. Document the phase boundary in the commit message.

---

## 4. Core Architecture (Non-Negotiable)

### 4a. Control Plane vs Data Plane

ICE separates two planes:

**Data plane** — handles the message processing pipeline:
```
Channel webhook → Ingest API (fast ACK) → Postgres outbox → Worker → Tool Gateway → Outbound sender
```

**Control plane** — handles configuration, policy, and observability:
```
Dashboard → Admin API → Policy/Config store → Audit log
```

Never mix control plane and data plane logic in the same module. Webhook ingest is data plane. Agent config CRUD is control plane.

### 4b. Async First for Webhook Processing

Inbound channel messages are **always processed asynchronously**:
1. Webhook arrives → verify signature → fast ACK (`200 OK`) → persist to Postgres → enqueue job ref
2. Worker picks up job → loads conversation + policy → processes → sends outbound reply

Never make an LLM call synchronously in a webhook handler. This is a cost, reliability, and DoS-protection requirement.

### 4c. Postgres Outbox Pattern (Phase 1)

Phase 1 uses a **Postgres outbox table** as the job queue — no separate queue service required. Workers poll the outbox. Optional Redis is introduced only for rate-limiting and idempotency key storage.

Do not introduce BullMQ, Redis queues, Kafka, or any streaming bus until there is an explicit architectural justification in a later phase.

### 4d. Dependency-Light Defaults

| Concern | Default | When to upgrade |
|---------|---------|-----------------|
| Primary datastore | Postgres | Never remove |
| Vectors | pgvector (in Postgres) | Scale phase only |
| Queue | Postgres outbox | Phase 2+ if needed |
| Rate limiting / idempotency | Optional Redis | When load demands it |
| Messaging | Twilio (one provider) | Phase 1 |
| Billing | Stripe (one provider) | Phase 3 |
| Managed vector DB | None | Phase 4+ only |

---

## 5. Stack (Non-Negotiable)

| Layer | Choice |
|-------|--------|
| Package manager | pnpm |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 14 + TypeScript |
| Backend | Node.js + TypeScript + Express |
| Logging | pino (structured, never `console.log`) |
| Validation | zod (all external inputs) |
| Tracing | OpenTelemetry + OTLP (Phase 1) |
| DB | Postgres |
| Queue (Phase 1) | Postgres outbox pattern |
| Auth | OIDC + JWT (Phase 1) |

Do NOT introduce NestJS, Kafka, Kubernetes, BullMQ, event-sourcing frameworks, or workflow engines without a written architectural decision record.

---

## 6. Folder Ownership

| Path | Plane | Purpose |
|------|-------|---------|
| `apps/api/src/routes/` | Both | HTTP route handlers |
| `apps/api/src/modules/` | Both | Domain modules (one folder per domain) |
| `apps/api/src/lib/` | Both | Cross-cutting infra (logger, config, tracing) |
| `apps/web/src/app/` | Control | Next.js App Router pages |
| `packages/core/` | Both | DB, queue, telemetry, security primitives |
| `packages/schemas/` | Both | Zod schemas, TS types, machine-readable contracts |
| `packages/config/` | Both | Shared config helpers |
| `packages/agents/` | Data | Agent runtime (Phase 2+) |
| `docs/` | — | Architecture and operational documentation |
| `.claude/` | — | Operating rules, skills, commands |

---

## 7. Security Rules (Enforced at All Times)

- **Tenant isolation**: every DB query on business data must filter by `organisation_id`. No exceptions. Enforced at the repository layer, not just middleware.
- **Webhook security**: all inbound webhooks must verify signatures before processing. Preserve raw request body — do not parse JSON before signature verification (Stripe breaks otherwise).
- **Secrets**: never in source. `.env` locally, secrets manager in production.
- **Audit logging**: all security-sensitive actions (login, role change, tool approval, channel binding, billing event) must produce an audit log entry. Audit logs are append-only.
- **PII**: never log conversation content at INFO or above. Log IDs, not content.
- **OIDC/JWT**: validate issuer, audience, and signature. Rotate via JWKS. Follow RFC 9700 (OAuth security BCP).
- **Prompt injection**: never interpolate raw user input or retrieved text directly into agent instructions without structural separation.
- **Output validation**: all LLM outputs must be schema-validated before use. Reject or repair invalid outputs.

Security standards: NIST SP 800-53 Rev.5, SP 800-207 (zero trust), SP 800-61 Rev.3 (incident response), SP 800-218 (SSDF), OWASP API Top 10 (2023), OWASP LLM Top 10.

---

## 8. Hard Rules for Every Session

1. **Declare the phase.** Before writing code, state which phase it belongs to.
2. **Block future-phase work.** If the request belongs to Phase 2/3/4 and Phase 1 is active, refuse.
3. **Read current-phase.md first.** Every session, without exception.
4. **One way to do each thing.** One logger, one config loader, one queue implementation, one boot path.
5. **Delete replaced code.** If new code replaces old code, delete the old code. No `legacy/` folders.
6. **Docs first, then code.** If a feature lacks a doc or schema contract, write that first.
7. **No speculative code.** Do not write code that is not called by the current phase's features.
8. **No `console.log`.** Use the structured pino logger.
9. **No `any` types** without explicit justification in a comment.
10. **No utils/ dumping grounds.** Shared helpers live in the package/module that owns them.

---

## 9. Anti-Patterns (Blocked)

- Generic "agents engine" or "agent framework"
- Workflow / orchestration engine
- Canvas or drag-and-drop builder
- Multiple queue implementations
- Multiple config loaders
- `utils/` folders with miscellaneous helpers
- `legacy/` or `deprecated/` folders
- Synchronous LLM calls in webhook handlers
- Querying business data without `organisation_id`
- Committing `.env` files or secrets
- Skipping signature verification on webhooks
- Processing webhooks before verifying signatures
- Making irreversible side effects (billing, provisioning) without explicit user consent

---

## 10. Asking for Clarification

If a task is ambiguous, out of scope for the current phase, or would require an architectural decision not covered here, ask before proceeding. ICE is intentionally narrow.
