# Product Scope

## What ICE Is

ICE is a **multi-tenant environment-aware agent platform** for businesses that need to automate inbound conversations.

ICE agents are **environment-aware**: they learn a business from its context and respond as if they belong in that business's environment. ICE is **not** a library of niche-specific bots (dentist bot, realtor bot, plumber bot). It is a single shared engine that adapts to any business through **business context** — structured information about the business, its products, policies, and tone.

---

## Product Model: One Engine, Two Modes

ICE has exactly **two operating modes**, both powered by the same underlying shared engine:

### 1. Acquisition Mode

Handles new lead conversations on behalf of a business.

Responsibilities:
- Qualifies lead interest
- Answers basic product questions using business context
- Moves leads toward a defined next step (booking, signup, handoff to human)

Does NOT do deep CRM operations or complex routing.

### 2. Client Inbound Mode

Handles inbound conversations for existing client businesses.

Responsibilities:
- Answers questions grounded in the business's context and policy
- Qualifies or routes conversations to the right resource
- Escalates safely when confidence is low or policy requires human review

Does NOT replace human agents for complex or sensitive situations.

### Why "Modes" Not "Products"

Both modes share:
- The same runtime engine (`packages/agents/`)
- The same prompt architecture (three-layer: core → business context → channel rules)
- The same tool gateway and guardrails
- The same security and tenant isolation model

The difference is the **goal and conversation flow**, not the underlying technology. An agent's `type` field (`acquisition` | `inbound`) selects the mode. Business-specific behavior comes from the business context attached to the agent, not from a different codebase or template.

---

## Environment-Aware Agents (Core Product Direction)

ICE agents are environment-aware — they adapt to each business through **business context** (the business's environment), not through hardcoded niche templates or per-industry prompt libraries.

### What Business Context Is

Structured, categorized data that tells the engine how to behave for a specific business. Organized into three practical groupings:

**A. Identity** — What business is this?
- Business name, type/category, summary, locale, timezone, locations

**B. Operations** — What does the business actually do?
- Services/products (descriptions, pricing hints), FAQ, hours, policies, constraints, contact/booking rules

**C. Intent & Style** — How should the agent behave?
- Preferred tone, goals, escalation rules, brand voice, disallowed claims

BusinessContext is stored as typed, categorized entries (not a single unstructured blob). Each entry has a category, title, content, and sort order. See `docs/00-product/adaptive-business-context.md` for the full structured model.

### How Context Evolves Across Phases

| Phase | Context Source | Method |
|-------|---------------|--------|
| Phase 2 | Manual structured input | Org admin enters business profile, FAQ, policies via dashboard forms |
| Phase 3+ | Semi-automated ingestion | Import from website, documents, social profiles (with human review) |
| Phase 4+ | Retrieval over context | pgvector search over ingested and structured context at runtime |

**Scraping does NOT come first. Ingestion does NOT come first. RAG does NOT come first.** Manual structured context validates the architecture before automation is added.

### What Business Context Is NOT

- Not a "prompt zoo" — there is no library of per-niche system prompts
- Not a template marketplace — businesses don't pick from "dentist template" or "realtor template"
- Not an unstructured blob — context is typed, categorized entries with validation
- Not autonomous scraping — even future ingestion requires validation and human review
- Not a replacement for runtime policy — business context informs tone and knowledge; agent safety rules remain in AgentSpec, not BusinessContext

See `docs/00-product/adaptive-business-context.md` for the detailed design direction.

---

## Multi-Tenancy Model

Each client business is an **Organisation**. All data, agents, conversations, business context, and configurations are scoped to an `organisation_id`. No cross-tenant data access is permitted at any layer.

---

## Delivery Model

ICE is built in four phases:

| # | Phase | What ships |
|---|-------|-----------|
| 1 | Foundations | Tenancy, auth, audit, webhook ingest, outbox/queue, worker skeleton, OTel |
| 2 | Agent Capabilities | Runtime loop, tool gateway, **structured business context**, guardrails, eval harness |
| 3 | Revenue-Ready Acquisition | Conversation state machine, Stripe, Twilio, idempotent provisioning |
| 4 | Scaling / Agent OS | Dashboard v1, policy-as-config, quotas, approvals, SLOs, context ingestion automation |

---

## What ICE Is NOT

| Claim | Reality |
|-------|---------|
| Generic agent framework | No. ICE is one environment-aware engine with two modes. |
| Niche-specific bot library | No. No "dentist bot" or "realtor bot" templates. |
| Workflow builder | No. No canvas, no drag-and-drop. |
| CRM replacement | No. Conversations only. |
| Swarm / multi-agent system | No. Each conversation is handled by one agent. |
| AI sandbox or playground | No. Production-oriented only. |
| General-purpose LLM proxy | No. |
| Prompt zoo / template marketplace | No. Behavior comes from business context, not pre-built templates. |
| Embedded operator / CRM integration | No. ICE is an agent platform, not middleware inside third-party software. |
| Adapter marketplace | No. ICE does not discover or execute actions inside external business software. |

---

## Non-Goals (All Phases)

- No custom workflow orchestration engine
- No visual flow builder
- No third-party CRM sync
- No general-purpose LLM API proxy
- No multi-agent coordination primitives
- No real-time streaming dashboard (beyond basic status)
- No LLM calls inside webhook route handlers (ever)
- No niche-specific hardcoded role library
- No per-industry prompt templates
- No autonomous web scraping without human review
- No embedded operator mode or CRM/helpdesk/dialer integration as product direction
- No adapter capability marketplace for third-party software

---

## Intended Users

- **Platform admins** — ICE employees managing client onboarding and infrastructure
- **Org admins** — client business owners configuring their agent's business context and policy
- **End users** — interact with the agent via a configured channel (web chat, SMS)
