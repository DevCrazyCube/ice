-- Migration 005: outbox_jobs (Phase 1 queue)
-- Postgres outbox table used as the job queue in Phase 1.
-- Workers poll this table using FOR UPDATE SKIP LOCKED.
-- No separate queue service is required in Phase 1.

CREATE TABLE outbox_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  type             TEXT        NOT NULL,  -- e.g. 'message.process', 'outbound.send'
  payload          JSONB       NOT NULL,  -- includes traceContext carrier for OTel propagation
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts         INT         NOT NULL DEFAULT 0,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Worker query index: pending jobs ordered by creation time
CREATE INDEX idx_outbox_jobs_pending
  ON outbox_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX idx_outbox_jobs_organisation_id ON outbox_jobs (organisation_id);
