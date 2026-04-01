# API Contracts

## Conventions

### Base URL
```
/api/v1/...
```

All routes are versioned. Breaking changes increment the version.

### Authentication
All routes except `/health` and `/webhooks/*` require `Authorization: Bearer <jwt>`.

JWT payload must include: `sub` (user ID), `org` (organisation ID), `roles` (array).

Webhook routes authenticate via **provider signature**, not JWT.

### Content Type
All requests and responses: `application/json`.

Webhook ingest routes: use `express.raw()` middleware to preserve the raw body buffer before signature verification. Do not use `express.json()` on webhook routes.

---

## Response Shapes

### Success
```json
{ "data": { ... } }
```

### Paginated Success
```json
{
  "data": [...],
  "pagination": { "page": 1, "pageSize": 20, "total": 142 }
}
```

### Error
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found",
    "requestId": "req_abc123"
  }
}
```

---

## Standard Error Codes

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request body or params |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT or webhook signature |
| 403 | `FORBIDDEN` | Authenticated but not permitted |
| 404 | `NOT_FOUND` | Resource does not exist or belongs to a different org |
| 409 | `CONFLICT` | Duplicate or conflicting state |
| 422 | `UNPROCESSABLE` | Request valid but cannot be processed |
| 429 | `RATE_LIMITED` | Per-tenant rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Phase 1 Routes

### Health (implemented)
```
GET /health
→ 200 { status: "ok", timestamp: ISO }
```

### Webhook Ingest (Phase 1 — to implement)
```
POST /webhooks/inbound/:channelType
  Headers: X-Twilio-Signature (Twilio) | Stripe-Signature (Stripe)
  Body:    raw buffer (not parsed JSON)
→ 200 { received: true }                 (fast ACK — always, even if processing fails)
→ 401                                    (invalid signature)
→ 429                                    (rate limited)
```

**Critical**: return `200` before any processing. The worker handles the job asynchronously.

### Auth Callbacks (Phase 1 — to implement)
```
GET  /auth/callback         OIDC callback from identity provider
POST /auth/logout           Invalidate session
```

---

## Phase 2+ Routes (Not Yet)

```
# Agents (control plane)
GET    /api/v1/agents
POST   /api/v1/agents
GET    /api/v1/agents/:id
PATCH  /api/v1/agents/:id

# Channels
GET    /api/v1/agents/:agentId/channels
POST   /api/v1/agents/:agentId/channels
DELETE /api/v1/agents/:agentId/channels/:id

# Conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:id

# Messages
GET    /api/v1/conversations/:id/messages
```

---

## Rules

- All routes returning business data must be scoped to the authenticated organisation
- Webhook handlers must validate signatures before touching the request body as JSON
- All POST/PATCH bodies are validated with a Zod schema before reaching service logic
- All errors include `requestId` for traceability
- Return `404` (not `403`) when a resource exists but belongs to a different organisation
- `200 OK` on duplicate webhook delivery IDs (idempotent no-op — prevents provider retries)
