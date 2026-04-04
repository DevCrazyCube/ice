# Skill: Refactor — Delete First

## The Principle

When making a change, delete the replaced code before adding new code.

Do not leave both the old and new implementation in place. Do not create a `legacy/` folder. Do not add deprecation comments that persist indefinitely.

## Process

1. **Understand what the current code does** — read it fully before touching it
2. **Identify what will be replaced** — not just modified, but rendered unnecessary
3. **Delete the replaced code first** — remove it before or alongside the new implementation
4. **Verify nothing else depends on deleted code** — search for all usages
5. **Write the replacement** — clean, minimal, no backward compat shims

## When Refactoring a Module

```bash
# Find all imports of the file you're changing
grep -r "from.*old-module" apps/ packages/
```

Update every import. Do not leave stale imports pointing at deleted files.

## When Renaming

Replace all occurrences — don't add an alias that re-exports the old name.

## Rules

- If the old code is truly replaced, delete it
- If you're unsure whether something is used, search before deleting
- Leaving dead code is a form of technical debt — it confuses future Claude sessions
- When in doubt: delete and let TypeScript tell you if something breaks
