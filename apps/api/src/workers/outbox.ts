import { context } from "@opentelemetry/api";
import { getDb, extractTraceContext, withSpan, recordAuditEvent } from "@ice/core";
import { runInbound } from "@ice/agents";
import type { RuntimeInput, InboundMessage } from "@ice/agents";
import type { AgentSpecV1, AssembledBusinessContext, BusinessContextEntry } from "@ice/schemas";
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

interface AgentRow {
  id: string;
  organisation_id: string;
  type: string;
  name: string;
  status: string;
  spec: Record<string, unknown>;
}

interface BusinessContextRow {
  id: string;
  organisation_id: string;
  agent_id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  active: boolean;
  source: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const POLL_INTERVAL_MS = 1_000;
const MAX_ATTEMPTS = 3;
const STALE_TIMEOUT_MINUTES = 5;
const RECOVERY_INTERVAL_ITERATIONS = 30; // ~30 seconds at 1s poll

let running = false;

/**
 * Start the outbox worker polling loop.
 *
 * Polls the outbox_jobs table for pending jobs using FOR UPDATE SKIP LOCKED
 * to support concurrent workers without double-processing.
 *
 * Periodically recovers stale jobs stuck in 'processing' (crash recovery).
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
  let iterations = 0;
  while (running) {
    try {
      // Run stale recovery periodically (not on first iteration — give peers
      // time to finish before reclaiming their jobs on a fresh start)
      if (iterations > 0 && iterations % RECOVERY_INTERVAL_ITERATIONS === 0) {
        await recoverStaleJobs();
      }

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
    iterations++;
  }
}

/**
 * Recover jobs stuck in 'processing' for longer than STALE_TIMEOUT_MINUTES.
 *
 * Jobs under MAX_ATTEMPTS are reset to 'pending' for retry.
 * Jobs at or above MAX_ATTEMPTS are marked 'failed'.
 *
 * Safe against active workers: the CAS on `attempts` in processOne() ensures
 * a late-finishing worker's status update is a no-op if the job was recovered
 * and re-claimed at a higher attempt count.
 */
async function recoverStaleJobs(): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<{ id: string; status: string }>(
    `UPDATE outbox_jobs
     SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'pending' END,
         last_error = 'recovered: stale processing timeout',
         updated_at = now()
     WHERE status = 'processing'
       AND updated_at < now() - INTERVAL '${STALE_TIMEOUT_MINUTES} minutes'
     RETURNING id, status`,
    [MAX_ATTEMPTS]
  );

