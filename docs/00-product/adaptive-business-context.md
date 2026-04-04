# Adaptive Business Context

This document defines ICE's core product direction: **environment-aware agents powered by a single shared engine that adapts to each business through structured context, not through niche-specific templates.**

---

## The Problem With Niche Templates

A naive approach to multi-business conversational AI is to build per-industry templates: "dentist bot," "realtor bot," "plumber bot." This fails because:

1. **Combinatorial explosion** — every industry x every business size x every tone = unmaintainable prompt library
2. **Brittleness** — templates break when a business doesn't fit the mold (a dental practice that also does cosmetics)
3. **Maintenance burden** — each template is a separate artifact to test, update, and version
4. **False specificity** — most businesses need the same core conversational capabilities; the differences are in *what* they talk about, not *how* the engine works

---

## ICE's Approach: Environment-Aware Agents

ICE agents are **environment-aware** — they learn a business from its context and respond as if they belong in that business's environment. This is the core product concept.

Instead of selecting a template, the org admin describes their business environment: what the business is, what it offers, how it talks, what it knows, and what it won't discuss. The shared engine consumes this context at runtime and adapts its behavior accordingly.

A dental practice and a law firm use the same engine. The difference is their business context — not their code, prompts, or templates.

### Three-Layer Agent Architecture

Every ICE agent runs on three layers:

```
+---------------------------------------------+
|  Layer 1: Core Behavior                     |
|  Safety rules, output validation,           |
|  conversation flow, escalation logic        |
|  (shared across ALL agents, all tenants)    |
+---------------------------------------------+
|  Layer 2: Business Context (Environment)    |
|  Structured per-tenant data:                |
|  identity, operations, intent/style         |
|  (configured by org admin)                  |
+---------------------------------------------+
|  Layer 3: Channel & Runtime Rules           |
|  Channel-specific formatting, rate limits,  |
|  message length constraints, provider rules |
|  (per-channel, derived from config)         |
+---------------------------------------------+
```

- **Layer 1 (Core)** is the same for every agent. It enforces safety, validates outputs, manages conversation flow, and handles escalation. This is the shared engine.
- **Layer 2 (Business Context)** is the business's environment. It makes the agent *sound like it belongs to that business*. It contains what the business does, how it talks, what it knows, what its goals are, and what it's not allowed to discuss. This is what makes a dental practice agent different from a law firm agent — not a different template, but different context.
- **Layer 3 (Channel Rules)** adapts output for the delivery channel. SMS has character limits. Web chat can use rich formatting. Voice has different turn-taking patterns.

---

## BusinessContext: Structured Model

BusinessContext is not a giant unstructured blob. It is organized into **three practical groupings**, each containing typed, categorized entries.

### A. Identity — What business is this?

Tells the engine who it's speaking for. Without identity, the agent has no name, no locale, no grounding.

| Category | Examples | Storage |
|----------|----------|---------|
| `profile` | Business name, business type/category, summary description | `business_context` entry |
| `profile` | Locale, timezone, primary language | `business_context` entry |
| `profile` | Physical locations, service areas | `business_context` entry |

### B. Operations — What does the business actually do?

Tells the engine what to talk about. This is the knowledge the agent uses to answer questions, describe services, and guide conversations.

| Category | Examples | Storage |
|----------|----------|---------|
| `services` | Services/products offered, descriptions, pricing hints | `business_context` entry |
| `faq` | Common questions with approved answers | `business_context` entry |
| `hours` | Business hours, availability, holiday schedule | `business_context` entry |
| `constraints` | What the agent must NOT claim, legal disclaimers, regulatory limits | `business_context` entry |
| `knowledge` | Contact/booking rules, policies, return rules, verified facts | `business_context` entry |

### C. Intent & Style — How should the agent behave?

Tells the engine *how* to respond, not just *what* to say. Controls tone, goals, escalation behavior, and brand voice.

| Category | Examples | Storage |
|----------|----------|---------|
| `tone` | Preferred tone (formal/casual), brand adjectives, example phrases | `business_context` entry |
| `goals` | Primary conversion goal, secondary objectives, success criteria | `business_context` entry |
| `escalation_rules` | When to hand off to a human, escalation triggers, fallback behavior | `business_context` entry |

### Why Structured Entries, Not a Giant Blob

Structured, categorized entries are strictly preferred over one large unstructured context field:

