# Domain Model

## Core Entities

These are the primary entities in ICE. They are not yet implemented — this defines the intended shape for the database phase.

---

### Organization

The top-level tenant unit. Every other entity belongs to an organization.

```
Organization {
  id            UUID (PK)
  name          string
  slug          string (unique)
  createdAt     timestamp
  updatedAt     timestamp
}
```

---

### Agent

A configured agent instance belonging to an organization. An organization may have multiple agents of different types.

```
Agent {
  id              UUID (PK)
  organizationId  UUID (FK → Organization)
  type            enum: acquisition | inbound
  name            string
  status          enum: draft | active | paused
  config          jsonb  (type-specific configuration)
  createdAt       timestamp
  updatedAt       timestamp
}
```

---

### Conversation

A single conversation session between an end user and an agent.

```
Conversation {
  id              UUID (PK)
  organizationId  UUID (FK → Organization)
  agentId         UUID (FK → Agent)
  channelType     enum: web | sms | voice
  status          enum: active | closed | escalated
  startedAt       timestamp
  endedAt         timestamp?
  metadata        jsonb
}
```

---

### Message

A single message within a conversation.

```
Message {
  id              UUID (PK)
  organizationId  UUID (FK → Organization)
  conversationId  UUID (FK → Conversation)
  role            enum: user | agent | system
  content         text  (encrypted at rest in production)
  createdAt       timestamp
}
```

---

### AuditLog

Append-only audit trail for all significant business actions.

```
AuditLog {
  id              UUID (PK)
  organizationId  UUID (FK → Organization)
  actorId         UUID?  (null for system actions)
  action          string  (e.g., "conversation.created")
  resourceId      UUID?
  resourceType    string?
  metadata        jsonb
  ipAddress       inet?
  createdAt       timestamp
}
```

---

## Relationships

```
Organization 1──* Agent
Organization 1──* Conversation
Agent        1──* Conversation
Conversation 1──* Message
Organization 1──* AuditLog
```

---

## Tenancy Rule

All queries must filter by `organization_id`. This applies at the data access layer, not just the API layer. No exceptions.
