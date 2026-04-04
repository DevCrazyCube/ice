# Skill: Backend Architecture

## Core Pattern

ICE uses **async webhook ingest + Postgres outbox + worker** as its data plane.

```
Webhook → verify sig → 200 OK → persist → outbox row → worker → process → outbound
```

Never block the webhook ACK on processing. Fast ACK is required.

## Planes

**Data plane** (`apps/api/src/modules/` — ingest, conversations, workers):
- Receives webhooks
- Writes to outbox
- Workers read from outbox
- Sends outbound messages

**Control plane** (`apps/api/src/modules/` — agents, channels, orgs, users):
- CRUD for agent config, channel config, policy
- Dashboard API
- No message processing logic

## Module Shape

```
modules/<domain>/
  index.ts        Public API (re-exports only)
  routes.ts       HTTP handlers
  service.ts      Business logic
  repository.ts   SQL queries — always filter by organisation_id
  types.ts        Domain-local TS types
```

## Adding a Module

See `.claude/commands/add-module.md`.

Rules:
- Repository functions always accept and apply `organisation_id`
- Modules do not call each other's repositories — service-to-service only
- No SQL in route handlers; no HTTP logic in service layer
- Workers are in `modules/<domain>/worker.ts`, not in routes

## Outbox Worker Pattern

```typescript
// Polling worker (simplified)
async function runWorker() {
  while (true) {
    const job = await outboxRepo.claimNext(workerConfig.batchSize);
    if (!job) { await sleep(1000); continue; }
    try {
      await processJob(job);
      await outboxRepo.markDone(job.id);
    } catch (err) {
      await outboxRepo.markFailed(job.id, err.message, job.attempts + 1);
    }
  }
}
```

## Anti-Patterns

- LLM call inside a webhook route handler
- Redis queue before the outbox pattern is proven insufficient
- SQL in route handlers
- HTTP response logic in service layer
- Module importing another module's repository directly
