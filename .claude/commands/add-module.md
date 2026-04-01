# Command: add-module

## Purpose

Add a new domain module to `apps/api/src/modules/`.

## When to Use

When a new domain concept requires its own routes, service logic, and data access. Examples: `conversations`, `organizations`, `agents`.

## Steps

1. Create `apps/api/src/modules/<domain>/`
2. Create these files:
   - `index.ts` — public API (re-exports only)
   - `routes.ts` — Express route handlers
   - `service.ts` — business logic
   - `repository.ts` — SQL queries
   - `types.ts` — domain TypeScript types
3. Register routes in `apps/api/src/app.ts`
4. Add types to `packages/schemas/` if they need to be shared across apps

## File Templates

### routes.ts
```typescript
import { Router } from "express";
import { myService } from "./service.js";

export const myRouter = Router();

myRouter.get("/my-resource", async (req, res) => {
  const orgId = req.orgId; // set by auth middleware
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
import { db } from "@ice/core/db"; // future

export const myRepository = {
  async findAll(orgId: string) {
    return db.query(
      "SELECT * FROM my_table WHERE organization_id = $1",
      [orgId]
    );
  },
};
```

## Rules

- Every repository function must filter by `organization_id`
- No module imports another module's `repository.ts` directly
- Keep `index.ts` exports minimal — only what other modules need
