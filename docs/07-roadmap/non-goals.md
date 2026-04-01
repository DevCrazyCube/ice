# Non-Goals

This document lists things Claude is **not allowed to build** without an explicit phase change and written justification.

If a request would require implementing any of the following, Claude must:
1. Stop
2. Check `current-phase.md`
3. Ask for clarification before proceeding

---

## Permanent Non-Goals (All Phases)

These will never be part of ICE regardless of phase:

- **Generic agent framework** — ICE has two specific agent products. No abstractions that generalize beyond them.
- **Workflow / orchestration builder** — No canvas, no drag-and-drop, no flow definition language.
- **Visual flow editor** — No node-based UI.
- **CRM replacement** — ICE does not store or manage customer records beyond conversation scope.
- **Swarm / multi-agent coordination** — Conversations are handled by one agent at a time.
- **AI sandbox or playground** — No experimental or demo-mode features.
- **Event sourcing framework** — Not needed; simple CRUD with audit logs is sufficient.
- **Multiple queue implementations** — One queue system only (Redis-based, when implemented).
- **Multiple config systems** — One config loader per app.
- **Legacy compatibility layers** — Replace old code, don't maintain both paths.

---

## Phase-Gated (Not Yet Allowed)

These are real future features but must not be started before their phase begins:

| Feature | Allowed Phase |
|---------|--------------|
| Agent runtime (LLM calls, conversation handling) | Phase 3: Agent Runtime |
| Retrieval / RAG / vector DB | Phase 4: Knowledge |
| Billing / Stripe integration | Phase 5: Billing |
| Twilio / SMS / Voice channels | Phase 5: Channels |
| Production dashboard features | Phase 6: Dashboard |
| Advanced auth (multi-factor, SSO) | Phase 2+: Auth |
| Monitoring / alerting infrastructure | Phase 6: Operations |
| CI/CD pipeline | Phase 1: Foundation |

---

## Anti-Patterns Claude Must Never Introduce

- `utils/` folder with miscellaneous helpers
- `legacy/` or `deprecated/` folders
- Multiple ways to boot the same app
- Speculative exports that nothing imports
- `console.log` instead of the structured logger
- Hardcoded secrets or tokens
- Cross-tenant queries (without `organization_id` filter)
- `any` TypeScript type without explicit justification
