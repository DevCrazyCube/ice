# Command: add-module

## Purpose

Add a new domain module to `apps/api/src/modules/`.

## When to Use

When a new domain concept requires its own routes, service logic, and data access.
Examples: `conversations`, `organisations`, `agents`, `channels`, `webhooks`.

## Steps

1. Create `apps/api/src/modules/<domain>/`
2. Create these files:
   - `index.ts` — public API (re-exports only)
   - `routes.ts` — Express route handlers
   - `service.ts` — business logic
   - `repository.ts` — SQL queries (always filter by `organisation_id`)
   - `types.ts` — domain-local TypeScript types
3. Register routes in `apps/api/src/app.ts`
4. Add shared types to `packages/schemas/` if consumed by multiple apps
5. If the module needs background processing, add `worker.ts` (see `add-worker.md`)

## File Templates

### routes.ts
```typescript
import { Router } from "express";
import { myService } from "./service.js";

export const myRouter = Router();

myRouter.get("/", async (req, res) => {
  const orgId = req.orgId; // set by auth middleware — never from body
  const result = await myService.list(orgId);
  res.json({ data: result });
});
```

### service.ts
```typescript
import { myRepository } from "./repository.js";

export const myService = {
  async list(orgId: string) {
    return myRepository.findAll(orgId);
  },
};
```

### repository.ts
```typescript
import { db } from "@ice/core/db";

export const myRepository = {
  async findAll(orgId: string) {
    const result = await db.query(
      "SELECT * FROM my_table WHERE organisation_id = $1 ORDER BY created_at DESC",
      [orgId]
    );
    return result.rows;
  },
};
```

## Rules

- Every repository function must accept and apply `organisation_id`
- No module imports another module's `repository.ts` directly — service-to-service only
- No SQL in route handlers
- No HTTP logic (req/res) in service layer
- Keep `index.ts` exports minimal — only what other modules actually need
- Return 404 (not 403) when a resource exists but belongs to a different org