  for (const row of rows) {
    logger.warn(
      { jobId: row.id, newStatus: row.status },
      "Worker: recovered stale processing job"
    );
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

  // currentAttempts reflects the incremented value now recorded in DB.
  // Used as a CAS token in post-processing status updates to prevent a
  // recovered-and-re-claimed job from being clobbered by a stale worker.
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
          "organisation.id": job.organisation_id,
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

  // Update job status after processing.
  // CAS on `attempts` prevents clobbering if recovery reset the job and
  // another worker re-claimed it at a higher attempt count.
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
         WHERE id = $3 AND attempts = $4`,
        [newStatus, errorMessage, job.id, currentAttempts]
      )
      .then((result) => {
        if (result.rowCount === 0) {
          logger.warn(
            { jobId: job.id, attempts: currentAttempts },
            "Worker: CAS miss on job failure update — job was likely recovered and re-claimed"
          );
        }
      })
      .catch((dbErr) =>
        logger.error(
          { dbErr, jobId: job.id },
          "Worker: failed to update job status after error"
        )
      );
  } else {
    await db
      .query(
        `UPDATE outbox_jobs SET status = 'done', updated_at = now()
         WHERE id = $1 AND attempts = $2`,
        [job.id, currentAttempts]
      )
      .then((result) => {
        if (result.rowCount === 0) {
          logger.warn(
            { jobId: job.id, attempts: currentAttempts },
            "Worker: CAS miss on job done update — job was likely recovered and re-claimed"
          );
        }
      })
      .catch((dbErr) =>
        logger.error(
          { dbErr, jobId: job.id },
          "Worker: failed to mark job done"
        )
      );
  }

  return true;
}

// ---------------------------------------------------------------------------
// Job dispatch — routes by job type to the appropriate handler
// ---------------------------------------------------------------------------

async function dispatch(job: OutboxJob): Promise<void> {
  switch (job.type) {
    case "message.process":
      await handleMessageProcess(job);
      break;

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

// ---------------------------------------------------------------------------
// message.process handler — Phase 2 inbound agent runtime
// ---------------------------------------------------------------------------

/**
 * Handle a message.process job: load agent + business context, run the
 * inbound engine, persist the result, and record an audit event.
 */
async function handleMessageProcess(job: OutboxJob): Promise<void> {
  const payload = job.payload;
  const organisationId = job.organisation_id;
  const agentId = payload["agentId"] as string | undefined;
  const channelId = payload["channelId"] as string | undefined;
  const channelType = (payload["channelType"] as string) ?? "sms";

  if (!agentId || !channelId) {
    throw new Error(
      `message.process job ${job.id} missing agentId or channelId in payload`
    );
  }

  // Extract the inbound message from the Twilio params
  const body = payload["body"] as Record<string, string> | undefined;
  const messageBody = body?.["Body"] ?? "";
  const from = body?.["From"] ?? "";
  const to = body?.["To"] ?? "";
  const deliveryId = (payload["deliveryId"] as string) ?? job.id;

  // Step 1: Load agent spec from DB (org-scoped)
  const agent = await loadAgent(organisationId, agentId);
  if (!agent) {
    logger.warn(
      { jobId: job.id, agentId, organisationId },
      "Worker: agent not found or not active — skipping job"
    );
    return;
  }

  // Step 2: Load business context entries from DB (org-scoped, active only)
  const businessContext = await loadBusinessContext(organisationId, agentId);

  // Step 3: Build RuntimeInput
  const message: InboundMessage = {
    deliveryId,
    body: messageBody,
    from,
    to,
    channelType: channelType as "sms" | "web" | "voice",
    rawParams: body ?? {},
  };

  const runtimeInput: RuntimeInput = {
    jobId: job.id,
    organisationId,
    agentId,
    channelId,
    message,
    agentSpec: agent.spec as unknown as AgentSpecV1,
    businessContext,
  };

  // Step 4: Run the inbound engine
  const output = await runInbound(runtimeInput);

  // Step 5: Log the result (no PII — log IDs and decision type only)
  logger.info(
    {
      jobId: job.id,
      organisationId,
      agentId,
      decisionType: output.decision.type,
      confidence: output.decision.confidence,
      durationMs: output.durationMs,
      success: output.success,
    },
    "Worker: message.process completed"
  );

  // Step 6: Record audit event
  await recordAuditEvent({
    organisationId,
    action: "message.processed",
    resourceType: "agent",
    resourceId: agentId,
    metadata: {
      jobId: job.id,
      channelId,
      channelType,
      decisionType: output.decision.type,
      confidence: output.decision.confidence,
      durationMs: output.durationMs,
    },
  }).catch((err) =>
    logger.error(
      { err, jobId: job.id },
      "Worker: failed to record message.processed audit event"
    )
  );
}

// ---------------------------------------------------------------------------
// Data loaders — org-scoped DB queries
// ---------------------------------------------------------------------------

async function loadAgent(
  organisationId: string,
  agentId: string
): Promise<AgentRow | null> {
  const db = getDb();
  const { rows } = await db.query<AgentRow>(
    `SELECT id, organisation_id, type, name, status, spec
     FROM agents
     WHERE id = $1 AND organisation_id = $2 AND status = 'active'`,
    [agentId, organisationId]
  );
  return rows[0] ?? null;
}

async function loadBusinessContext(
  organisationId: string,
  agentId: string
): Promise<AssembledBusinessContext> {
  const db = getDb();
  const { rows } = await db.query<BusinessContextRow>(
    `SELECT id, organisation_id, agent_id, category, title, content,
            sort_order, active, source, reviewed_at, created_at, updated_at
     FROM business_context
     WHERE organisation_id = $1 AND agent_id = $2 AND active = true
     ORDER BY category, sort_order ASC`,
    [organisationId, agentId]
  );

  const entries: BusinessContextEntry[] = rows.map((row) => ({
    id: row.id,
    organisationId: row.organisation_id,
    agentId: row.agent_id,
    category: row.category as BusinessContextEntry["category"],
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    active: row.active,
    source: row.source as BusinessContextEntry["source"],
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    organisationId,
    agentId,
    entries,
    assembledAt: new Date().toISOString(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
