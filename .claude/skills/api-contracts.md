# Skill: API Contracts

## Standard Response Shapes

All API responses follow one of these shapes. See `packages/schemas/src/api.ts` for Zod definitions.

**Success:**
```json
{ "data": { ... } }
```

**Paginated:**
```json
{ "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 100 } }
```

**Error:**
```json
{ "error": { "code": "NOT_FOUND", "message": "...", "requestId": "req_abc" } }
```

## Validation

Every route that accepts a body or query params must validate with a Zod schema **before** calling service logic.

```typescript
const body = mySchema.safeParse(req.body);
if (!body.success) {
  return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: body.error.message } });
}
```

## Versioning

All routes live under `/api/v1/`. When breaking changes are required, bump to `/api/v2/` — do not break existing contracts.

## Rules

- No route returns data from a different organisation than the requester
- All errors include a `code` (machine-readable) and `message` (human-readable)
- Sensitive fields (passwords, tokens) must never appear in responses
- Date fields are ISO 8601 strings
