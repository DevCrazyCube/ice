# Command: add-endpoint

## Purpose

Add a new HTTP endpoint to an existing module.

## Steps

1. **Define the input schema** in `packages/schemas/src/api.ts` or the module's `types.ts`
2. **Add the route handler** to the module's `routes.ts`
3. **Add the service method** to the module's `service.ts`
4. **Add the repository query** if new data access is needed
5. **Register the route** if it's on a new path prefix (update `app.ts`)

## Route Handler Template

```typescript
myRouter.post("/my-resource", async (req, res) => {
  // 1. Validate input
  const body = createMyResourceSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: body.error.message }
    });
  }

  // 2. Get org context
  const orgId = req.orgId;

  // 3. Call service
  const result = await myService.create(orgId, body.data);

  // 4. Return response
  res.status(201).json({ data: result });
});
```

## Rules

- Always validate input with Zod before calling service
- Always pass `orgId` from request context — never from request body
- Return consistent error shapes (see `api-contracts.md`)
- HTTP 201 for resource creation, 200 for reads/updates
- Log the action if it creates/modifies data (future: audit log)
