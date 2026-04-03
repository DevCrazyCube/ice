# ICE — Inbound Conversation Engine

ICE is a **multi-tenant environment-aware agent platform** that automates inbound conversations for businesses.

One shared engine. Environment-aware agents that learn a business from its context and respond like they belong there. No niche templates.

**Two operating modes:**

1. **Acquisition** — Qualifies new leads, answers product questions, and moves them toward a next step.
2. **Client Inbound** — Handles inbound conversations for client businesses using their business context and policy.

---

## Monorepo Structure

```
apps/
  api/          Node.js + TypeScript API (Express)
  web/          Next.js 14 frontend

packages/
  core/         Shared db, queue, telemetry, security primitives
  schemas/      Shared Zod schemas and TypeScript types
  config/       Shared configuration helpers
  agents/       Agent runtime (environment-aware, two modes)

docs/           Architecture, security, and roadmap docs
.claude/        Claude operating rules, skills, and commands
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Install

```bash
pnpm install
```

### Run (development)

```bash
# API only
cd apps/api && pnpm dev

# Web only
cd apps/web && pnpm dev

# Both (from root)
pnpm dev
```

### Health check

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

---

## Documentation

See `docs/` for architecture, security, and roadmap documentation.

Key docs:
- `docs/00-product/product-scope.md` — what ICE is and isn't
- `docs/00-product/adaptive-business-context.md` — environment-aware agents and business context
- `docs/05-agents/agents-overview.md` — three-layer agent architecture

## Claude Operating Rules

See `CLAUDE.md` for rules all Claude sessions must follow in this repo.
