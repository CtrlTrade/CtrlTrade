---
name: requireSuperAdmin router guard scoping
description: Unscoped router.use(requireSuperAdmin) in a sub-router intercepts every request, blocking all non-super-admin users from all routes.
---

## Rule
Always use `router.use("/v1/admin", requireSuperAdmin)` — never `router.use(requireSuperAdmin)` — in any route file mounted without a path prefix in routes/index.ts.

**Why:** In Express, `router.use(subRouter)` (no prefix) sends ALL requests into the sub-router. If the sub-router then has `router.use(middleware)` (also no prefix), that middleware runs for every request in the entire app, not just the sub-router's own routes. This caused four admin route files (admin.ts, adminWorkers.ts, adminCompliance.ts, adminLeads.ts) to block all tenant users from every endpoint with "Super admin only".

**How to apply:** Whenever adding a new admin route file, use `router.use("/v1/admin", requireSuperAdmin)` so the guard only fires for paths starting with `/v1/admin`. Affected files to keep consistent: admin.ts, adminWorkers.ts, adminCompliance.ts, adminLeads.ts.
