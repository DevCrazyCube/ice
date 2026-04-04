# Command: delete-legacy

## Purpose

Remove code that has been superseded by a new implementation.

## When to Use

When a refactor or new feature makes existing code unnecessary. This is not optional — dead code must be deleted.

## Steps

1. **Identify the code to delete** — be specific (file, function, export)
2. **Find all usages**: `grep -r "<symbol>" apps/ packages/`
3. **Confirm nothing depends on it** — if something does, update it first
4. **Delete the code**
5. **Run typecheck**: `pnpm typecheck` — must pass
6. **Verify at runtime** if the deleted code was on a hot path

## Rules

- Do not create a `legacy/` folder — delete outright
- Do not comment out code — delete it (git history preserves it)
- Do not add `@deprecated` annotations that linger — fix callers immediately
- If you are unsure whether something is used, search before deleting (don't guess)

## What "Dead Code" Looks Like

- Functions that are defined but never called
- Exports that are never imported
- Types that are never referenced
- Files that are never required/imported
- Config keys that are never read

## TypeScript Helps

Enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.base.json` to catch dead code automatically.
