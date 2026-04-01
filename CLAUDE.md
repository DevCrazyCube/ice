# CLAUDE.md — ICE Platform Operating Rules

Every Claude session working in this repo must read and follow this document before writing any code.

---

## What ICE Is

ICE is a **multi-tenant agent platform** with exactly two products:

1. **Acquisition Agent** — handles new lead conversations, qualifies interest, answers basic product questions, moves leads toward a next step (booking, signup, handoff).
2. **Client Inbound Agent** — handles inbound conversations for client businesses using their business knowledge and policy; answers, qualifies, routes, or escalates safely.

---

## What ICE Is NOT

- Not a generic agent framework
- Not a workflow/orchestration builder
- Not a canvas UI builder
- Not a CRM
- Not a multi-agent playground
- Not an AI sandbox
- Not a swarm system

Do not build toward any of these. If a request feels like it adds a feature from this list, stop and ask.

---

## Stack (Non-Negotiable)

| Layer | Choice |
|-------|--------|
| Package manager | pnpm |
| Monorepo | pnpm workspaces |
| Frontend | Next.js 14 + TypeScript |
| Backend | Node.js + TypeScript + Express |
| Logging | pino |
| Validation | zod |
| DB (future) | Postgres |
| Queue (future) | Redis-based |
| Architecture | Modular monolith first |

Do NOT introduce NestJS, Kafka, Kubernetes, BullMQ, event sourcing frameworks, workflow engines, ORMs, or any heavy infrastructure without a written architectural decision record.

---

## Architecture Principles

### 1. Cost-First
Prefer the cheapest viable implementation. No unnecessary services. No infrastructure-heavy decisions without justification.

### 2. Security-First
- Tenant isolation by `organization_id` is mandatory on every data query
- Secrets never in source control
- Webhook verification required for all inbound webhooks
- Audit logging for all side effects
- PII-conscious logging (never log raw conversation content at INFO level)

### 3. Simplicity-First
- No over-abstraction
- No second implementation path for the same responsibility
- No speculative generic utilities

### 4. Delete-Before-Add
- If a new implementation replaces an old one, delete the old one
- Do not create "legacy" folders
- Do not leave unused exports

### 5. Domain Ownership
- Each folder has one clear responsibility
- No vague `utils/` dumping grounds
- If a helper only serves one domain, it lives in that domain

---

## Folder Ownership

| Path | Owner / Purpose |
|------|----------------|
| `apps/api/src/routes/` | HTTP route handlers only |
| `apps/api/src/modules/` | Domain modules (one folder per domain) |
| `apps/api/src/lib/` | Cross-cutting infra (logger, config) |
| `apps/web/src/app/` | Next.js App Router pages |
| `packages/core/` | Shared DB, queue, telemetry, security primitives |
| `packages/schemas/` | Shared Zod schemas and TS types |
| `packages/config/` | Shared config helpers |
| `packages/agents/` | Agent runtime (future) |
| `docs/` | Architecture and operational documentation |
| `.claude/` | Claude skills, commands, and templates |

---

## Rules for Every Session

1. **Read `docs/07-roadmap/current-phase.md` before writing code.** Do not implement out-of-scope features.
2. **Read `docs/07-roadmap/non-goals.md`.** If the task is on that list, refuse or ask for clarification.
3. **Do not introduce new packages or frameworks** without checking existing utilities first.
4. **Do not create two ways to do the same thing.** One config system. One logger. One boot path.
5. **Do not write code that is not called.** No speculative exports, no future-proofing stubs beyond what the spec requires.
6. **Do not add error handling for scenarios that cannot happen.** Trust internal contracts.
7. **Always include `organization_id` in data access calls** when tenant context is available.
8. **Commit messages must be descriptive** — explain why, not just what.

---

## Security Rules

- No tenant may access another tenant's data. This must be enforced at the query level, not just the API level.
- All webhook endpoints must verify signatures before processing.
- Secrets live in `.env` (local) or a secrets manager (production). Never in source.
- All mutation endpoints must produce an audit log entry (future, but structure for it now).
- No prompt-injection vulnerabilities: never interpolate raw user input directly into agent prompts without sanitization.

---

## Anti-Patterns (Never Do These)

- Creating a generic "agents engine" abstraction
- Creating a workflow/orchestration framework
- Creating a canvas or drag-and-drop builder
- Adding more than one queue implementation
- Adding more than one config loader
- Creating a `utils/` folder with miscellaneous helpers
- Creating a `legacy/` folder
- Writing code that is only there to be "ready for the future"
- Adding `console.log` instead of the structured logger
- Checking in `.env` files
- Skipping `organization_id` in data queries

---

## Asking for Clarification

If a task would require building something not in this document or in `current-phase.md`, ask first. Do not assume scope. ICE is intentionally narrow.
