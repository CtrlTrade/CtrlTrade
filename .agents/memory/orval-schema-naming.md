---
name: Orval schema naming convention
description: How to name OpenAPI component schemas to avoid TS2308 duplicate export collisions in api-zod.
---

## The rule
OpenAPI component schema names must use the `Input` suffix (e.g. `TimesheetEntryInput`, `UpdateTimesheetEntryInput`) rather than matching Orval's operation-derived names (e.g. `CreateTimesheetEntryBody`).

## Why
Orval generates two outputs:
1. `lib/api-zod/src/generated/api.ts` — Zod validators named after the operation (e.g. `createTimesheetEntry` → `CreateTimesheetEntryBody`)
2. `lib/api-zod/src/generated/types/<name>.ts` — TypeScript interfaces named after the component schema

`lib/api-zod/src/index.ts` re-exports both via `export *`. If a component schema name matches the operation-derived Zod name, TypeScript raises TS2308 ("has already exported a member").

## How to apply
- Name request-body component schemas with an `Input` suffix: `TimesheetEntryInput` not `CreateTimesheetEntryBody`
- The operation-derived Zod validator (`CreateTimesheetEntryBody`) and the TypeScript interface (`TimesheetEntryInput`) then have different names and coexist without conflict
- Existing working examples: `CheckinInput`, `CheckoutInput`, `ProductInput`, `SupplierOrderInput`
