# Skill: Backend Architecture

## Guiding Principles

ICE uses a **modular monolith** pattern. All backend code lives in `apps/api`. Modules are separated by folder, not by network boundary.

## Module Shape

Each domain module in `apps/api/src/modules/<domain>/` should contain:

```
modules/conversations/
  index.ts          # Public API of this module (re-exports only)
  routes.ts         # Express route handlers for this domain
  service.ts        # Business logic — no direct db calls here
  repository.ts     # All database queries for this domain
  types.ts          # Domain-specific TypeScript types
```

## Rules

- **Routes** only parse requests, validate input, call service, return response
- **Service** contains business logic; calls repository with orgId
- **Repository** contains SQL; always filters by `organization_id`
- Modules do NOT call each other's repositories — only each other's services (via explicit interface)
- No circular dependencies between modules

## Adding a New Module

See `.claude/commands/add-module.md`

## Anti-Patterns

- Putting SQL in route handlers
- Putting HTTP response logic in service layer
- Creating a module with vague responsibility (e.g., `helpers/`, `utils/`)
- Bypassing a module's public interface
