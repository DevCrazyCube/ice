# Command: add-dashboard-feature

## Phase: 4 — Scaling / Agent OS

Dashboard features are out of scope until Phase 4. Do not add dashboard features in Phases 1–3.
Read `docs/07-roadmap/current-phase.md` first.

## What Dashboard Features Are

- Agent configuration UI (AgentSpec editor)
- Conversation list and detail views
- Channel management
- Organisation settings and billing
- Platform admin views

## Steps

1. **Identify the route** — where does this feature live in `apps/web/src/app/dashboard/`?
2. **Create the page** as a Server Component if possible (data fetched server-side)
3. **Add the API endpoint** to `apps/api` if new data is needed (see `add-endpoint.md`)
4. **Add a Client Component with SWR** only if the feature requires interactive or real-time data

## Page Template (Server Component)

```typescript
// apps/web/src/app/dashboard/agents/page.tsx
import { cookies } from "next/headers";

export default async function AgentsPage() {
  // Fetch data server-side using session token
  const token = cookies().get("session")?.value;
  const res = await fetch(`${process.env.API_URL}/api/v1/agents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const { data: agents } = await res.json();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Agents</h1>
      {/* Render agents */}
    </main>
  );
}
```

## Client Component with SWR

```typescript
"use client";
import useSWR from "swr";

export function ConversationList() {
  const { data, isLoading } = useSWR("/api/v1/conversations", fetcher);
  if (isLoading) return <div>Loading…</div>;
  return <ul>{data?.data.map((c) => <li key={c.id}>{c.id}</li>)}</ul>;
}
```

## Rules

- No business logic in components — logic in server components or API layer
- Use Tailwind for all styles — no inline `style` props
- One page file per route
- TypeScript strict — no `any`
- Fetch data at the page level, pass down as props
- Never render raw user message content without sanitisation
- Auth context (orgId, role) always from server-side session — never from client state
