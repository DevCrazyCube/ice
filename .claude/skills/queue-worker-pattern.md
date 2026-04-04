# Skill: Queue / Outbox / Worker Pattern

## Phase 1: Postgres Outbox (Current)

In Phase 1, the queue is a **Postgres outbox table** polled by workers. No Redis queue, no BullMQ, no external message broker.

This is a deliberate cost and simplicity decision: one Postgres instance serves as the primary store, audit log, AND job queue.

## Outbox Table

```sql
CREATE TABLE outbox_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_jobs_status_created
  ON outbox_jobs (status, created_at)
  WHERE status = 'pending';
```

## Enqueue (from webhook ingest)

```typescript
// In the webhook handler, after verifying signature
await db.query(
  `INSERT INTO outbox_jobs (organisation_id, type, payload)
   VALUES ($1, $2, $3)`,
  [orgId, "message.process", { conversationId, messageId, deliveryId }]
);
// Then return 200 OK
```

## Worker: Claim and Process

```typescript
export async function runWorker(): Promise<void> {
  while (true) {
    const job = await claimNextJob();
    if (!job) {
      await sleep(1000);
      continue;
    }
    try {
      await processJob(job);
      await markJobDone(job.id);
    } catch (err) {
      const nextAttempts = job.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await markJobFailed(job.id, String(err), nextAttempts);
      } else {
        await requeueJob(job.id, String(err), nextAttempts);
      }
    }
  }
}

async function claimNextJob() {
  // Atomic claim using UPDATE ... RETURNING to prevent double-processing
  const result = await db.query(
    `UPDATE outbox_jobs
     SET status = 'processing', updated_at = now()
     WHERE id = (
       SELECT id FROM outbox_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  return result.rows[0] ?? null;
}
```

`FOR UPDATE SKIP LOCKED` prevents two workers from claiming the same job.

## Job Payload Validation

All job payloads must be validated with Zod before processing. Payloads always include `organisationId`.

```typescript
import { messageProcessJobSchema } from "@ice/schemas";

async function processJob(job: OutboxJob): Promise<void> {
  const payload = messageProcessJobSchema.parse(job.payload);
  // Now safe to use payload.conversationId, payload.organisationId
  await conversationService.processInbound(payload.organisationId, payload.conversationId);
}
```

## Idempotency

Jobs must be safe to re-run. Use the `deliveryId` from the original webhook to prevent duplicate processing.

```typescript
// Inside processJob — check if already processed by this deliveryId
const alreadyDone = await conversationRepo.findByDeliveryId(
  payload.organisationId,
  payload.deliveryId
);
if (alreadyDone) return; // idempotent no-op
```

## Retry Policy (Phase 1)

- Max 3 attempts
- Exponential backoff via `scheduled_at` column (add if needed)
- After 3 failures: mark `status = 'failed'`, alert via log

## When to Upgrade to Redis Queue

Only upgrade if:
- Worker polling lag consistently exceeds acceptable SLA
- Postgres CPU shows sustained load from outbox polling
- Multiple worker instances need coordination beyond `SKIP LOCKED`

Do not add Redis queue speculatively.

## Rules

- All job payloads must include `organisationId`
- Workers must be idempotent — re-running a job must produce the same result
- One job type per worker function
- No business logic in the worker loop — delegate to service layer
- `FOR UPDATE SKIP LOCKED` on all job claims
