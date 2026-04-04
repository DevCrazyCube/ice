-- Migration 003: agents and channels
-- Agent instances and their bound communication channels.

CREATE TABLE agents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN ('acquisition', 'inbound')),
  name             TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'active', 'paused')),
  -- AgentSpec v1 — see packages/schemas/src/agent-spec.ts for canonical shape
  spec             JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_organisation_id ON agents (organisation_id);

CREATE TABLE channels (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  agent_id         UUID        NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  -- Canonical channel types: sms, web, voice (see tenant-policy.ts)
  type             TEXT        NOT NULL CHECK (type IN ('sms', 'web', 'voice')),
  provider         TEXT        NOT NULL,  -- e.g. 'twilio'
  config           JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channels_organisation_id ON channels (organisation_id);
CREATE INDEX idx_channels_agent_id ON channels (agent_id);
