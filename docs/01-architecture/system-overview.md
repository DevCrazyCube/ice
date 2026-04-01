# System Overview

## Core Architectural Pattern

ICE uses **event-driven ingestion with asynchronous processing** as its primary architectural pattern.

This is both a cost-control and security decision. OWASP API Security Top 10 (2023) explicitly identifies "Unrestricted Resource Consumption" — including costs paid per API request (SMS, LLM tokens) — as a top API risk. Asynchronous pipelines enforce budgets, retries, and backpressure.

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
  → Worker      (load conversation + policy, call LLM, send reply)
  → Tool Gateway (schema-validated tool execution — Phase 2+)
  → Outbound Sender (send reply via channel provider)
```

**Data plane rule:** never block the webhook ACK on LLM processing. Acknowledge fast, process asynchronously.

### Control Plane
Handles configuration, policy, and observability:

```
Dashboard (web)
  → Admin API
  → Policy/Config store (Postgres)
  → Audit log (Postgres, append-only)
```

**Control plane rule:** no message processing logic here. CRUD for agents, channels, policies, and knowledge.

---

## System Diagram

```
┌───────────────────────────────────────────────────────────┐
│  CONTROL PLANE                                            │
│  apps/web (Dashboard) ──► apps/api (Admin API)           │
│                              │           │               │
│                           Config      Audit log          │
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

## Webhook Ingest Flow (Sequence)

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
         Process (Phase 2: LLM + tools)
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
  repository.ts     SQL queries — always filter by organization_id
  types.ts          Domain-local TypeScript types
```

Modules do NOT call each other's repositories. They use each other's service interfaces.

---

## Observability Standard

All spans, metrics, and logs use **OpenTelemetry + OTLP** from Phase 1 onward.

Core semantic attributes (stable across all phases):
- `tenant_id` — organization_id
- `conversation_id` — conversation UUID
- `run_id` — agent run UUID (Phase 2+)
- `channel_type` — sms | web | voice

Trace IDs propagate from ingest → worker → outbound.

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Async webhook processing | Outbox → worker | Cost control, retries, DoS protection |
| Single datastore | Postgres + pgvector | Minimal ops, simple tenancy, vectors included |
| Redis | Optional | Only for rate-limit + idempotency; not required in Phase 1 |
| Auth | OIDC + JWT (Phase 1) | Standard; RFC 9700 security BCP |
| Microservices | No | Modular monolith first; decompose only if proven need |
