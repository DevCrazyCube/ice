-- Migration 006: audit_events
-- Append-only audit trail for all security-sensitive actions.
-- No UPDATE or DELETE on this table. Ever.

CREATE TABLE audit_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  actor_id         UUID,                -- null for system-initiated actions
  action           TEXT        NOT NULL, -- e.g. 'user.login', 'webhook.received'
  resource_id      UUID,
  resource_type    TEXT,
  -- metadata must never contain PII (names, emails, message content).
  -- Log resource IDs and action codes only.
  metadata         JSONB       NOT NULL DEFAULT '{}',
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No updates ever — only append. Enforce at DB level via trigger if needed.
CREATE INDEX idx_audit_events_organisation_id ON audit_events (organisation_id);
CREATE INDEX idx_audit_events_action ON audit_events (action);
CREATE INDEX idx_audit_events_created_at ON audit_events (created_at DESC);
