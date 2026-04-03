# @ice/agents

Agent runtime package for the ICE platform.

## Architecture: Environment-Aware Agents

This package implements **environment-aware agents** powered by a single shared engine. Agents learn a business from its context and respond as if they belong in that business's environment. There are no per-industry templates, niche-specific prompt files, or hardcoded role definitions.

### Two Operating Modes

- **Acquisition** (`src/acquisition/`) — qualifies leads, educates, makes offers, triggers checkout with consent
- **Inbound** (`src/inbound/`) — answers questions, qualifies, routes, escalates using business context

Both modes share the same three-layer prompt architecture:

1. **Core behavior** (SYSTEM) — safety, validation, conversation flow. Shared across all agents.
2. **Business context** (DEVELOPER) — the business's environment: profile, services, FAQ, tone, goals, constraints. Per-tenant, from `business_context` table.
3. **Channel rules** — formatting, length limits, provider constraints. Per-channel.

### Shared (`src/shared/`)
Types and utilities shared between operating modes.

## Rules

- **No niche-specific templates.** Business-specific behavior comes from business context data, not from per-industry code.
- **No prompt zoo.** One prompt architecture, parameterised by business context.
- **No embedded operator mode.** ICE does not act inside third-party software.
- All agent operations must include `organisationId` in context (tenant isolation)
- Do not implement agent runtime logic until the corresponding phase is started
- Read `docs/05-agents/agents-overview.md` and `docs/07-roadmap/current-phase.md` before adding code here
- Read `docs/00-product/adaptive-business-context.md` for the product direction
