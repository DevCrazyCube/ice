# Skill: DB Schema Design

## Core Rules

1. **Every business table must have `organisation_id UUID NOT NULL`**
2. Use UUIDs for all primary keys (`gen_random_uuid()`)
3. Every table must have `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
4. Mutable tables must have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
5. Foreign keys must have explicit `ON DELETE` behavior

## Naming Conventions

- Tables: `snake_case`, plural (e.g., `conversations`, `audit_logs`)
- Columns: `snake_case`
- Indexes: `idx_<table>_<columns>`
- Foreign keys: `fk_<table>_<ref_table>`

## Migrations

- One file per migration: `YYYYMMDDHHMMSS_description.sql`
- Migrations are append-only — never modify an existing migration
- Each migration must be idempotent when possible (`CREATE TABLE IF NOT EXISTS`)
- Include both `up` and rollback comments

## Tenant Isolation

```sql
-- Every query must include this filter
WHERE organisation_id = $1
```

Never write a query that selects across organisations. Not even for admin purposes — use a separate admin query function that is clearly marked.

## Anti-Patterns

- UUIDs stored as strings (use UUID type)
- Missing `organisation_id` on business tables
- Nullable columns that are always set
- Storing JSON where relational structure is appropriate
- Missing indexes on foreign keys
