# Current Phase: Foundation

## Phase Goal

Establish a clean, minimal, production-ready monorepo that future phases can safely build on.

The foundation phase is complete when:
- The monorepo installs and compiles cleanly
- `apps/api` boots and serves `GET /health`
- `apps/web` boots and renders a homepage
- All packages have clear structure and type exports
- Documentation and Claude operating rules are in place

---

## In Scope

- [x] pnpm monorepo workspace setup
- [x] Root config files (package.json, tsconfig.base.json, .editorconfig, .env.example)
- [x] CLAUDE.md operating rules
- [x] apps/api skeleton (Express, health endpoint, config, logger, modular folder structure)
- [x] apps/web skeleton (Next.js 14, homepage, dashboard placeholder)
- [x] packages/core placeholder (db, queue, telemetry, security stubs)
- [x] packages/schemas (Zod schemas for env, API contracts, jobs)
- [x] packages/config placeholder
- [x] packages/agents placeholder (acquisition, inbound, shared types)
- [x] docs/ (product scope, architecture, security, backend, frontend, agents, operations, roadmap)
- [x] .claude/ (skills and commands)

---

## Out of Scope (Do NOT implement in this phase)

- Agent runtime logic of any kind
- LLM API calls
- Retrieval / vector DB / RAG
- Billing (Stripe)
- SMS/Voice channels (Twilio)
- Production dashboard features
- Database schema or migrations
- Redis / queue workers
- Advanced authentication (JWT issuance, session management)
- Multi-channel webhook handlers
- Admin UI
- Monitoring / alerting infrastructure
- CI/CD pipeline

---

## Next Phase (Not Started)

**Phase 2: Data & Auth**
- Postgres schema and migrations
- Authentication (JWT, session)
- Organization and user management API
- Basic tenant-scoped data queries

Do not start Phase 2 work without updating this file.
