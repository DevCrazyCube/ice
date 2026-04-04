# Command: start-phase

## Purpose

Use this command when beginning a new development phase. The four phases are fixed by the PDF spec — do not invent new ones.

## The Four Phases

| # | Name | Gate condition |
|---|------|---------------|
| 1 | Foundations | Repo bootstrapped (current) |
| 2 | Agent Capabilities | Phase 1 complete: tenancy, auth, audit, webhook ingest, outbox, worker, OTel |
| 3 | Revenue-Ready Acquisition | Phase 2 complete: agent runtime, tools, RAG, guardrails |
| 4 | Scaling / Agent OS | Phase 3 complete: Stripe, Twilio, conversation state machine |

## Steps

1. **Read `docs/07-roadmap/current-phase.md`** — confirm which phase is active and what is in scope
2. **Read `docs/07-roadmap/non-goals.md`** — confirm what to avoid
3. **Verify gate condition** — the previous phase must be complete before proceeding
4. **Update `current-phase.md`** — change active phase, in-scope items, completion criteria
5. **Read relevant skill docs** for the new phase:
   - Phase 1: `backend-architecture.md`, `webhook-security.md`, `queue-worker-pattern.md`, `observability-tracing.md`, `tenant-isolation.md`, `audit-logging.md`
   - Phase 2: `agent-runtime.md`, `retrieval-rag.md`
   - Phase 3: `billing-provisioning.md`
   - Phase 4: `frontend-dashboard.md`
6. **Identify the first concrete deliverable** — do not attempt the entire phase in one go

## Checklist Before Writing Code

- [ ] `current-phase.md` has been updated to reflect the active phase
- [ ] Previous phase gate condition is met
- [ ] Relevant skill docs have been read
- [ ] First task is specific and small
- [ ] No out-of-scope work included
- [ ] No new packages/frameworks introduced without justification from skill docs

## Rule

Do not start coding a new phase without updating `current-phase.md` first.
