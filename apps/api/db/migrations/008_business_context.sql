-- Migration 008: business_context table
-- Phase 2: structured manual business context for environment-aware agents
-- Each entry is one piece of a business's environment (profile, services, FAQ, tone, knowledge)

CREATE TABLE IF NOT EXISTS business_context (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  category        TEXT NOT NULL CHECK (category IN ('profile', 'services', 'faq', 'tone', 'knowledge')),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'website', 'document', 'social')),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant isolation: every query must filter by organisation_id
CREATE INDEX idx_business_context_org ON business_context (organisation_id);

-- Runtime loader: fetch all active entries for an agent, ordered by category and sort_order
CREATE INDEX idx_business_context_agent_active ON business_context (agent_id, active) WHERE active = true;
