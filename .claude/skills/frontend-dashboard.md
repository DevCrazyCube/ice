# Skill: Frontend Dashboard

## Status: Placeholder only (Foundation Phase)

Dashboard features are out of scope for the foundation phase.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS for styling
- SWR for client-side data fetching (when needed)

## Layout Pattern

```
apps/web/src/app/
  (auth)/               Auth pages (login, signup)
  dashboard/            Protected dashboard area
    layout.tsx          Sidebar + header shell
    page.tsx            Dashboard home
    conversations/
      page.tsx          Conversation list
      [id]/
        page.tsx        Conversation detail
    agents/
      page.tsx          Agent list
      [id]/
        page.tsx        Agent config
    settings/
      page.tsx          Org settings
```

## Data Fetching

- Server Components: fetch data server-side for initial page load
- Client Components: use SWR hooks for interactive/real-time data

```typescript
// Example SWR hook pattern
function useConversations(orgId: string) {
  return useSWR(`/api/v1/conversations`, fetcher);
}
```

## Rules

- No business logic in components — logic lives in hooks or server components
- No inline `style` props — use Tailwind only
- No `any` types
- One page file per route — no duplicate route implementations
- Build components when needed, not speculatively
