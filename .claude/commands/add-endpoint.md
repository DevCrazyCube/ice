# Command: add-endpoint

## Purpose

Add a new HTTP endpoint to an existing module.

## Steps

1. **Define the input schema** in `packages/schemas/src/api.ts` or the module's `types.ts`
2. **Add the route handler** to the module's `routes.ts`
3. **Add the service method** to the module's `service.ts`
4. **Add the repository query** if new data access is needed
5. **Emit an audit event** if the action creates/modifies/deletes data (see `audit-logging.md`)
6. **Add an OTel span** if the endpoint is on a data-plane hot path
7. **Register the route** in `app.ts` if it's on a new path prefix

## Route Handler Template

```typescript
myRouter.post("/", async (req, res) => {
  // 1. Validate input
  const body = createMyResourceSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: body.error.message }
    });
  }

  // 2. Get org context from auth middleware — never from request body
  const orgId = req.orgId;

  // 3. Call service
  const result = await myService.create(orgId, body.data);

  // 4. Return consistent response shape
  res.status(201).json({ data: result });
});
```

## Webhook Ingest Endpoints

Webhook endpoints follow a different pattern — see `webhook-security.md`:
- Use `express.raw({ type: "*/*" })` not `express.json()`
- Verify signature before any payload access
- Return `200` immediately after signature check
- Persist and enqueue asynchronously

## Rules

- Always validate input with Zod before calling service
- Always take `orgId` from request context — never from request body
- Return consistent error shapes: `{ error: { code, message } }`
- HTTP 201 for resource creation, 200 for reads/updates
- Emit audit event for any action that creates, modifies, or deletes data
- Never log request body content (may contain PII)
