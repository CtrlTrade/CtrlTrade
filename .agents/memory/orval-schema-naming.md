---
name: Orval schema naming convention
description: How to name OpenAPI component schemas to avoid TS2308 duplicate export collisions in api-zod. Also covers the YAML duplicate key issue that silently breaks codegen.
---

## The rule
OpenAPI component schema names must use the `Input` suffix (e.g. `TimesheetEntryInput`, `UpdateTimesheetEntryInput`) rather than matching Orval's operation-derived names (e.g. `CreateTimesheetEntryBody`).

For response schemas, use a distinct name that doesn't match the operationId-derived Zod wrapper name. E.g. for `listStaffNotifications` (operationId), do NOT name the component schema `ListStaffNotificationsResponse` — name it `StaffNotificationsList` instead.

## Why
Orval generates two outputs:
1. `lib/api-zod/src/generated/api.ts` — Zod validators named after the operation (e.g. `listStaffNotifications` → `ListStaffNotificationsResponse`)
2. `lib/api-zod/src/generated/types/<name>.ts` — TypeScript interfaces named after the component schema

`lib/api-zod/src/index.ts` re-exports both via `export *`. If a component schema name matches the operation-derived Zod name, TypeScript raises TS2308 ("has already exported a member").

## YAML duplicate keys break codegen silently
`@scalar/json-magic` (used by orval internally) calls `normalize()` which calls yaml `parse()`. If openapi.yaml has **duplicate top-level keys** under `components.schemas`, `yaml.parse` throws "Map keys must be unique" and the `readFiles` plugin returns `{ ok: false }`. This makes orval fail with the cryptic error "Failed to resolve input: Please provide a valid string value or pass a loader to process the input".

**Always verify there are no duplicate schema names in openapi.yaml before running codegen.**

## How to apply
- Name request-body component schemas with an `Input` suffix: `TimesheetEntryInput` not `CreateTimesheetEntryBody`
- For response schemas, use a different noun form: `StaffNotificationsList` not `ListStaffNotificationsResponse`; `StaffNotificationsUnreadCount` not `GetStaffNotificationsUnreadCountResponse`
- The operation-derived Zod validator and the TypeScript interface then have different names and coexist without conflict
- Existing working examples: `CheckinInput`, `CheckoutInput`, `ProductInput`, `SupplierOrderInput`, `StaffNotificationsList`, `StaffNotificationsUnreadCount`
