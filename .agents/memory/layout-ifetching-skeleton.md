---
name: Layout isFetching skeleton blank screen
description: Including isFetching in AppLayout/AdminLayout early-return skeleton condition causes blank screen after login in React Query apps.
---

## Rule

Never include `isFetching` in the "show skeleton" condition of a layout that wraps the entire authenticated app. Only use `isLoading`.

```typescript
// WRONG — shows skeleton on every background refetch:
if (isLoading || isFetching || unauthorized || !session) return <Skeleton />;

// CORRECT — shows skeleton only on first load:
if (isLoading || unauthorized || !session) return <Skeleton />;
```

Keep `isFetching` in the `unauthorized` guard so a background refetch doesn't trigger a false redirect to login:
```typescript
const unauthorized = !isLoading && !isFetching && (!session || !session.tenant);
```

**Why:** React Query's default `staleTime: 0` marks cached data stale immediately. When a layout mounts after login (even with a seeded cache from `qc.setQueryData`), it triggers a background refetch → `isFetching: true` from the first render. If that flag gates the skeleton, the user sees blank screen for the entire refetch duration (100–500ms), then the full dashboard appears — which users describe as "blank screen after login."

**How to apply:** Any layout component (AppLayout, AdminLayout, PortalLayout, etc.) that uses `useGetSession()` and returns a skeleton while loading must use this pattern. Check after every layout refactor.
