# Adaptive Business Context

This document defines ICE's core product direction: **one shared conversational engine that adapts to each business through context, not through niche-specific templates.**

---

## The Problem With Niche Templates

A naive approach to multi-business conversational AI is to build per-industry templates: "dentist bot," "realtor bot," "plumber bot." This fails because:

1. **Combinatorial explosion** — every industry × every business size × every tone = unmaintainable prompt library
2. **Brittleness** — templates break when a business doesn't fit the mold (a dental practice that also does cosmetics)
3. **Maintenance burden** — each template is a separate artifact to test, update, and version
4. **False specificity** — most businesses need the same core conversational capabilities; the differences are in *what* they talk about, not *how* the engine works

---

## ICE's Approach: Context-Driven Adaptation

ICE uses a single conversational engine. Business-specific behavior is driven by **business context** — structured data about the business that the engine consumes at runtime.

### Three-Layer Agent Architecture

Every ICE agent runs on three layers:

```
┌─────────────────────────────────────────────┐
│  Layer 1: Core Behavior                     │
│  Safety rules, output validation,           │
│  conversation flow, escalation logic        │
│  (shared across ALL agents, all tenants)    │
├─────────────────────────────────────────────┤
│  Layer 2: Business Context                  │
│  Business profile, services, FAQ,           │
│  tone/style, product catalog                │
│  (per-tenant, configured by org admin)      │
├─────────────────────────────────────────────┤
│  Layer 3: Channel & Runtime Rules           │
│  Channel-specific formatting, rate limits,  │
│  message length constraints, provider rules │
│  (per-channel, derived from config)         │
└─────────────────────────────────────────────┘
```

- **Layer 1 (Core)** is the same for every agent. It enforces safety, validates outputs, manages conversation flow, and handles escalation. This is the shared engine.
- **Layer 2 (Business Context)** makes the agent *sound like it belongs to that business*. It contains what the business does, how it talks, what it knows, and what it's not allowed to discuss. This is what makes a dental practice agent different from a law firm agent — not a different template, but different context.
- **Layer 3 (Channel Rules)** adapts output for the delivery channel. SMS has character limits. Web chat can use rich formatting. Voice has different turn-taking patterns.

### What Goes Into Business Context

| Category | Examples | Phase |
|----------|----------|-------|
| **Business profile** | Name, industry, services, hours, location, team size | Phase 2 (manual) |
| **Product/service catalog** | Offerings, pricing tiers, features, comparisons | Phase 2 (manual) |
| **Tone and voice** | Formal/casual, brand adjectives, example phrases | Phase 2 (manual) |
| **FAQ / knowledge** | Common questions, approved answers, key facts | Phase 2 (manual) |
| **Policy rules** | Blocked topics, required disclaimers, escalation triggers | Phase 2 (manual, via TenantPolicy) |
| **Website content** | Scraped and validated pages from business website | Phase 3+ (semi-automated) |
| **Document uploads** | PDFs, guides, training materials | Phase 3+ (upload + process) |
| **Social profiles** | Tone samples from social media presence | Phase 4+ (automated + review) |

---

## Phased Context Evolution

### Phase 2: Manual Structured Context (Starting Point)

The org admin fills in structured forms in the dashboard:
- Business name, industry, services
- Key products/services with descriptions
- FAQ entries (question + approved answer)
- Tone preferences (e.g., "professional but warm")
- Policy overrides (via TenantPolicy)

This is stored as structured data on the agent's `spec` (JSONB) and/or a dedicated `business_context` relation. The runtime engine injects this into the prompt's Layer 2 at conversation start.

**Why start manual:** It works immediately, requires no external dependencies, produces high-quality context (the business owner knows their business best), and validates the architecture before adding automation.

### Phase 3+: Semi-Automated Ingestion

Add optional ingestion from external sources:
- Website crawler (bounded, validated, human-reviewed before activation)
- Document upload + chunking
- Structured import (CSV of products/services)

All ingested content is treated as **untrusted input** until reviewed and approved by the org admin. See `docs/02-security/security-baseline.md` for security requirements.

### Phase 4+: Retrieval Over Context

When the volume of business context exceeds what fits in a prompt:
- pgvector embeddings over approved context chunks
- Runtime retrieval: query relevant context for each conversation turn
- Retrieved content is still structurally separated from system instructions (prompt injection defense)

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

---

## Future Direction: Embedded Operator Model

In the longer term, ICE may evolve toward an **embedded operator** model where the engine is deployed as infrastructure that businesses integrate into their existing systems. This does not change the core architecture — it extends the delivery surface while keeping the shared engine + business context model intact.

This is a future consideration, not a current phase deliverable. Do not build toward it until explicitly scoped.

---

## Summary

ICE learns the business from its environment and responds like it belongs there. The engine is shared. The context is specific. The behavior is adaptive.
