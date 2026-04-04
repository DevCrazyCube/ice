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

A configured agent instance belonging to an organisation. All agents share the same underlying engine — the `type` field selects the operating mode (acquisition or inbound), while business-specific behavior comes from business context (see below), not from niche-specific code.

```
agents {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  type            TEXT NOT NULL CHECK (type IN ('acquisition', 'inbound'))
  name            TEXT NOT NULL
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused'))
  spec            JSONB NOT NULL DEFAULT '{}'    -- AgentSpec v1 (see packages/schemas/src/agent-spec.ts for canonical shape)
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
  type            TEXT NOT NULL CHECK (type IN ('sms', 'web', 'voice'))
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

### TenantPolicy v1 (schema contract defined in Phase 1; operational enforcement expands in Phase 4)

Per-organisation policy constraints applied at the platform level. The Zod contract is defined in `packages/schemas/src/tenant-policy.ts`.

Storage: to be decided at implementation — either as JSONB column on `organisations` or as a separate `tenant_policies` table.

Schema fields:
- `specVersion` — always `"1"` (literal)
- `organisationId` — UUID of the organisation this policy applies to
- `enabledChannels` — array of `"sms"`, `"web"`, `"voice"` (default: `["web"]`)
- `rateLimits.webhooksPerMinute` — max inbound webhooks per minute (default: 60)
- `rateLimits.outboundPerMinute` — max outbound messages per minute (default: 30)
- `contentPolicy.blockedTopics` — topics the agent must refuse to discuss
- `contentPolicy.allowCompetitorMentions` — whether the agent may discuss competitors (default: false)
- `contentPolicy.requiredDisclaimer` — optional disclaimer appended to all outbound messages
- `maxTokensPerConversation` — token budget per conversation (default: 50,000)
- `requireApprovalForHighSensitivityTools` — whether high-sensitivity tool calls require human approval (default: false; Phase 4 feature, schema placeholder only)
- `updatedAt` — ISO-8601 datetime (optional)

> **Note:** Approval gating for sensitive tools is defined at the **TenantPolicy level** (not on individual ToolSpec entries). The `requireApprovalForHighSensitivityTools` field is a Phase 4 feature — it is present in the schema contract but not enforced until Phase 4.

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

## Phase 2 Entities

### BusinessContext (Phase 2 — Structured Manual Entry)

BusinessContext drives the adaptive behavior of the shared engine. Each entry is one piece of a business's environment, stored as a typed, categorized row. This is NOT a single blob — it is structured data organized into three practical groupings.

**Migration:** `008_business_context.sql` (implemented)

```
business_context {
  id              UUID PK  DEFAULT gen_random_uuid()
  organisation_id UUID NOT NULL REFERENCES organisations(id)
  agent_id        UUID NOT NULL REFERENCES agents(id)
  category        TEXT NOT NULL CHECK (category IN ('profile', 'services', 'faq', 'tone', 'knowledge'))
  title           TEXT NOT NULL          -- e.g. "Business Hours", "Return Policy"
  content         TEXT NOT NULL           -- structured text, validated and sanitised
  sort_order      INT NOT NULL DEFAULT 0
  active          BOOLEAN NOT NULL DEFAULT true
  source          TEXT NOT NULL DEFAULT 'manual'  -- 'manual' | 'website' | 'document' | 'social' (Phase 3+)
  reviewed_at     TIMESTAMPTZ            -- NULL for manual; required for ingested content (Phase 3+)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
}
```

**Category → Grouping mapping:**

| Category | Grouping | What it captures |
|----------|----------|-----------------|
| `profile` | **A. Identity** | Business name, type, summary, locale, locations |
| `services` | **B. Operations** | Products/services offered, pricing hints |
| `faq` | **B. Operations** | Common questions with approved answers |
| `knowledge` | **B. Operations** | Policies, contact rules, verified facts, hours |
| `tone` | **C. Intent/Style** | Preferred tone, brand voice, goals, escalation preferences |

See `docs/00-product/adaptive-business-context.md` for the full three-grouping model (Identity / Operations / Intent & Style).

**Key design decisions:**
- `organisation_id` filter on every query (tenant isolation)
- `agent_id` scoping — Phase 2 stores entries per agent; future org-level base context with agent-level override is a Phase 3+ consideration
- `source` field tracks provenance — `manual` for Phase 2; future ingestion sources added in Phase 3+
- `reviewed_at` is NULL for manual entries (implicitly reviewed by the person entering them); required non-NULL for auto-ingested content before it becomes `active`
- `active` flag allows staging content before it enters the live prompt
- Content is validated/sanitised at write time — business context is semi-trusted input (see `docs/02-security/security-baseline.md §8a`)

**BusinessContext vs AgentSpec boundary:**
- BusinessContext describes the **business** (identity, operations, intent/style) — stored in `business_context` table
- AgentSpec describes the **agent runtime policy** (mode, persona, autonomy limits, tool allowlist, safety contract) — stored as JSONB in `agents.spec`
- Business-specific knowledge (services, FAQ, tone, goals) belongs in BusinessContext, not AgentSpec

> **Note:** Do not build ingestion pipelines (website scraper, document processor) in Phase 2. Phase 2 is manual structured context only. The schema supports future sources but the ingestion code is Phase 3+.

### Other Phase 2 Entities (Future)

```
agent_runs       — one per conversation turn
tool_calls       — invocations within a run
run_events       — lifecycle events for a run
knowledge_docs   — uploaded documents per org (Phase 3+, not Phase 2)
knowledge_chunks — chunked document segments (Phase 3+)
embeddings       — vector embeddings for chunks (Phase 4+)
```

---

## Tenancy Rule

**Every query on business data must filter by `organisation_id`.** This is enforced at the repository layer — not just middleware. No exceptions, including admin tooling.

Return `404 NOT_FOUND` (never `403 FORBIDDEN`) when a resource exists but belongs to a different organisation. This prevents tenancy leakage.
