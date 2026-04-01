# Command: refactor-module

## Purpose

Safely refactor an existing module without breaking callers or leaving dead code.

## Steps

1. **Read the module fully** before making any changes
2. **Find all callers**: `grep -r "from.*modules/<name>" apps/ packages/`
3. **Identify what's changing** — types, function signatures, file structure
4. **Make the change** — update the module
5. **Update all callers** — fix every import/usage
6. **Delete replaced code** — do not leave old implementations alongside new ones
7. **Typecheck**: `pnpm typecheck` — must pass cleanly

## Rules

- Read before touching
- Delete replaced code (see `refactor-delete-first.md`)
- Do not leave both old and new implementations
- Do not create backward-compat aliases unless strictly necessary (and document why)
- TypeScript errors = incomplete refactor

## Checklist

- [ ] Read the full module before starting
- [ ] All callers identified and updated
- [ ] Old code deleted
- [ ] `pnpm typecheck` passes
- [ ] No stale imports
