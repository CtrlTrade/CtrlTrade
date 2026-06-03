#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# platform_settings table (task: configurable POS download links)
psql "$DATABASE_URL" -c "
  CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
"
