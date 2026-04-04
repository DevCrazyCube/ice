-- Migration 002: users, roles, user_roles (RBAC)
-- Human users and their role assignments within organisations.

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  email            TEXT        NOT NULL,
  external_id      TEXT,       -- OIDC sub claim
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email ON users (email);
CREATE UNIQUE INDEX uq_users_external_id ON users (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_users_organisation_id ON users (organisation_id);

-- Roles are platform-wide constants (not per-org config)
-- Seeded values: platform_admin, org_admin, org_member
CREATE TABLE roles (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL
);

CREATE UNIQUE INDEX uq_roles_name ON roles (name);

INSERT INTO roles (name) VALUES
  ('platform_admin'),
  ('org_admin'),
  ('org_member');

-- Role assignments are org-scoped
CREATE TABLE user_roles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id          UUID        NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  organisation_id  UUID        NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_user_roles ON user_roles (user_id, role_id, organisation_id);
CREATE INDEX idx_user_roles_organisation_id ON user_roles (organisation_id);
