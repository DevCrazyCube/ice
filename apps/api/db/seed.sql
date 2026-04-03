-- Phase 1 local-dev seed data
-- Idempotent: safe to run multiple times via ON CONFLICT DO NOTHING.
-- Requires migrations to have been applied first (roles table pre-seeded by 002).

INSERT INTO organisations (id, name, slug, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Seed Corp', 'seed-corp', 'free')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, organisation_id, email, external_id)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'admin@seed-corp.local',
  'oidc|seed-admin-001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (id, user_id, role_id, organisation_id)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  (SELECT id FROM roles WHERE name = 'org_admin'),
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agents (id, organisation_id, type, name, status, spec)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'inbound',
  'Seed Inbound Agent',
  'active',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, organisation_id, agent_id, type, provider, config)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'sms',
  'twilio',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
