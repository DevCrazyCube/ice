import { context, propagation } from "@opentelemetry/api";
import { getDb } from "../db/index.js";

export interface EnqueuePayload {
  type: string;
  organisationId: string;
  [key: string]: unknown;
}

/**
 * Enqueue a job into the Postgres outbox table.
 *
 * Injects the current OTel trace context into the payload so the worker
 * can restore the trace and link its worker.process span to the ingest span.
 *
 * Phase 1 queue: Postgres outbox table only. No Redis queue.
 */
export async function enqueue(payload: EnqueuePayload): Promise<void> {
  // Capture trace context for propagation through the outbox
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  const payloadWithTrace = { ...payload, traceContext: carrier };

  const db = getDb();
  await db.query(
    `INSERT INTO outbox_jobs (organisation_id, type, payload)
     VALUES ($1, $2, $3)`,
    [payload.organisationId, payload.type, JSON.stringify(payloadWithTrace)]
  );
}
