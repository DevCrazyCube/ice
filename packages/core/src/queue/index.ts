import { context, propagation } from "@opentelemetry/api";
import { getDb } from "../db/index.js";

export interface EnqueuePayload {
  type: string;
  organisationId: string;
  deliveryId?: string;
  [key: string]: unknown;
}

/**
 * Enqueue a job into the Postgres outbox table.
 *
 * Injects the current OTel trace context into the payload so the worker
 * can restore the trace and link its worker.process span to the ingest span.
 *
 * When deliveryId is provided, uses ON CONFLICT DO NOTHING for idempotency.
 * Returns { inserted: true } if a new job was created, { inserted: false }
 * if the deliveryId already exists (duplicate delivery).
 *
 * Phase 1 queue: Postgres outbox table only. No Redis queue.
 */
export async function enqueue(payload: EnqueuePayload): Promise<{ inserted: boolean }> {
  // Capture trace context for propagation through the outbox
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  const payloadWithTrace = { ...payload, traceContext: carrier };

  const db = getDb();
  const result = await db.query(
    `INSERT INTO outbox_jobs (organisation_id, type, payload, delivery_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (delivery_id) WHERE delivery_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [payload.organisationId, payload.type, JSON.stringify(payloadWithTrace), payload.deliveryId ?? null]
  );

  return { inserted: (result.rowCount ?? 0) > 0 };
}
