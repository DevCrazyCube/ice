# Skill: Frontend Dashboard

## Phase: 4 — Scaling / Agent OS

Full dashboard features are Phase 4. Do not build dashboard beyond a placeholder in earlier phases.
Read `docs/07-roadmap/current-phase.md` first.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS for styling
- SWR for client-side data fetching
- No large UI component library (no shadcn, no MUI)

## What Dashboard Serves

The dashboard is the **control plane UI** for:
- Organisation admins managing agent config, channels, knowledge, policy
- Platform admins managing provisioning and health
- It does NOT show real-time message content (privacy)

## Layout Pattern

```
apps/web/src/app/
  (auth)/                   Auth pages (login, callback)
  dashboard/
    layout.tsx              Sidebar + header shell (server component)
    page.tsx                Dashboard home / overview
    conversations/
      page.tsx              Conversation list (paginated)
      [id]/
        page.tsx            Conversation detail
    agents/
      page.tsx              Agent list
      [id]/
        page.tsx            AgentSpec editor
    channels/
      page.tsx              Channel list + status
    settings/
      page.tsx              Org settings, plan, billing
```

## Data Fetching Pattern

Server Components fetch data server-side for initial load.
Client Components use SWR for interactive or polled data.

```typescript
// Server Component — initial load
export default async function AgentsPage() {
  const agents = await apiFetch<Agent[]>("/api/v1/agents");
  return <AgentList agents={agents} />;
}

// Client Component — SWR for real-time
function useConversations() {
  return useSWR<Conversation[]>("/api/v1/conversations", fetcher);
}
```

## Auth Integration

Dashboard routes are protected. Auth context (orgId, userId, role) is available server-side via OIDC session. Never read orgId from client-side state — always from verified session.

## Rules

- No business logic in components — logic in server components or API layer
- No inline `style` props — Tailwind only
- No `any` types
- One page file per route
- Build components when needed, not speculatively
- Never render raw message content in the dashboard without sanitisation
- All API calls from server components must include auth headers
