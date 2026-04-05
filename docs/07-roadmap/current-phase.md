# Current Phase: 2 — Agent Capabilities

## Active Phase Goal

Deliver **environment-aware agents** with business context as the core differentiator. The shared engine adapts to any business through structured business context — no niche templates, no per-industry prompt libraries.

**Phase 2 starting point:** manual structured business context entered by org admins, consumed by the inbound agent runtime at message processing time.

---

## Phase 2 Deliverables

### Done (Phase 2 initial runtime slice)
- [x] BusinessContext v1 Zod schema (`packages/schemas/src/business-context.ts`)
- [x] DB migration 008: `business_context` table with org/agent scoping, category, source tracking
- [x] Runtime contracts: `RuntimeInput`, `RuntimeContext`, `RuntimeDecision`, `RuntimeOutput` (`packages/agents/src/shared/`)
- [x] Three-layer prompt assembly: SYSTEM (core behaviour) + DEVELOPER (business context) + CHANNEL (formatting rules)
- [x] Inbound agent engine (`packages/agents/src/inbound/`) — stub-first default, optional hosted LLM
- [x] Worker `message.process` upgraded: load agent → Zod-validate spec → load business context → run engine → audit
- [x] Runtime observability: `engine`, `contextEntryCount`, `channelFormatted` on every RuntimeOutput
- [x] Environment-aware behaviour proven (8 tests + 4-scenario env-aware proof)

### Done (Phase 2 control-plane slice)
- [x] BusinessContext CRUD API (`/api/v1/agents/:agentId/context`) — GET/POST/PATCH/DELETE
- [x] Org-scoped, auth-protected, role-enforced (org_admin for writes, org_member+ for reads)
- [x] Zod validation on all request bodies; cross-org → 404
- [x] Soft-delete via DELETE (sets active=false); reactivation via PATCH
- [x] Audit events for context.created, context.updated, context.deactivated
- [x] Query filters: `?active=true`, `?category=<cat>`
- [x] 10-scenario CRUD validation script (`prove:crud`)

### Not Yet Done (remaining Phase 2 work)
- [ ] Real LLM integration testing (hosted Claude path validated end-to-end with API key)
- [ ] Output validation (schema + policy enforcement on LLM responses)
- [ ] Tool gateway — schema-validated tool execution with strict allowlists
- [ ] Guardrails — input screening (prompt injection defense), content policy enforcement
- [ ] Evaluation harness — automated quality checks against business context grounding
- [ ] Dashboard forms for org admins to enter business context

---

## Phase 2 In Scope

- **Structured manual BusinessContext** — typed, categorized entries (Identity / Operations / Intent & Style)
- Three-layer prompt architecture (SYSTEM / DEVELOPER / CHANNEL)
- Inbound agent runtime loop through the outbox worker
- BusinessContext CRUD for org admins (dashboard forms)
- LLM API integration (single provider)
- Output validation and guardrails
- Tool gateway with strict allowlists
- Audit events for agent processing, context changes
- Clean separation: BusinessContext (business environment) vs AgentSpec (runtime policy)

## Phase 2 Out of Scope

- Automated context ingestion (website scraping, document processing) — Phase 3+
- pgvector / RAG / retrieval — Phase 4+
- Per-industry prompt templates or niche-specific roles — never
- Unstructured context blob — entries must be typed and categorized
- Org-level base context with agent-level override (Phase 3+ when multi-agent orgs are common)
- Acquisition mode state machine — Phase 3
- Stripe billing — Phase 3
- Conversation state machine — Phase 3

**Phase 2 sequence: manual structured context → runtime uses it → validate the architecture. Scraping, ingestion, and RAG come later.**

---

# Phase 1 — Foundations (COMPLETED)

Phase 1 established the secure, multi-tenant base. All deliverables below are implemented and tested.

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

### Done (Phase 1 runtime skeleton)
- [x] Multi-tenant data model + Postgres schema + migrations (001–006)
- [x] Postgres DB client (pg Pool singleton, initDb/getDb/closeDb)
- [x] Migration runner (schema_migrations tracking, lexicographic order, transactional)
- [x] Postgres outbox table + enqueue() with OTel trace context injection
- [x] Worker polling skeleton (FOR UPDATE SKIP LOCKED, 3-attempt retry, OTel span)
- [x] Twilio SMS webhook ingest skeleton (signature verify → durable enqueue → audit → 200 ACK)
- [x] Audit event writer (INSERT-only, recordAuditEvent)
- [x] OpenTelemetry bootstrap (NodeSDK + withSpan/startSpan/extractTraceContext helpers)
- [x] JWT auth middleware (jose, requireAuth — OIDC not yet wired end-to-end)

### Done (Phase 1 reliability slice)
- [x] Channel-to-org DB lookup in webhook handler (route: `/webhooks/inbound/:channelId`)
- [x] MessageSid idempotency dedup via delivery_id column + ON CONFLICT DO NOTHING
- [x] Stale processing job recovery (5-minute timeout, periodic sweep in worker)
- [x] CAS on attempts for post-processing status updates (prevents recovery race)

### Done (Phase 1 auth / RBAC / rate-limiting slice)
- [x] OIDC login for dashboard (OAuth 2.0 / RFC 9700) — end-to-end flow (BFF pattern, PKCE, session JWT in HttpOnly cookie)
- [x] RBAC: `requireAuth` + `requireRole()` middleware enforced on protected routes; `platform_admin` bypass; tenant isolation via `req.orgId` scoping
- [x] Rate limiting on public ingest endpoints — in-memory fixed-window per-org (60 req/min), 429 + Retry-After header. ⚠️ Single-instance only, not distributed.
- [x] Audit events wired for `user.login`, `user.logout`, `channel.created`
- [x] Minimal channel CRUD (`POST /api/v1/channels` org_admin, `GET /api/v1/channels` org_member+) — org-scoped, cross-org = 404

### Not Yet Done (remaining Phase 1 runtime work)
- [ ] Audit log for role change events (requires user/role management routes — Phase 2+)

---

## Phase 1 User Journeys (Target)

1. Client admin signs in (OIDC), creates organisation, creates agent stub, binds a channel
2. Inbound message arrives via webhook → verified → stored → enqueued → processed asynchronously

---

## Phase 1 In Scope

Everything in the deliverables list above and:
- Webhook ingest for one initial channel (SMS/WhatsApp **or** web chat — pick one to launch)
- Durable-enqueue-then-ACK: webhook handler persists job to Postgres outbox first, then returns `200 OK`; job processing is asynchronous via worker
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

## Next: Phase 3 — Revenue-Ready Acquisition

Begins only after Phase 2 completion criteria are met.

Phase 3 delivers the acquisition mode state machine, Stripe billing, and idempotent provisioning.
