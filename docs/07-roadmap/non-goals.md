# Non-Goals

This document lists things Claude is **not allowed to build** without an explicit phase change and written justification.

If a request would require implementing any of the following, Claude must:
1. Stop
2. State which phase the work belongs to
3. Ask for confirmation before proceeding

---

## Permanent Non-Goals (All Phases, Forever)

These will never be part of ICE:

- **Generic agent framework** — ICE has two specific agent products. No abstractions that generalise beyond them.
- **Workflow / orchestration builder** — No canvas, no drag-and-drop, no flow definition language.
- **Visual flow editor** — No node-based UI.
- **CRM replacement** — ICE does not store or manage customer records beyond conversation scope.
- **Multi-agent coordination / swarms** — One conversation, one agent. No swarm primitives.
- **AI sandbox or playground** — No experimental or demo-mode features.
- **Event sourcing framework** — Postgres + audit log is sufficient. No event store.
- **Multiple queue implementations** — One queue system only.
- **Multiple config loaders** — One config system per app.
- **Legacy compatibility layers** — Replace old code, do not maintain both paths.
- **Synchronous LLM calls in webhook handlers** — Always async; always outbox pattern.

---

## Phase-Gated (Not Allowed Until the Phase Is Active)

| Feature | Allowed Phase |
|---------|--------------|
| LLM API calls | Phase 2: Agent capabilities |
| Agent runtime loop (input → plan → output) | Phase 2: Agent capabilities |
| Tool gateway | Phase 2: Agent capabilities |
| Knowledge base / pgvector / RAG | Phase 2: Agent capabilities |
| Guardrails, output validation | Phase 2: Agent capabilities |
| Evaluation harness | Phase 2: Agent capabilities |
| Conversation state machine (qualify → educate → offer) | Phase 3: Revenue-ready |
| Stripe billing integration | Phase 3: Revenue-ready |
| Stripe webhook processing | Phase 3: Revenue-ready |
| Idempotent provisioning jobs | Phase 3: Revenue-ready |
| Funnel analytics | Phase 3: Revenue-ready |
| Dashboard v1 (agents, channels, knowledge, analytics) | Phase 4: Scaling/Agent OS |
| Policy-as-config (quotas, tool allowlists, escalation rules) | Phase 4: Scaling/Agent OS |
| Approval workflow for sensitive actions | Phase 4: Scaling/Agent OS |
| Worker autoscaling / queue partitioning | Phase 4: Scaling/Agent OS |
| SLO definitions and alert thresholds | Phase 4: Scaling/Agent OS |
| Managed vector DB (e.g. Pinecone) | Phase 4: Scaling/Agent OS |
| Incident response drills | Phase 4: Scaling/Agent OS |

---

## Anti-Patterns Claude Must Never Introduce

- `utils/` folder with miscellaneous helpers
- `legacy/` or `deprecated/` folders
- Multiple ways to boot the same app
- Speculative exports that nothing imports
- `console.log` instead of the pino structured logger
- Hardcoded secrets or tokens
- Cross-tenant queries (missing `organization_id` filter)
- `any` TypeScript type without explicit justification
- LLM call inside a synchronous webhook handler
- Side effects (billing, provisioning) triggered without explicit user consent
- Processing a webhook payload before verifying its signature
