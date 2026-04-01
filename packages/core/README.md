# @ice/core

Shared infrastructure primitives for the ICE platform.

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| `db` | Placeholder | Postgres connection pool, tenant-scoped query helpers |
| `queue` | Placeholder | Redis-based job queue client |
| `telemetry` | Placeholder | Metrics and tracing |
| `security` | Placeholder | HMAC verification, token utilities, tenant guards |

## Rules

- All db queries must accept and enforce `organization_id`
- No module here should import from `apps/`
- Implement only when the consuming feature requires it
