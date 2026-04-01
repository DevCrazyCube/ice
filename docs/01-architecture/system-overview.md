# System Overview

## Architecture Style

ICE is a **modular monolith**. All backend logic runs in a single deployable unit (`apps/api`). Modules are separated by folder, not by service boundary.

We do NOT use microservices in this phase. Microservice decomposition is deferred until there is a proven need for independent scaling or team separation.

---

## Application Boundaries

```
┌─────────────────────────────────────────────────────┐
│                    apps/web (Next.js)                │
│   - Marketing / auth pages                          │
│   - Client dashboard                                │
│   - Talks to apps/api over HTTP                     │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────┐
│                    apps/api (Express)                │
│   - REST API                                        │
│   - Business logic modules                          │
│   - Job queue workers (future)                      │
│   - Tenant isolation enforced here                  │
└──────┬──────────────────────────────────┬───────────┘
       │                                  │
┌──────▼──────┐                  ┌────────▼────────┐
│  Postgres   │                  │  Redis (future) │
│  (future)   │                  │  Job queue      │
└─────────────┘                  └─────────────────┘
```

---

## Module Boundaries (apps/api)

Each module in `apps/api/src/modules/` owns:
- Its own route handlers (or re-exports them to `routes/`)
- Its own service layer (business logic)
- Its own data access layer (queries with `organization_id`)

Modules do NOT call each other's data layers directly. They communicate through explicit service interfaces or shared types.

---

## Data Tenancy

Every database query that returns business data must be scoped by `organization_id`.

```typescript
// Correct
db.query("SELECT * FROM conversations WHERE organization_id = $1", [orgId])

// Never
db.query("SELECT * FROM conversations")
```

---

## Shared Packages

| Package | Purpose |
|---------|---------|
| `@ice/core` | DB, queue, telemetry, security primitives |
| `@ice/schemas` | Zod schemas and TypeScript types |
| `@ice/config` | Shared config helpers |
| `@ice/agents` | Agent runtime (future) |

Packages do NOT import from `apps/`. Apps may import from packages.

---

## Request Lifecycle (future)

```
1. HTTP request → Express router
2. Auth middleware → verify JWT, attach org context
3. Route handler → validate input with zod schema
4. Service layer → business logic, calls data layer with orgId
5. Data layer → Postgres query scoped by organization_id
6. Response → serialize with schema, return JSON
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Monolith vs microservices | Monolith | Simpler ops, lower cost, adequate for current scale |
| Framework | Express | Minimal, no magic, easy to understand |
| ORM | None (yet) | Raw SQL with pg is sufficient and more explicit |
| Auth | JWT (future) | Stateless, standard |
