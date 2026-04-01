# Runbooks

## Local Development Setup

### Prerequisites

- Node.js >= 20 (`node --version`)
- pnpm >= 9 (`pnpm --version`)

### First-time setup

```bash
pnpm install
cp .env.example .env
# Edit .env — DATABASE_URL required for Phase 1 work; REDIS_URL optional
```

### Start API (development)

```bash
cd apps/api && pnpm dev
# Server on http://localhost:3001
```

### Start web (development)

```bash
cd apps/web && pnpm dev
# App on http://localhost:3000
```

### Start both

```bash
pnpm dev  # from repo root
```

---

## Health Check

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

If this fails:
1. Check API is running: `ps aux | grep tsx`
2. Check port conflict: `lsof -i :3001`
3. Check TypeScript: `cd apps/api && pnpm typecheck`

---

## Webhook Testing (Phase 1)

> **Status: Phase 1 target — endpoint not yet implemented.** The `/webhooks/inbound/:channelType` route is a Phase 1 deliverable still in progress. When it is implemented, use the test commands below.

Testing inbound webhook locally:

```bash
# Use ngrok or similar to expose localhost
ngrok http 3001

# Test Twilio signature verification (requires real token or test fixture)
curl -X POST https://<ngrok-url>/webhooks/inbound/sms \
  -H "X-Twilio-Signature: <computed-sig>" \
  -d "From=+1234567890&Body=Hello"

# Test unsigned request → expect 401
curl -X POST http://localhost:3001/webhooks/inbound/sms \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## Build

```bash
pnpm build              # all packages and apps
cd apps/api && pnpm build
cd apps/web && pnpm build
```

## Type Check

```bash
pnpm typecheck          # all packages
cd apps/api && pnpm typecheck
```

---

## Environment Variables

### Adding a new variable

1. Add to `.env.example` with placeholder value and comment
2. Add to `apps/api/src/lib/config.ts` (or relevant app)
3. Document in this runbook
4. Never commit the actual value

### Phase 1 required variables

```
NODE_ENV=development
LOG_LEVEL=info
PORT=3001
DATABASE_URL=postgresql://...
OIDC_ISSUER=https://...
OIDC_JWKS_URL=https://.../.well-known/jwks.json
OIDC_AUDIENCE=ice-api
TWILIO_AUTH_TOKEN=...          # for webhook signature verification
PUBLIC_WEBHOOK_URL=https://... # public URL of this API (for Twilio validation)
```

### Optional Phase 1 variables

```
REDIS_URL=redis://...          # only if using Redis for rate limiting
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # OTel collector
```

---

## OpenTelemetry (Phase 1)

OTel is a Phase 1 requirement. Traces + metrics + logs export via OTLP.

Local development: run a local OTel collector (e.g. Jaeger all-in-one):

```bash
docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one
# Traces UI: http://localhost:16686
```

Core spans to verify:
- `http.ingest` — webhook received
- `outbox.enqueue` — job added to outbox
- `worker.process` — job picked up by worker

Semantic attributes on all spans:
- `tenant_id` — organisation UUID
- `conversation_id` — conversation UUID

---

## Database Migrations (Phase 1 — when implemented)

> **Status: Phase 1 target — commands not yet available.** Migration infrastructure will be implemented as part of Phase 1. The commands below document the intended interface.

```bash
# NOT YET AVAILABLE — Phase 1 target
# pnpm --filter @ice/api migrate:up
# pnpm --filter @ice/api migrate:down
# pnpm --filter @ice/api migrate:status
```

---

## Troubleshooting

### `pnpm install` fails
- Check Node.js >= 20, pnpm >= 9
- Delete `node_modules` at root, then retry

### TypeScript errors after adding a package
- Run `pnpm install` from root to update workspace symlinks
- Verify the package's `tsconfig.json` extends `../../tsconfig.base.json`

### Port already in use
```bash
lsof -i :3001 | grep LISTEN
kill -9 <PID>
```

### Webhook signature verification fails
- Confirm you are using `express.raw()` on the webhook route (not `express.json()`)
- Confirm the `PUBLIC_WEBHOOK_URL` exactly matches the URL Twilio/Stripe has on file (including protocol and path)
- Do not let any middleware modify the request body before the signature check