- **Easier validation** — each entry has a category, title, content, and length limit. Invalid entries are caught at write time.
- **Safer ingestion** — when automated ingestion arrives (Phase 3+), each piece of ingested content is one entry with a tracked source and review status. A blob makes review impossible.
- **Easier admin editing** — org admins add, edit, reorder, and deactivate individual entries in the dashboard. A blob requires editing a wall of text.
- **Better runtime assembly** — the engine groups entries by category and assembles the DEVELOPER prompt in a stable, predictable order (identity → operations → intent/style).
- **Easier future retrieval/search** — when context volume exceeds prompt limits (Phase 4+), pgvector can embed and retrieve individual entries by relevance. A blob defeats this.
- **Easier debugging** — when an agent says something wrong, you can trace back to which specific entry influenced the response.

### Current Categories (Phase 2)

These are the categories supported in the `business_context` table today:

```
profile        — Business identity (name, type, summary, locale, locations)
services       — Products/services offered (descriptions, pricing hints)
faq            — Common questions and approved answers
tone           — Voice and style preferences
knowledge      — General business knowledge (policies, contact rules, verified facts)
```

Future categories to consider as the model matures:

```
hours          — Business hours and availability
constraints    — Disallowed claims, regulatory limits, legal disclaimers
goals          — Conversion goals and success criteria
escalation_rules — When and how to hand off to humans
locations      — Physical locations, service areas (separate from profile)
```

New categories require a schema migration and Zod enum update. This is intentional — it prevents arbitrary category sprawl.

---

## BusinessContext vs AgentSpec: Clean Separation

BusinessContext and AgentSpec serve different purposes. Business-specific knowledge should NOT be shoved into AgentSpec when it belongs in BusinessContext.

### BusinessContext — Describes the Business Environment

| Responsibility | Examples |
|---------------|----------|
| What the business **is** | Name, type, summary, locale, locations |
| What the business **offers** | Services, products, pricing, hours |
| What the business **knows** | FAQ, approved answers, policies, contact rules |
| How the business **talks** | Preferred tone, brand voice, example phrases |
| What the business **wants** | Goals, success criteria, conversion objectives |
| What the business **won't discuss** | Constraints, disclaimers, blocked topics |

**Scope:** Per-organisation. Can be shared across multiple agents in the same org.

**Who manages it:** Org admin, via dashboard forms.

**Trust level:** Semi-trusted (manual entry in Phase 2); untrusted for ingested content (Phase 3+).

### AgentSpec — Describes the Agent Runtime Policy

| Responsibility | Examples |
|---------------|----------|
| Agent **identity** | Name, operating mode (acquisition/inbound) |
| Agent **persona** | Prompt persona text (references business context, does not duplicate it) |
| Agent **autonomy** | Max conversation turns, token budgets |
| Agent **safety** | Escalation triggers, consent requirements |
| Agent **capabilities** | Allowed tool IDs, tool sensitivity levels |
| Agent **behavior contract** | What the agent is trying to achieve per conversation (goal statement) |

**Scope:** Per-agent. Each agent has its own spec.

**Who manages it:** Org admin or platform admin.

**Trust level:** Trusted configuration (not user-provided content).

### The Boundary Rule

> If it describes the business, it belongs in **BusinessContext**.
> If it describes the agent's runtime policy or safety contract, it belongs in **AgentSpec**.

**Example:** A dental practice's services list belongs in BusinessContext. The agent's max turn limit belongs in AgentSpec. The business's preferred tone belongs in BusinessContext. The agent's escalation triggers could live in either — but the default location is AgentSpec for safety-critical triggers and BusinessContext for business-preference triggers.

---

## Org-Level Base Context vs Agent-Level Override

### The Model

BusinessContext is scoped to `organisation_id + agent_id` in the database. The intended conceptual model is:

1. **Org-level base context** — the default business environment shared across all agents in the organisation. This is the identity, operations, and style that every agent should know.

2. **Agent-level override or extension** — optional per-agent additions or modifications when an agent needs to differ from the base. For example, an acquisition agent may have different goals or a more sales-oriented tone than an inbound support agent.

### Why This Matters

Multiple agents in one organisation share the same business environment but may differ in:
- **Goals** — acquisition agent wants to qualify leads; inbound agent wants to resolve questions
- **Tone** — acquisition agent may be more enthusiastic; inbound agent may be more neutral
- **Escalation behavior** — acquisition agent may escalate to sales; inbound agent may escalate to support

### Current Implementation (Phase 2)

In Phase 2, context entries are stored per `(organisation_id, agent_id)`. There is no formal inheritance mechanism — if two agents share context, the entries are duplicated or managed by the admin.

### Future Direction (Phase 3+)

