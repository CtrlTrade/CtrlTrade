---
name: Orval schema naming convention
description: How to name OpenAPI component schemas to avoid TS2308 duplicate export collisions with orval-generated names
---

Orval auto-names inline requestBody schemas from operationIds, e.g. operationId `createContract` → `CreateContractBody`.

**Rule:** Never use the same name as what orval would auto-generate. Use entity-shaped names with `Input` or `Payload` suffix (e.g. `ContractCreateInput`, `LeadWebhookPayload`, not `CreateContractBody`).

**Why:** Orval emits `export type CreateContractBody = ...` AND the component schema also exports the same name → TS2308 duplicate identifier error in typecheck.

**Also:** lib/api-zod/src/index.ts must use `export type * from './generated/types'` (not `export *`) to avoid re-export conflicts when generated types overlap.

**Check after merges:** Always scan openapi.yaml for schema names that match orval's `Create<Entity>Body` / `Update<Entity>Body` / `Get<Entity>Response` / `List<Entity>Response` patterns.
