---
name: DB migration pattern
description: How to apply schema changes in this environment — drizzle-kit push requires TTY so always use raw psql
---

drizzle-kit push fails with "Interactive prompts require a TTY terminal" in post-merge scripts and CI.

**Rule:** Always apply schema changes via `psql "$DATABASE_URL" -c "..." ` or a heredoc.

**Why:** The drizzle-kit push command tries to interactively resolve table conflicts. The post-merge setup script runs non-interactively so it always hits this error. The error is logged to stderr but the script exits non-zero silently — so the DB is never updated automatically after merges.

**How to apply:** After task agent merges that change lib/db/src/schema/index.ts, check which new tables/columns are defined in the schema but not in the live DB, then write and run the DDL directly via psql.

**Key pattern for catching up:** Compare `\dt` output vs pgTable definitions in schema. For columns, compare `\d <table>` vs the table definition. Then run CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS.