When multi-agent organisations become common, consider:
- Org-level context entries (no `agent_id`) that serve as defaults
- Agent-level entries that override or extend the org-level entries
- Assembly order: org-level entries first, then agent-level entries (with agent entries taking precedence within the same category and sort order)

**Do NOT build this inheritance system now.** Phase 2 validates the core architecture with per-agent context. The inheritance model can be added when real multi-agent usage patterns emerge.

---

## Phased Context Evolution

The sequence matters. Each phase builds on validated foundations.

### Phase 2: Manual Structured Context (Current — Starting Point)

The org admin enters structured context via dashboard forms:
- Business profile (name, type, summary, locale)
- Services/products with descriptions
- FAQ entries (question + approved answer)
- Tone preferences
- Goals and constraints

Stored as typed entries in the `business_context` table. The runtime engine loads active entries and assembles them into the DEVELOPER prompt layer at conversation start.

**Why start manual:** It works immediately, requires no external dependencies, produces high-quality context (the business owner knows their business best), and validates the architecture before adding automation.

### Phase 3: Controlled Ingestion From External Sources

Add optional ingestion from:
- Website crawler (bounded, validated, human-reviewed before activation)
- Document upload + processing
- Structured import (CSV of products/services)

All ingested content is stored as `business_context` entries with `source` set to `'website'`, `'document'`, or `'social'`. Ingested entries are created with `active = false` and `reviewed_at = NULL`. They enter the live prompt only after the org admin reviews and activates them.

**Scraping does NOT come first. Ingestion does NOT come first. RAG does NOT come first.**

### Phase 4: Retrieval Over Approved Context

When the volume of approved business context exceeds what fits in a single prompt:
- pgvector embeddings over approved context entries
- Runtime retrieval: query relevant entries for each conversation turn
- Retrieved content is still structurally separated from system instructions (prompt injection defense)
- Tenant isolation enforced in every vector query (`WHERE organisation_id = $1`)

---

## Trust Boundaries

BusinessContext content has different trust levels depending on its source. This distinction is critical for security.

| Source | Trust Level | Controls | Phase |
|--------|------------|----------|-------|
| **Manual entry** (org admin via dashboard) | Semi-trusted | Zod validation, length limits, category enforcement, sanitisation | Phase 2 |
| **Website scrape** | Untrusted | All above + human review gate + `reviewed_at` required before `active = true` | Phase 3+ |
| **Document upload** | Untrusted | All above + human review gate + `reviewed_at` required before `active = true` | Phase 3+ |
| **Social profile import** | Untrusted | All above + human review gate + `reviewed_at` required before `active = true` | Phase 4+ |

### Security Invariants

1. **BusinessContext is DEVELOPER-layer data, never SYSTEM-layer.** It cannot override safety rules, escalation behavior, or output validation.
2. **Ingested content requires human review before activation.** No scraped or uploaded content enters the live prompt without explicit org admin approval.
3. **Trusted policy/config (AgentSpec, TenantPolicy) must remain separate from ingested content.** Safety rules and runtime policy are never derived from business context.
4. **User input (conversation messages) is always untrusted.** It is never mixed with business context or system instructions.

---

## What This Direction Explicitly Blocks

| Blocked Pattern | Why |
|----------------|-----|
| Per-industry prompt templates | Creates maintenance burden; doesn't scale |
| "Dentist bot" / "Realtor bot" / "Plumber bot" naming | Implies hardcoded niche roles |
| Niche-specific skill libraries | Skills should be generic (answer from knowledge, qualify, escalate) — context makes them specific |
| Prompt zoo or template marketplace | Business specificity comes from context, not from selecting a template |
| Autonomous scraping without review | Ingested content must be validated before it shapes agent behavior |
| Giant RAG system in Phase 2 | Start with manual structured context; add retrieval only when context volume demands it |
| Embedded operator / CRM integration as core direction | ICE is an agent platform, not middleware inside third-party software |
| Adapter capability marketplace | ICE does not discover or execute actions inside external business software |
| Unstructured context blob | Structured categorized entries are required — not a single large text field |

---

## Summary

ICE agents are environment-aware. They learn a business from structured context and respond like they belong there. The engine is shared. The context is specific. The behavior is adaptive.

BusinessContext is organized into three groupings (Identity, Operations, Intent/Style), stored as typed categorized entries, and assembled into the DEVELOPER prompt layer at runtime. It is cleanly separated from AgentSpec (runtime policy) and from system-level safety rules (SYSTEM layer). It evolves from manual entry (Phase 2) through controlled ingestion (Phase 3) to retrieval (Phase 4), with trust boundaries enforced at every stage.
