# System Overview

## Core Architectural Pattern

ICE is a **shared adaptive conversational engine** that uses **event-driven ingestion with asynchronous processing** as its primary architectural pattern.

The engine is shared across all tenants and agent types. Business-specific behavior is driven by **business context** (structured data about each business) — not by niche-specific templates or hardcoded per-industry roles. See `docs/00-product/adaptive-business-context.md` for the product direction.

The async-first design is both a cost-control and security decision. OWASP API Security Top 10 (2023) explicitly identifies "Unrestricted Resource Consumption" — including costs paid per API request (SMS, LLM tokens) — as a top API risk. Asynchronous pipelines enforce budgets, retries, and backpressure.

---

## Control Plane vs Data Plane

ICE separates two planes from the beginning:

### Data Plane
Handles the message processing pipeline:

```
Channel webhook
  → Ingest API  (verify signature, fast 200 ACK)
  → Postgres    (persist message event)
  → Outbox/Queue (enqueue job reference)
  → Worker      (load conversation + business context + policy — Phase 1; call LLM + send reply — Phase 2+)
  → Tool Gateway (schema-validated tool execution — Phase 2+ only)
  → Outbound Sender (send reply via channel provider — Phase 2+)
```

The worker loads business context (Layer 2) and channel rules (Layer 3) alongside the shared core behavior (Layer 1) to produce responses that are specific to each business without requiring niche-specific code paths.

**Data plane rule:** never block the webhook ACK on LLM processing. Acknowledge fast, process asynchronously.

### Control Plane
Handles configuration, policy, and observability:

```
Dashboard (web)
  → Admin API
  → Policy/Config store (Postgres)
  → Audit log (Postgres, append-only)
```

**Control plane rule:** no message processing logic here. CRUD for agents, channels, business context, policies, and knowledge.

---

## System Diagram

```
┌───────────────────────────────────────────────────────────┐
│  CONTROL PLANE                                            │
│  apps/web (Dashboard) ──► apps/api (Admin API)           │
│                              │           │               │
│                      Config/Context   Audit log          │
└──────────────────────────────┼───────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────┐
│  DATA PLANE                                               │
│                                                           │
│  Channel  ──► Ingest API ──► Postgres ──► Outbox         │
│                                              │            │
│                                           Worker          │
│                                           │    │          │
│                                       pgvector  Tool GW   │
│                                              │            │
│                                        Outbound Sender    │
└───────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────┐
│  OBSERVABILITY                                            │
│  OpenTelemetry Collector ──► OTLP export                 │
│  (traces from: ingest, worker, tool calls, outbound)     │
└───────────────────────────────────────────────────────────┘
```

---

## Webhook Ingest Flow — Phase 1 Target (not yet implemented)

> This flow describes the **intended Phase 1 architecture**. It is not yet implemented. The webhook endpoint, outbox table, and worker loop are Phase 1 deliverables still in progress.

```
Provider ──► POST /webhooks/inbound (signed)
              │
              ▼
         Verify signature + rate limit
              │
              ▼
         Persist message event (Postgres)
              │
              ▼
         Enqueue job ref (outbox table)
              │
              └──► 200 OK (fast)

Outbox ──► Worker
              │
              ▼
         Load conversation + policy
              │
              ▼
         Process (Phase 2: LLM + tools — not Phase 1)
              │
              ▼
         Persist reply + audit event
              │
              ▼
         Outbound sender
```

---

## Dependency-Light Defaults

| Component | Default | Notes |
|-----------|---------|-------|
| Ingest API | Express (app runtime) | Fast ACK, verify signatures |
| Primary store | Postgres (1 managed DB) | Tenancy + audit + outbox + vectors (pgvector) |
| Queue | Postgres outbox table | Workers poll outbox; no separate queue service in Phase 1 |
| Optional Redis | Rate limits + idempotency keys | Introduced only when load demands it |
| Vectors | pgvector in Postgres | Avoids extra managed service through Phase 2 |
| Dashboard | Next.js (same monorepo) | CRUD config only in Phase 1 |

---

## Monorepo App Boundaries

```
apps/api      Data plane ingest + control plane Admin API + workers
apps/web      Control plane dashboard

packages/core       DB client, queue/outbox, telemetry, security helpers
packages/schemas    Zod schemas, TS types, machine-readable contracts
packages/config     Shared configuration helpers
packages/agents     Agent runtime (Phase 2+)
```

Packages do NOT import from `apps/`. Apps may import from packages.

---

## Module Structure (apps/api)

Each domain in `apps/api/src/modules/<domain>/`:

```
modules/conversations/
  index.ts          Public API of this module (re-exports only)
  routes.ts         HTTP handlers
  service.ts        Business logic (no direct DB calls)
  repository.ts     SQL queries — always filter by organisation_id
  types.ts          Domain-local TypeScript types
```

Modules do NOT call each other's repositories. They use each other's service interfaces.

---

## Observability Standard

All spans, metrics, and logs use **OpenTelemetry + OTLP** from Phase 1 onward.

Core semantic attributes (stable across all phases):
- `tenant_id` — organisation_id
- `conversation_id` — conversation UUID
- `run_id` — agent run UUID (Phase 2+)
- `channel_type` — sms | web | voice

Trace IDs propagate from ingest → worker → outbound.

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Shared engine, not niche templates | One runtime, business context drives behavior | Scales to any industry without per-niche code |
| Async webhook processing | Outbox → worker | Cost control, retries, DoS protection |
| Single datastore | Postgres + pgvector | Minimal ops, simple tenancy, vectors included |
| Redis | Optional | Only for rate-limit + idempotency; not required in Phase 1 |
| Auth | OIDC + JWT (Phase 1) | Standard; RFC 9700 security BCP |
| Microservices | No | Modular monolith first; decompose only if proven need |
| Business context before RAG | Manual structured context first (Phase 2) | Validates architecture; avoids premature complexity |
