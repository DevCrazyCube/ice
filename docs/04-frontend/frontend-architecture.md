# Frontend Architecture

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **Package:** `apps/web`

No large UI component library. No shadcn, no MUI, no Chakra in the foundation phase.

---

## Directory Structure

```
apps/web/src/
  app/
    layout.tsx          Root layout (HTML shell, global CSS)
    page.tsx            Homepage
    dashboard/
      page.tsx          Dashboard placeholder
    (auth)/             Future: login, signup pages
    api/                Future: Next.js API routes if needed
```

---

## Routing

Next.js App Router is used exclusively. No Pages Router.

Route groups `(name)/` are used to share layouts without affecting the URL.

---

## Data Fetching

- Server Components fetch data directly (future, via API calls to `apps/api`)
- Client Components use SWR or React Query (future, when interactive data is needed)
- No data fetching logic exists in the foundation phase

---

## Styling Rules

- Use Tailwind utility classes for all styles
- No inline `style` props
- No CSS Modules (unless a specific use case requires it)
- No styled-components or emotion

---

## Rules

1. **No business logic in components.** Data fetching and transformation happen in server components or dedicated hooks.
2. **No large component systems.** Build components when they are needed, not speculatively.
3. **No duplicate page implementations.** One route = one page file.
4. **TypeScript strict mode.** All components must be fully typed.
5. **No `any` types.** If a type is unknown, use `unknown` and narrow it.
