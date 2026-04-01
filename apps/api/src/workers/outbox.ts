import { context } from "@opentelemetry/api";
import { getDb, extractTraceContext, withSpan } from "@ice/core";
import { logger } from "../lib/logger.js";

interface OutboxJob {
  id: string;
  organisation_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string | null;
}

const POLL_INTERVAL_MS = 1_000;
const MAX_ATTEMPTS = 3;

let running = false;

/**
 * Start the outbox worker polling loop.
 *
 * Polls the outbox_jobs table for pending jobs using FOR UPDATE SKIP LOCKED
 * to support concurrent workers without double-processing.
 *
 * Job processing is asynchronous — the worker loop claims a job, updates its
 * status to 'processing', then executes the handler outside the claim transaction.
 *
 * Phase 1: the message.process handler is a stub (no LLM calls — Phase 2+).
 */
export function startWorker(): void {
  if (running) {
    logger.warn("Worker already running — ignoring duplicate startWorker call");
    return;
  }
  running = true;
  logger.info("Worker started");
  void poll();
}

/**
 * Signal the polling loop to stop after the current iteration completes.
 */
export function stopWorker(): void {
  running = false;
  logger.info("Worker stopping");
}

async function poll(): Promise<void> {
  while (running) {
    try {
      const processed = await processOne();
      if (!processed) {
        // No pending jobs — wait before next poll
        await sleep(POLL_INTERVAL_MS);
      }
      // If a job was processed, poll again immediately
    } catch (err) {
      logger.error({ err }, "Worker: unexpected error in poll loop");
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/**
 * Claim and process one pending job.
 *
 * Returns true if a job was found and processed (success or failure),
 * false if no pending jobs were available.
 */
async function processOne(): Promise<boolean> {
  const db = getDb();
  const client = await db.connect();
  let job: OutboxJob | undefined;

  // Claim one job inside a transaction using SKIP LOCKED for concurrency safety
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<OutboxJob>(`
      SELECT id, organisation_id, type, payload, status, attempts, last_error
      FROM outbox_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    job = rows[0]!; // length > 0 checked above

    await client.query(
      `UPDATE outbox_jobs
       SET status = 'processing', attempts = attempts + 1, updated_at = now()
       WHERE id = $1`,
      [job.id]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "Worker: failed to claim job");
    return false;
  } finally {
    client.release();
  }

  // TypeScript narrowing guard — unreachable in practice (catch block returns false)
  if (!job) return false;

  // currentAttempts reflects the incremented value now recorded in DB
  const currentAttempts = job.attempts + 1;

  // Restore OTel trace context from the job payload to link this span to ingest
  const traceContext = (job.payload["traceContext"] as Record<string, string>) ?? {};
  const ctx = extractTraceContext(traceContext);

  let processError: unknown = null;

  try {
    await context.with(ctx, () =>
      withSpan(
        "worker.process",
        {
          "tenant.id": job.organisation_id,
          "job.type": job.type,
          "job.id": job.id,
          "job.attempts": currentAttempts,
        },
        async (_span) => {
          await dispatch(job);
        }
      )
    );
  } catch (err) {
    processError = err;
    logger.error(
      { err, jobId: job.id, jobType: job.type, attempts: currentAttempts },
      "Worker: job processing failed"
    );
  }

  // Update job status after processing (outside the span)
  if (processError) {
    const errorMessage =
      processError instanceof Error
        ? processError.message
        : String(processError);
    const newStatus = currentAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await db
      .query(
        `UPDATE outbox_jobs
         SET status = $1, last_error = $2, updated_at = now()
         WHERE id = $3`,
        [newStatus, errorMessage, job.id]
      )
      .catch((dbErr) =>
        logger.error(
          { dbErr, jobId: job.id },
          "Worker: failed to update job status after error"
        )
      );
  } else {
    await db
      .query(
        `UPDATE outbox_jobs SET status = 'done', updated_at = now() WHERE id = $1`,
        [job.id]
      )
      .catch((dbErr) =>
        logger.error(
          { dbErr, jobId: job.id },
          "Worker: failed to mark job done"
        )
      );
  }

  return true;
}

/**
 * Dispatch a job to the appropriate handler by type.
 *
 * Phase 1: message.process is a stub — no agent runtime yet (Phase 2).
 */
async function dispatch(job: OutboxJob): Promise<void> {
  switch (job.type) {
    case "message.process":
      // Phase 1 stub — agent runtime loop not yet implemented (Phase 2+)
      logger.info(
        { jobId: job.id, organisationId: job.organisation_id },
        "Worker: message.process stub — acknowledged, no-op"
      );
      break;

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
