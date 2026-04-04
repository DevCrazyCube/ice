# Non-Goals

This document lists things Claude is **not allowed to build** without an explicit phase change and written justification.

If a request would require implementing any of the following, Claude must:
1. Stop
2. State which phase the work belongs to
3. Ask for confirmation before proceeding

---

## Permanent Non-Goals (All Phases, Forever)

These will never be part of ICE:

- **Generic agent framework** — ICE is one shared engine with two operating modes. No abstractions that generalise beyond them.
- **Niche-specific hardcoded role library** — No "dentist bot," "realtor bot," "plumber bot" templates. Business-specific behavior comes from business context, not from per-industry prompt templates or role definitions.
- **Prompt zoo / template marketplace** — No library of per-niche system prompts. One prompt architecture (three layers), parameterised by business context.
- **Per-industry skill libraries** — Skills are generic (answer from context, qualify, escalate). Business context makes them specific, not niche-specific skill code.
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
- **Autonomous scraping without human review** — All ingested business context (website, documents, social) must be reviewed and approved by the org admin before entering the live prompt.
- **Unstructured context blob** — BusinessContext must be typed, categorized entries (Identity / Operations / Intent & Style). Never a single large text field. See `docs/00-product/adaptive-business-context.md`.
- **Premature ingestion or RAG** — Manual structured context (Phase 2) must be validated before adding ingestion (Phase 3) or retrieval (Phase 4). Scraping does NOT come first.
- **Conflating BusinessContext with AgentSpec** — Business environment (services, FAQ, tone, goals) belongs in BusinessContext. Runtime policy (autonomy limits, tool allowlist, safety triggers) belongs in AgentSpec. Do not mix them.
- **Embedded operator mode** — ICE does not act inside third-party software (CRMs, helpdesks, dialers). It is an agent platform that handles conversations, not middleware that operates external business tools.
- **Adapter capability marketplace** — No architecture for discovering or executing actions inside third-party business software. ICE responds to conversations — it does not drive external software on behalf of businesses.
- **CRM / helpdesk / dialer integration as product direction** — ICE is not "AI inside your sales stack." Integration with external tools may happen as simple webhook/API connections at the edges, never as a core architectural concern.

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
- Cross-tenant queries (missing `organisation_id` filter)
- `any` TypeScript type without explicit justification
- LLM call inside a synchronous webhook handler
- Side effects (billing, provisioning) triggered without explicit user consent
- Processing a webhook payload before verifying its signature
- Per-industry agent templates or niche-specific prompt files
- Hardcoded business knowledge in source code (all business knowledge belongs in `business_context` table)
- Niche-specific UI components (e.g., "dental practice setup wizard")
- Treating ingested/scraped content as trusted input
- Storing business context as a single unstructured blob instead of typed categorized entries
- Putting business-specific knowledge (services, FAQ, tone) in AgentSpec instead of BusinessContext
- Building ingestion/scraping before manual structured context is validated
