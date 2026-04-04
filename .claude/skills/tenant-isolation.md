# Skill: Tenant Isolation

## The Rule

**Every database query that returns business data must be scoped by `organisation_id`.**

No exceptions. Not for admins. Not for internal tools. Not for "quick lookups".

## Implementation Pattern

### Request Context

The authenticated organisation ID must be attached to every request early in the middleware chain:

```typescript
// Future: auth middleware attaches this
req.orgId = jwtPayload.org;
```

### Service Layer

Services receive `orgId` as an explicit parameter:

```typescript
async function getConversation(orgId: string, convId: string) {
  return conversationRepository.findOne(orgId, convId);
}
```

### Repository Layer

Every repository function enforces `organisation_id`:

```typescript
async function findOne(orgId: string, convId: string) {
  return db.query(
    "SELECT * FROM conversations WHERE organisation_id = $1 AND id = $2",
    [orgId, convId]
  );
}
```

### Return 404, Not 403

When a resource exists but belongs to a different organisation, return `404 NOT_FOUND`, not `403 FORBIDDEN`. This prevents leaking existence information.

## Audit

Any function that accesses business data without `organisation_id` is a security defect. Review all repository functions before shipping any data phase.

## Anti-Patterns

- Querying by only `id` without `organisation_id`
- "Platform admin mode" that bypasses tenant scope in the same code path
- Returning data and then filtering by `orgId` in memory (filter at DB level)
