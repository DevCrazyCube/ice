# Phase 1 Validation Runbook

Prove all Phase 1 (Foundations) deliverables work end-to-end in a local-dev environment before closing Phase 1.

---

## Prerequisites

1. **Postgres running** — e.g. `docker compose up db` or local install
2. **Root `.env` configured** — must contain at minimum:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ice
   SESSION_SECRET=<at-least-32-characters-long-secret-key>
   ```
3. **Migrations applied**:
   ```bash
   pnpm --filter @ice/api migrate
   ```
4. **API running**:
   ```bash
   pnpm --filter @ice/api dev
   ```

---

## Step 1: Seed Data

```bash
pnpm --filter @ice/api seed
```

Expected output: `Seed applied.`

This inserts (idempotent):

| Entity | UUID | Details |
|--------|------|---------|
| Organisation | `a0000000-…-000000000001` | Seed Corp |
| User | `b0000000-…-000000000001` | admin@seed-corp.local |
| user_role | `e0000000-…-000000000001` | org_admin role |
| Agent | `c0000000-…-000000000001` | Seed Inbound Agent (active) |
| Channel | `d0000000-…-000000000001` | SMS / Twilio |

---

## Step 2: Generate Session Token

```bash
TOKEN=$(pnpm --filter @ice/api generate-token 2>/dev/null)
echo $TOKEN
```

This creates an 8-hour session JWT signed with `SESSION_SECRET`, containing the seed user's org, roles, and identity claims.

---

## Step 3: Validate Routes

### 3.1 Health Check (public)

```bash
curl -s http://localhost:3001/health | jq .
```

Expected:
```json
{ "status": "ok", "db": true, "timestamp": "2026-…" }
```

### 3.2 Unauthenticated Request → 401

```bash
curl -s http://localhost:3001/api/v1/channels | jq .
```

Expected:
```json
{ "error": { "code": "UNAUTHORIZED" } }
```

### 3.3 GET Channels (org_admin) → 200

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/channels | jq .
```

Expected: `200` with `data` array containing the seed SMS channel.

### 3.4 POST Channel (org_admin) → 201

```bash
curl -s -X POST http://localhost:3001/api/v1/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"c0000000-0000-0000-0000-000000000001","type":"web","provider":"custom"}' \
  | jq .
```

Expected: `201` with `data` object containing the new channel.

### 3.5 POST Channel with Wrong Agent → 404

```bash
curl -s -X POST http://localhost:3001/api/v1/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"00000000-0000-0000-0000-000000000000","type":"sms","provider":"twilio"}' \
  | jq .
```

Expected:
```json
{ "error": { "code": "NOT_FOUND", "message": "Agent not found" } }
```

### 3.6 Logout → 200

```bash
curl -s -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected:
```json
{ "success": true }
```

### 3.7 Login (OIDC not configured) → 503

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/auth/login
```

Expected: `503` (OIDC vars not set in local dev).

### 3.8 Webhook — Missing Signature → 401

```bash
curl -s -X POST \
  http://localhost:3001/webhooks/inbound/d0000000-0000-0000-0000-000000000001 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM1234&Body=hello" | jq .
```

Expected:
```json
{ "error": { "code": "INVALID_SIGNATURE" } }
```

### 3.9 Webhook — Unknown Channel → 404

```bash
curl -s -X POST \
  http://localhost:3001/webhooks/inbound/00000000-0000-0000-0000-000000000000 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM1234&Body=hello" | jq .
```

Expected:
```json
{ "error": { "code": "CHANNEL_NOT_FOUND" } }
```

### 3.10 Webhook — Invalid UUID → 404

```bash
curl -s -X POST \
  http://localhost:3001/webhooks/inbound/not-a-uuid \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM1234&Body=hello" | jq .
```

Expected:
```json
{ "error": { "code": "CHANNEL_NOT_FOUND" } }
```

---

## Step 4: Verify DB State

```sql
-- Seed data present
SELECT id, name, slug FROM organisations WHERE id = 'a0000000-0000-0000-0000-000000000001';
SELECT id, email FROM users WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT u.email, r.name AS role FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.organisation_id = 'a0000000-0000-0000-0000-000000000001';
SELECT id, type, name, status FROM agents WHERE id = 'c0000000-0000-0000-0000-000000000001';
SELECT id, type, provider FROM channels WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- Audit events written
SELECT action, resource_type, created_at FROM audit_events
  ORDER BY created_at DESC LIMIT 10;
```

---

## Summary Checklist

- [ ] `GET /health` → `{ "status": "ok", "db": true }`
- [ ] `GET /api/v1/channels` without token → 401
- [ ] `GET /api/v1/channels` with token → 200 with seed channel
- [ ] `POST /api/v1/channels` with token → 201 creates new channel
- [ ] `POST /api/v1/channels` with cross-org agent → 404
- [ ] `POST /auth/logout` with token → 200
- [ ] `GET /auth/login` without OIDC config → 503
- [ ] `POST /webhooks/inbound/:channelId` without signature → 401
- [ ] `POST /webhooks/inbound/:channelId` with unknown channel → 404
- [ ] `POST /webhooks/inbound/not-a-uuid` → 404
- [ ] Audit events present in `audit_events` table
- [ ] Seed data present in all tables

---

## Phase 1 Closure

When all checks pass, Phase 1 (Foundations) is validated and ready to close. Update `docs/07-roadmap/current-phase.md` to reflect Phase 1 completion and begin Phase 2 (Agent Capabilities).
