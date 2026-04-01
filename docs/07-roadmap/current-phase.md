# Current Phase: 1 — Foundations

## Phase Goal

Establish a secure, multi-tenant base with authentication, authorisation, webhook safety, queue/outbox processing, audit logging, and tracing. All subsequent phases build on this baseline.

**Phase 1 is not complete until all deliverables below are implemented and tested.**

The structural monorepo skeleton (apps, packages, docs) is done. The runtime work below is still in progress.

---

## Phase 1 Deliverables

### Done (structural skeleton)
- [x] pnpm monorepo workspace
- [x] Root config (package.json, tsconfig.base.json, .editorconfig, .env.example)
- [x] CLAUDE.md operating contract
- [x] apps/api skeleton (Express, health endpoint, config, logger)
- [x] apps/web skeleton (Next.js 14, homepage, dashboard placeholder)
- [x] packages/core placeholder
- [x] packages/schemas (Zod schemas, AgentSpec v1, ToolSpec v1, TenantPolicy v1 contracts)
- [x] packages/config, packages/agents placeholders
- [x] docs/ (all architecture, security, roadmap docs)
- [x] .claude/ (skills and commands)

### Not Yet Done (Phase 1 runtime work)
- [ ] Multi-tenant data model + Postgres schema + migrations
- [ ] OIDC login for dashboard (OAuth 2.0 / RFC 9700)
- [ ] RBAC: roles, user_roles, permission checks
- [ ] Webhook ingest endpoint with signature verification (Twilio `X-Twilio-Signature`)
- [ ] Rate limiting on all public ingest endpoints
- [ ] Postgres outbox table + worker polling skeleton
- [ ] Audit log baseline (login, role change, channel binding)
- [ ] OpenTelemetry tracing baseline (OTLP export, core semantic attributes)

---

## Phase 1 User Journeys (Target)

1. Client admin signs in (OIDC), creates organisation, creates agent stub, binds a channel
2. Inbound message arrives via webhook → verified → stored → enqueued → processed asynchronously

---

## Phase 1 In Scope

Everything in the deliverables list above and:
- Webhook ingest for one initial channel (SMS/WhatsApp **or** web chat — pick one to launch)
- Fast-ACK pattern: webhook handler returns `200 OK` before any processing
- Postgres outbox as the Phase 1 queue (no Redis queue in this phase)
- Optional Redis for rate-limiting and idempotency key storage only
- Audit events for: login, logout, org create, agent create, channel bind, webhook received
- OpenTelemetry spans: `http.ingest`, `outbox.enqueue`, `worker.process`

---

## Phase 1 Out of Scope

Do not implement any of the following until the phase changes:

- LLM API calls of any kind
- Agent runtime loop (knowledge retrieval, tool gateway, guardrails)
- pgvector / RAG / retrieval
- Billing or Stripe integration
- Stripe webhook processing
- Production dashboard business features (analytics, funnel, approvals)
- Conversation state machine
- Offer / checkout logic
- SLO definitions or alerting infrastructure

---

## Phase 1 Complete When

- Cross-tenant access attempt → 404 (not 403, not data leak)
- Webhook with invalid signature → 401
- Webhook with duplicate delivery ID → 200 (idempotent no-op)
- Worker processes a job idempotently
- Audit events written for all security-sensitive actions
- OTel trace spans emitted for ingest → worker flow

---

## Next: Phase 2 — Agent Capabilities

Begins only after Phase 1 completion criteria above are met.

Phase 2 delivers: agent runtime loop (input → plan → tool calls → output), tool gateway with strict schemas/allowlists, knowledge base (pgvector), guardrails (input screening, output validation, redaction), evaluation harness.

**Do not start Phase 2 work without updating this file.**
