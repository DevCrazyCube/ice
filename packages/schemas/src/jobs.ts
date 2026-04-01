import { z } from "zod";

/**
 * Outbox job payload schemas.
 *
 * All jobs flow through the Postgres outbox table.
 * Every payload must include organisationId for tenant isolation.
 * Trace context is carried through from the ingest span via propagation.inject().
 */

// Base — all jobs must include these fields
export const baseJobSchema = z.object({
  organisationId: z.string().uuid(),
  jobId: z.string().uuid(),
  createdAt: z.string().datetime(),
  /** OpenTelemetry trace context carrier — for trace propagation through outbox */
  traceContext: z.record(z.string()).optional(),
});

export type BaseJob = z.infer<typeof baseJobSchema>;

// message.process — enqueued by webhook ingest handler after fast 200 ACK
export const messageProcessJobSchema = baseJobSchema.extend({
  type: z.literal("message.process"),
  conversationId: z.string().uuid(),
  /** Provider delivery ID — used for idempotency check in worker */
  deliveryId: z.string(),
  channelType: z.enum(["sms", "web", "voice"]),
});

export type MessageProcessJob = z.infer<typeof messageProcessJobSchema>;

// outbound.send — enqueued by worker after agent generates a reply
export const outboundSendJobSchema = baseJobSchema.extend({
  type: z.literal("outbound.send"),
  conversationId: z.string().uuid(),
  channelType: z.enum(["sms", "web", "voice"]),
  /** Serialised reply content — must not contain PII in job log */
  replyId: z.string().uuid(),
});

export type OutboundSendJob = z.infer<typeof outboundSendJobSchema>;

// Union of all job types for worker dispatch
export const outboxJobPayloadSchema = z.discriminatedUnion("type", [
  messageProcessJobSchema,
  outboundSendJobSchema,
]);

export type OutboxJobPayload = z.infer<typeof outboxJobPayloadSchema>;
