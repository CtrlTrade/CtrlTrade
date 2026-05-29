---
name: DB schema drift fix pattern
description: When the Drizzle schema defines a column that the live DB lacks, drizzle-kit push fails (needs TTY). Apply the column directly via raw SQL.
---

## Rule
When a column exists in the Drizzle schema (`lib/db/src/schema/index.ts`) but is missing from the live DB, use `executeSql` (code_execution) to run `ALTER TABLE … ADD COLUMN IF NOT EXISTS` rather than relying on `pnpm --filter @workspace/db run push`.

**Why:** `drizzle-kit push` requires an interactive TTY for conflict resolution prompts, which is unavailable in the agent shell. Attempting it fails with "Interactive prompts require a TTY terminal."

**How to apply:**
1. Confirm the gap with `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>'`.
2. Run `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>` via executeSql.
3. Create any required indexes with `CREATE INDEX IF NOT EXISTS …`.
4. Known past drift: `customers.branch_id UUID` was added this way.
