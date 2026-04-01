# ICE — Inbound Conversation Engine

ICE is a multi-tenant agent platform with two products:

1. **Acquisition Agent** — Qualifies new leads, answers product questions, and moves them toward a next step.
2. **Client Inbound Agent** — Handles inbound conversations for client businesses using their knowledge and policy.

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
  agents/       Agent runtime placeholders

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

## Claude Operating Rules

See `CLAUDE.md` for rules all Claude sessions must follow in this repo.
