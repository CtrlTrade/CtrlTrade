# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

### Schema changes must be published to reach production

The Drizzle schema in `lib/db/src/schema/index.ts` is the single source of truth. When you merge a schema change, this is what happens:

| Step | When | What runs | Target DB |
|---|---|---|---|
| 1 | Task merges | `scripts/post-merge.sh` → `pnpm --filter db push` | **Dev only** |
| 2 | You click Publish | Replit diffs dev vs prod, shows rename warnings, applies SQL | **Production** |

**Checklist after every schema change:**

1. Merge the task (post-merge script pushes to dev automatically).
2. Verify the feature works in development.
3. **Re-publish the app** — the Publish flow computes a SQL diff between dev and production and applies it. If any column/table was renamed, you will see a confirmation prompt (renaming without confirming is treated as drop + add and will lose data).

**What NOT to do:**

- Do not add `CREATE TABLE`/`ALTER TABLE` DDL to `post-merge.sh` or application startup — the Publish flow owns production schema.
- Do not run `drizzle-kit push` or raw `psql` DDL against the production connection string.
- Do not modify the build/deploy command to run schema mutations — it runs on every deploy and is unsafe.

See [Replit Production Databases docs](https://docs.replit.com/cloud-services/storage-and-databases/production-databases) for more detail.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
