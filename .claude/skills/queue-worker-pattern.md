# Skill: Queue Worker Pattern

## Status: Not Implemented (Foundation Phase)

The queue system will be Redis-based. Do not implement until Phase 2+.

## Planned Pattern

### Job Producer

```typescript
// In service layer — enqueue a job
await queue.enqueue("conversation.process", {
  organizationId: orgId,
  jobId: randomUUID(),
  createdAt: new Date().toISOString(),
  conversationId: conv.id,
});
```

### Job Consumer (Worker)

```typescript
// Worker picks up jobs and processes them
queue.consume("conversation.process", async (job) => {
  // Always validate job payload with Zod
  const payload = conversationJobSchema.parse(job);
  await conversationService.process(payload.organizationId, payload.conversationId);
});
```

## Rules

- All job payloads must include `organizationId` — see `packages/schemas/src/jobs.ts`
- Jobs must be idempotent — duplicate delivery must not cause duplicate effects
- Failed jobs must be retried with exponential backoff (max 3 retries by default)
- Dead-letter queue for jobs that exhaust retries
- No inline business logic in worker files — delegate to service layer

## One Queue System Only

ICE uses exactly one queue implementation. Do not introduce BullMQ, Kafka, RabbitMQ, or any other queue alongside the primary Redis-based one.
