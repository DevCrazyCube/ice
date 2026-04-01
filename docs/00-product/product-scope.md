# Product Scope

## What ICE Is

ICE is a **multi-tenant agent platform** for businesses that need to automate conversations at scale.

ICE has exactly two products:

### 1. Acquisition Agent
Handles new lead conversations on behalf of a business.

Responsibilities:
- Qualifies lead interest
- Answers basic product questions using configured knowledge
- Moves leads toward a defined next step (booking, signup, handoff to human)

Does NOT do deep CRM operations or complex routing.

### 2. Client Inbound Agent
Handles inbound conversations for existing client businesses.

Responsibilities:
- Answers questions using business-specific knowledge and policy
- Qualifies or routes conversations to the right resource
- Escalates safely when confidence is low or policy requires human review

Does NOT replace human agents for complex or sensitive situations.

---

## Multi-Tenancy Model

Each client business is an **Organisation**. All data, agents, conversations, and configurations are scoped to an `organisation_id`. No cross-tenant data access is permitted at any layer.

---

## Delivery Model

ICE is built in four phases:

| # | Phase | What ships |
|---|-------|-----------|
| 1 | Foundations | Tenancy, auth, audit, webhook ingest, outbox/queue, worker skeleton, OTel |
| 2 | Agent Capabilities | Agent runtime, tool gateway, pgvector/RAG, guardrails, eval harness |
| 3 | Revenue-Ready Acquisition | Conversation state machine, Stripe, Twilio, idempotent provisioning |
| 4 | Scaling / Agent OS | Dashboard v1, policy-as-config, quotas, approvals, SLOs |

---

## What ICE Is NOT

| Claim | Reality |
|-------|---------|
| Generic agent framework | No. ICE has two specific products only. |
| Workflow builder | No. No canvas, no drag-and-drop. |
| CRM replacement | No. Conversations only. |
| Swarm / multi-agent system | No. Each conversation is handled by one agent. |
| AI sandbox or playground | No. Production-oriented only. |
| General-purpose LLM proxy | No. |

---

## Non-Goals (All Phases)

- No custom workflow orchestration engine
- No visual flow builder
- No third-party CRM sync
- No general-purpose LLM API proxy
- No multi-agent coordination primitives
- No real-time streaming dashboard (beyond basic status)
- No LLM calls inside webhook route handlers (ever)

---

## Intended Users

- **Platform admins** — ICE employees managing client onboarding and infrastructure
- **Org admins** — client business owners configuring their agent's knowledge and policy
- **End users** — interact with the agent via a configured channel (web chat, SMS)
