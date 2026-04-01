# Command: add-worker

## Status: Queue not yet implemented (Foundation Phase)

Do not add workers until the queue system is in place.

## Future Steps

1. **Define the job schema** in `packages/schemas/src/jobs.ts`
2. **Create the worker** in `apps/api/src/modules/<domain>/worker.ts`
3. **Register the worker** in the queue boot sequence
4. **Add the enqueue call** in the appropriate service method

## Worker Template

```typescript
// apps/api/src/modules/conversations/worker.ts
import { conversationJobSchema } from "@ice/schemas";
import { conversationService } from "./service.js";

export async function processConversationJob(rawPayload: unknown) {
  // 1. Validate payload
  const job = conversationJobSchema.parse(rawPayload);

  // 2. Process (with orgId from job payload)
  await conversationService.process(job.organizationId, job.conversationId);
}
```

## Rules

- All job payloads must include `organizationId`
- Workers must be idempotent
- Workers delegate to service layer — no inline business logic
- One worker per job type
- Failed jobs must be logged with `jobId` and `organizationId`
