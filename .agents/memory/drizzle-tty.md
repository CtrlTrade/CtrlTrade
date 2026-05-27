---
name: Drizzle TTY migrations
description: drizzle-kit push requires interactive TTY and cannot be run non-interactively.
---

## The rule
Never use `pnpm --filter @workspace/db run push` in automated scripts or agent tool calls. It requires a TTY and hangs.

## Why
drizzle-kit push prompts interactively for confirmation before applying destructive changes. Without a TTY it hangs indefinitely.

## How to apply
Apply all schema changes via raw psql SQL:
```bash
psql "$DATABASE_URL" <<'SQL'
CREATE TABLE IF NOT EXISTS ...;
SQL
```
Also add the corresponding table definition to `lib/db/src/schema/index.ts` so Drizzle ORM has the typed table reference.
