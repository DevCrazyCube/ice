# Domain Model

## Phase 1 Entities (Foundations)

These entities are required by Phase 1. They are not yet implemented — this defines the intended DB schema for when migrations are written.

---

### Organisation

Top-level tenant unit. Every other entity belongs to an organisation.

```
organisations {
  id              UUID PK  DEFAULT gen_random_uuid()
  name            TEXT NOT NULL
  slug            TEXT NOT NULL UNIQUE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### User

A human who has authenticated to the platform.

```
users {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  email           TEXT NOT NULL UNIQUE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### Role + UserRole (RBAC)

Roles assigned to users within an organisation.

```
roles {
  id    UUID PK
  name  TEXT NOT NULL UNIQUE   -- e.g. 'org_admin', 'org_member', 'platform_admin'
}

user_roles {
  id              UUID PK
  user_id         UUID NOT NULL REFERENCES users(id)
  role_id         UUID NOT NULL REFERENCES roles(id)
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

Planned roles:
- `platform_admin` — ICE staff, cross-tenant visibility
- `org_admin` — full access within one org
- `org_member` — read + limited write within one org

---

### Agent

A configured agent instance belonging to an organisation.

```
agents {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  type            TEXT NOT NULL CHECK (type IN ('acquisition', 'inbound'))
  name            TEXT NOT NULL
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused'))
  spec            JSONB NOT NULL DEFAULT '{}'    -- AgentSpec v1 (see packages/schemas)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### Channel

A communication channel bound to an agent. One agent may have multiple channels.

```
channels {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  agent_id        UUID NOT NULL REFERENCES agents(id)
  type            TEXT NOT NULL CHECK (type IN ('sms', 'whatsapp', 'web'))
  provider        TEXT NOT NULL        -- e.g. 'twilio'
  config          JSONB NOT NULL DEFAULT '{}'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### Conversation

A single conversation session between an end user and an agent.

```
conversations {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  agent_id        UUID NOT NULL REFERENCES agents(id)
  channel_id      UUID NOT NULL REFERENCES channels(id)
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated'))
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ended_at        TIMESTAMPTZ
  metadata        JSONB NOT NULL DEFAULT '{}'
}
```

---

### Message

A single message within a conversation.

```
messages {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  conversation_id UUID NOT NULL REFERENCES conversations(id)
  role            TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system'))
  content         TEXT NOT NULL    -- encrypted at rest in production
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### Outbox (Phase 1 Queue)

Postgres outbox table used as the job queue in Phase 1. Workers poll this table.

```
outbox_jobs {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  type            TEXT NOT NULL       -- e.g. 'message.process'
  payload         JSONB NOT NULL
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed'))
  attempts        INT NOT NULL DEFAULT 0
  last_error      TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

### AuditEvent

Append-only audit trail for all security-sensitive actions.

```
audit_events {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  actor_id        UUID                 -- null for system-initiated actions
  action          TEXT NOT NULL        -- e.g. 'user.login', 'channel.created', 'webhook.received'
  resource_id     UUID
  resource_type   TEXT
  metadata        JSONB NOT NULL DEFAULT '{}'
  ip_address      INET
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

---

## ER Summary (Phase 1)

```
organisations ||--o{ users         : has
users         ||--o{ user_roles    : assigned
roles         ||--o{ user_roles    : grants
organisations ||--o{ agents        : owns
agents        ||--o{ channels      : binds
organisations ||--o{ conversations : contains
conversations ||--o{ messages      : includes
organisations ||--o{ outbox_jobs   : queues
organisations ||--o{ audit_events  : logs
```

---

## Phase 2 Additions (Not Yet)

When Phase 2 begins, add:

```
agent_runs       — one per conversation turn
tool_calls       — invocations within a run
run_events       — lifecycle events for a run
knowledge_docs   — uploaded documents per org
knowledge_chunks — chunked document segments
embeddings       — vector embeddings for chunks
```

---

## Tenancy Rule

**Every query on business data must filter by `organisation_id`.** This is enforced at the repository layer — not just middleware. No exceptions, including admin tooling.

Return `404 NOT_FOUND` (never `403 FORBIDDEN`) when a resource exists but belongs to a different organisation. This prevents tenancy leakage.
