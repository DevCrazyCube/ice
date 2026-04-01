# API Contracts

## Conventions

### Base URL
```
/api/v1/...
```

All routes are versioned. The current version is `v1`.

### Authentication
All routes (except `/health`) require a valid JWT in the `Authorization: Bearer <token>` header.

The JWT payload must include:
- `sub` — user ID
- `org` — organization ID
- `role` — user role

### Content Type
All requests and responses use `application/json`.

---

## Response Shape

### Success
```json
{
  "data": { ... }
}
```

### Paginated Success
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 142
  }
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
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Authenticated but not permitted |
| 404 | `NOT_FOUND` | Resource does not exist or no access |
| 409 | `CONFLICT` | Duplicate or conflicting state |
| 422 | `UNPROCESSABLE` | Request valid but cannot be processed |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Routes (Planned)

These are not yet implemented. They define the intended contract.

### Health

```
GET /health
→ 200 { status: "ok", timestamp: ISO }
```

### Conversations (future)

```
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
```

### Messages (future)

```
GET  /api/v1/conversations/:id/messages
POST /api/v1/conversations/:id/messages
```

---

## Rules

- All routes that return business data must be scoped to the authenticated organization
- All POST/PATCH bodies must be validated with a Zod schema before reaching service logic
- All routes must include a `requestId` in error responses for traceability
- No route may return data from a different organization than the authenticated one
