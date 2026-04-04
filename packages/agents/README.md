# @ice/agents

Agent runtime package for the ICE platform.

## Architecture: Environment-Aware Agents

This package implements **environment-aware agents** powered by a single shared engine. Agents learn a business from its context and respond as if they belong in that business's environment. There are no per-industry templates, niche-specific prompt files, or hardcoded role definitions.

### Two Operating Modes

- **Acquisition** (`src/acquisition/`) — qualifies leads, educates, makes offers, triggers checkout with consent
- **Inbound** (`src/inbound/`) — answers questions, qualifies, routes, escalates using business context

Both modes share the same three-layer prompt architecture:

1. **Core behavior** (SYSTEM) — safety, validation, conversation flow. Shared across all agents.
2. **BusinessContext** (DEVELOPER) — the business's environment, organized into three groupings:
   - **A. Identity** — who the business is (name, type, summary, locale, locations)
   - **B. Operations** — what it does (services, FAQ, hours, policies, constraints)
   - **C. Intent/Style** — how the agent behaves (tone, goals, escalation rules, brand voice)
3. **Channel rules** — formatting, length limits, provider constraints. Per-channel.

### BusinessContext vs AgentSpec

- **BusinessContext** describes the business environment. Stored as typed, categorized entries in the `business_context` table.
- **AgentSpec** describes the agent runtime policy (mode, persona, autonomy limits, tool allowlist, safety contract). Stored as JSONB on the `agents` table.
- Business-specific knowledge (services, FAQ, tone, goals) belongs in BusinessContext, not AgentSpec.

### Runtime Contracts (`src/shared/`)

| Contract | Purpose |
|----------|---------|
| `RuntimeInput` | Everything the worker passes to the engine (agent spec, BusinessContext, message, IDs) |
| `RuntimeContext` | Internal three-layer prompt assembly (SYSTEM + DEVELOPER + CHANNEL + user message) |
| `RuntimeDecision` | Engine decision: reply, escalate, or no_response |
| `RuntimeOutput` | What the engine returns to the worker (decision, formatted reply, timing) |

## Rules

- **No niche-specific templates.** Business-specific behavior comes from BusinessContext data, not from per-industry code.
- **No prompt zoo.** One prompt architecture, parameterised by BusinessContext.
- **No unstructured context blob.** BusinessContext is typed, categorized entries.
- **No embedded operator mode.** ICE does not act inside third-party software.
- All agent operations must include `organisationId` in context (tenant isolation)
- Read `docs/05-agents/agents-overview.md` and `docs/07-roadmap/current-phase.md` before adding code here
- Read `docs/00-product/adaptive-business-context.md` for the product direction and structured model
