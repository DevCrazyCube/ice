-- Migration 007: delivery_id for idempotent enqueue
-- Adds an optional delivery_id column with a partial unique index
-- to prevent duplicate job creation from retried webhook deliveries
-- (e.g. Twilio MessageSid).
--
-- NULLs are unconstrained — only non-NULL delivery_ids must be unique.

ALTER TABLE outbox_jobs ADD COLUMN delivery_id TEXT;

CREATE UNIQUE INDEX idx_outbox_jobs_delivery_id
  ON outbox_jobs (delivery_id)
  WHERE delivery_id IS NOT NULL;
