# Frontend Architecture

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **Package:** `apps/web`

No large UI component library. No shadcn, no MUI, no Chakra.

---

## Role: Control Plane UI

`apps/web` is the **control plane UI** — it serves organisation admins and platform admins who configure agents, channels, knowledge, and policy.

It does NOT:
- Process messages (data plane work)
- Make LLM calls
- Contain business logic

The data plane (webhook ingest, outbox, workers, outbound send) lives entirely in `apps/api`.

---

## Directory Structure

```
apps/web/src/
  app/
    layout.tsx            Root layout (HTML shell, global CSS)
    page.tsx              Homepage
    dashboard/            Protected control-plane area (Phase 4)
      layout.tsx          Sidebar + header shell
      page.tsx            Dashboard home
      agents/             Agent configuration
      channels/           Channel management
      conversations/      Conversation history (read-only)
      settings/           Org settings, billing
    (auth)/               Login, OIDC callback (Phase 1)
```

---

## Routing

Next.js App Router exclusively. No Pages Router.

Route groups `(name)/` share layouts without affecting the URL path.

---

## Auth Context

Auth is OIDC-based (Phase 1). Session contains verified `orgId`, `userId`, `role`.

- Never read `orgId` from client-side state — always from the verified server-side session
- Dashboard routes are server-side protected (redirect to login if no valid session)

---

## Data Fetching

- **Server Components:** fetch data server-side for initial page load, pass as props
- **Client Components:** SWR for interactive or polled data only
- No data fetching logic exists in Foundation phase — placeholder pages only

```typescript
// Server Component pattern
export default async function Page() {
  const data = await apiFetch("/api/v1/resource"); // calls apps/api
  return <Component data={data} />;
}

// Client Component pattern (Phase 4+)
function useResource() {
  return useSWR<Resource[]>("/api/v1/resource", fetcher);
}
```

---

## Styling Rules

- Tailwind utility classes for all styles
- No inline `style` props
- No CSS Modules (unless a specific use case requires it)
- No styled-components or emotion

---

## Rules

1. **No business logic in components.** Transformation and orchestration in server components or API layer.
2. **No large component systems.** Build components when needed, not speculatively.
3. **No duplicate page implementations.** One route = one page file.
4. **TypeScript strict mode.** All components fully typed, no `any`.
5. **No raw message content rendered without sanitisation.**
6. **Auth context always from server-side session** — never from URL params or client state.
