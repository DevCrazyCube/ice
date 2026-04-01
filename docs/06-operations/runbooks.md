# Runbooks

## Local Development Setup

### Prerequisites

- Node.js >= 20 (`node --version`)
- pnpm >= 9 (`pnpm --version`)

### First-time setup

```bash
# Install all workspace dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with local values (DATABASE_URL, etc. not required for foundation)
```

### Start the API

```bash
cd apps/api
pnpm dev
# Server starts on http://localhost:3001
```

### Start the web app

```bash
cd apps/web
pnpm dev
# App starts on http://localhost:3000
```

### Start both (from root)

```bash
pnpm dev
```

---

## Health Check

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"2024-..."}
```

If this fails:
1. Check the API is running: `ps aux | grep node`
2. Check for port conflicts: `lsof -i :3001`
3. Check for TypeScript errors: `cd apps/api && pnpm typecheck`

---

## Build

```bash
# Build all packages and apps
pnpm build

# Build a specific app
cd apps/api && pnpm build
cd apps/web && pnpm build
```

---

## Type Checking

```bash
# Check all packages
pnpm typecheck

# Check a specific package
cd apps/api && pnpm typecheck
```

---

## Adding Environment Variables

1. Add the variable to `.env.example` with a placeholder value and a comment
2. Add it to `apps/api/src/lib/config.ts` (or the relevant app config)
3. Document it in the relevant runbook section
4. Never commit the actual value

---

## Troubleshooting

### `pnpm install` fails
- Check Node.js version: must be >= 20
- Check pnpm version: must be >= 9
- Delete `node_modules` and `pnpm-lock.yaml`, then retry

### TypeScript errors after adding a package
- Run `pnpm install` from root to update workspace links
- Check that the package's `tsconfig.json` extends `../../tsconfig.base.json`

### Port already in use
```bash
lsof -i :3001  # Find process using port 3001
kill -9 <PID>  # Kill it
```
