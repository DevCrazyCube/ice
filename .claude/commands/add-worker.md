# Command: add-worker

## Phase: 1 — Foundations

The Postgres outbox is the Phase 1 queue. Workers are a Phase 1 deliverable.
See `queue-worker-pattern.md` and `observability-tracing.md` for the full pattern.

## Steps

1. **Define the job schema** in `packages/schemas/src/jobs.ts`
2. **Create the worker** at `apps/api/src/modules/<domain>/worker.ts`
3. **Register the worker** in the app boot sequence
4. **Add the enqueue call** in the appropriate service or route handler (after signature verify / after 200 ACK)

## Worker Template

```typescript
// apps/api/src/modules/conversations/worker.ts
import { trace } from "@opentelemetry/api";
import { propagation, context } from "@opentelemetry/api";
import { messageProcessJobSchema } from "@ice/schemas";
import { conversationService } from "./service.js";
import type { OutboxJob } from "../types.js";

const tracer = trace.getTracer("ice-api");

export async function processConversationJob(job: OutboxJob): Promise<void> {
  // 1. Validate payload
  const payload = messageProcessJobSchema.parse(job.payload);

  // 2. Restore trace context from outbox payload
  const ctx = propagation.extract(context.active(), payload.traceContext ?? {});

  await context.with(ctx, async () => {
    const span = tracer.startSpan("worker.process", {
      attributes: {
        "tenant_id": payload.organisationId,
        "conversation_id": payload.conversationId,
        "job_id": job.id,
        "attempts": job.attempts,
      },
    });
    try {
      // 3. Idempotency check — skip if already processed
      const alreadyDone = await conversationRepo.findByDeliveryId(
        payload.organisationId,
        payload.deliveryId
      );
      if (alreadyDone) { span.end(); return; }

      // 4. Delegate to service — no business logic in worker
      await conversationService.processInbound(payload.organisationId, payload.conversationId);

      span.end();
    } catch (err) {
      span.recordException(err as Error);
      span.end();
      throw err;
    }
  });
}
```

## Enqueue Pattern (from webhook handler)

```typescript
// Capture trace context before inserting outbox row
const carrier: Record<string, string> = {};
propagation.inject(context.active(), carrier);

await db.query(
  `INSERT INTO outbox_jobs (organisation_id, type, payload)
   VALUES ($1, $2, $3)`,
  [orgId, "message.process", {
    organisationId: orgId,
    conversationId,
    deliveryId,
    traceContext: carrier,
  }]
);
```

## Rules

- All job payloads must include `organisationId`
- Workers must be idempotent — use `deliveryId` to detect duplicates
- No business logic in the worker loop — delegate to service layer
- One worker function per job type
- Failed jobs must log `jobId`, `organisationId`, `attempts`
- `FOR UPDATE SKIP LOCKED` on all job claims (see `queue-worker-pattern.md`)
- Emit `worker.process` OTel span with `tenant_id`, `conversation_id`, `job_id`, `attempts`
