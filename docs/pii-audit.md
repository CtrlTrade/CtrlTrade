# PII Audit — June 2026

This document records the findings of a full sweep of the tracked repository for
personally identifiable information (PII), carried out before the initial public
release of CtrlTrade.

## Scope

- All files tracked by git (`git ls-files`), including `attached_assets/`
- Patterns searched: email addresses, UK phone numbers, personal names in CSV/JSON
  data rows, SQL fixtures

## Method

- `grep` scans across all tracked `.ts`, `.tsx`, `.js`, `.json`, `.csv`, `.sql`,
  `.yaml`, `.yml`, `.txt`, and `.md` files
- Targeted patterns: consumer-domain emails (`@gmail`, `@hotmail`, `@outlook`, etc.),
  UK phone patterns (`+44`, `07xxxxxxxxx`), and common export file types

## Findings

### Tracked files — CLEAN

No real personal data was found in any tracked (committed) file.

| Category | Finding |
|---|---|
| Consumer emails | None — all email strings in source code use `@example.com`, `you@example.com`, `.test`, or `@acme-trades.test` |
| UK phone numbers | None — phone strings in source are Ofcom reserved test-range placeholders (`+44 7700 000000`, `+447700900000`) used in UI `placeholder=` attributes only |
| CSV / SQL data fixtures | No `.csv` or `.sql` data files are tracked |
| `attached_assets/` | Contains images, PDFs, ZIPs, and pasted specification text files only — no data exports |

### Untracked PII files — already gitignored ✓

The following files exist on disk but are excluded from the repo by `.gitignore`.
They must not be committed.

| File | Contains |
|---|---|
| `attached_assets/platform-leads-exported-from-book_(3)_*.csv` | Real company names, contact names, phone numbers from early cold-outreach CRM exports |
| `leads_export.csv` | Real lead contacts (names, emails, phones) exported from the platform database |
| `scripts/src/seed-acme.ts` | Demo lead fixtures using realistic-sounding personal details |
| `scripts/src/seed-acme-extend.ts` | Demo supplier contacts with plausible names and supplier-domain emails |
| `scripts/src/seed-acme-production-api.ts` | Same demo lead fixtures as seed-acme.ts |
| `scripts/src/seed.ts` | Platform super-admin and demo tenant bootstrapping |
| `scripts/src/seed-products.ts` | Product catalogue seed (no personal data, but gitignored for consistency) |
| `scripts/src/seed-tenant-types.ts` | Tenant type configuration seed (no personal data, but gitignored for consistency) |

### Intentionally retained items

None. All items containing real personal data are excluded from the repository.

The demo lead fixtures in seed scripts (names such as "Chris Barker", emails such
as `c.barker@gmail.com`) are realistic-looking but entirely fictional. They use
Ofcom-reserved phone numbers (`+44 7700 9000xx`) and are gitignored. These should
be migrated to `@acme-trades.test` / `@example.co.uk` domain emails in a
follow-up task to remove any risk of accidentally matching a real person's address.

## `.gitignore` changes made

The following rules were added or broadened during this audit:

| Pattern | Purpose |
|---|---|
| `scripts/src/seed*.ts` | Replaces five specific seed-file entries; catches any future `seed-*.ts` script by prefix |
| `/*_export*.csv` | Catches any root-level data export with an `_export` infix |
| `/leads_export*.csv` | Retains explicit rule for the known leads export pattern |
| `attached_assets/*.csv` | Blocks all CSV files in `attached_assets/`; previously only `platform-leads-exported*.csv` was blocked |
| `attached_assets/*.json` | Blocks JSON data dumps dropped into `attached_assets/` |
