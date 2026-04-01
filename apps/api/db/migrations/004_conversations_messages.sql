-- Migration 004: conversations and messages
-- Conversation sessions and their individual message turns.

CREATE TABLE conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  agent_id         UUID        NOT NULL REFERENCES agents (id),
  channel_id       UUID        NOT NULL REFERENCES channels (id),
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'closed', 'escalated')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  metadata         JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_conversations_organisation_id ON conversations (organisation_id);
CREATE INDEX idx_conversations_agent_id ON conversations (agent_id);
CREATE INDEX idx_conversations_channel_id ON conversations (channel_id);

CREATE TABLE messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  conversation_id  UUID        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role             TEXT        NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  -- Content is encrypted at rest in production environments.
  -- Never log message content. Store conversation_id references only.
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_organisation_id ON messages (organisation_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
