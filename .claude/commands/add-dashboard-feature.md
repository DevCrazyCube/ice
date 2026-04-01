# Command: add-dashboard-feature

## Status: Dashboard features are out of scope (Foundation Phase)

Do not add dashboard features until Phase 6.

## Future Steps

1. **Identify the route** — where does this feature live in `apps/web/src/app/dashboard/`?
2. **Create the page or component** — server component if possible
3. **Add the API route** to `apps/api` if new data is needed
4. **Connect with SWR** if the feature needs real-time or client-side updates

## Page Template (Server Component)

```typescript
// apps/web/src/app/dashboard/my-feature/page.tsx
import { getServerSession } from "next-auth"; // future

export default async function MyFeaturePage() {
  // Fetch data server-side
  const data = await fetch("/api/v1/my-resource", {
    headers: { Authorization: `Bearer ${session.token}` },
  }).then((r) => r.json());

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My Feature</h1>
      {/* Render data */}
    </main>
  );
}
```

## Rules

- No business logic in components
- Use Tailwind for all styles — no inline `style` props
- One page file per route
- TypeScript strict — no `any`
- Fetch data at the page level, pass down as props
