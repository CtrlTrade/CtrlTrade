---
name: Tenant foreign-ID ownership checks
description: Tenant write endpoints must verify ownership of any client-supplied foreign IDs (branchId, licenceId, etc.) before persisting them.
---

Tenant-scoped write routes (`requireTenant`) must verify that every client-supplied
foreign key (`branchId`, `licenceId`, and similar references to other tenant-owned
rows) actually belongs to the current tenant before inserting/updating. Look it up by
`(tenantId, id)` and reject with 400 on mismatch.

**Why:** FKs in `lib/db/src/schema/index.ts` are global (e.g. `branch_id -> branches.id`),
not composite tenant-scoped FKs. So a valid UUID from *another* tenant passes the DB
constraint and silently crosses the tenant boundary (IDOR-class broken access control).
Resolving a record by a tenant-scoped *key* (e.g. licence key) is safe, but trusting a
raw `id` from the request body is not.

**How to apply:** Add small `ownsX(tenantId, id)` helpers (null/undefined → allowed) and
call them in every POST/PATCH that writes a foreign id. See `ownsBranch`/`ownsLicence`
in `artifacts/api-server/src/routes/posLicences.ts` for the pattern.
