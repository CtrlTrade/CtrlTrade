/**
 * purge-platform-sales-leads.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off GDPR purge: permanently deletes all rows from platform_sales_leads.
 *
 * WHY a full-table delete is correct here
 * ────────────────────────────────────────
 * The platform_sales_leads table was used exclusively to store contacts from
 * cold-outreach campaigns (real business names, email addresses, phone numbers
 * scraped/imported from external sources).  Every row in the table is a real
 * person or business — there are no synthetic test rows.  Retaining any of them
 * is unnecessary under GDPR Article 5(1)(e) (storage limitation).  The decision
 * is: purge the entire table.
 *
 * Usage
 * ──────
 *   # Preview only — prints row count and IDs, nothing deleted:
 *   pnpm --filter @workspace/scripts run purge:sales-leads
 *
 *   # Execute the deletion (requires explicit --confirm flag):
 *   pnpm --filter @workspace/scripts run purge:sales-leads -- --confirm
 *
 *   # Against production:
 *   DATABASE_URL=<prod-url> pnpm --filter @workspace/scripts run purge:sales-leads -- --confirm
 *
 * Safety properties
 * ─────────────────
 *   - Defaults to preview mode; --confirm must be passed explicitly to delete.
 *   - Preview output contains only UUIDs, source, and status — no PII fields
 *     (name/email/phone) are logged to avoid secondary exposure in terminal history.
 *   - Deletion runs inside a transaction; on failure the DB rolls back cleanly.
 *   - Prints a verified post-delete count to confirm the table is empty.
 */

import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  console.log("=== platform_sales_leads GDPR purge ===\n");

  if (!CONFIRM) {
    console.log("Preview mode — pass --confirm to execute the deletion.\n");
  }

  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS total FROM platform_sales_leads`,
  );
  const total = (countResult.rows[0] as { total: number }).total;

  if (total === 0) {
    console.log("platform_sales_leads is already empty — nothing to do.");
    await pool.end();
    process.exit(0);
  }

  // List IDs and source/status only — intentionally no name/email/phone in logs
  // to avoid creating a secondary record of the personal data being purged.
  const idResult = await db.execute(
    sql`SELECT id, source, status, created_at
        FROM platform_sales_leads
        ORDER BY created_at`,
  );

  console.log(`Found ${total} row(s) targeted for deletion:\n`);
  console.log(
    (
      idResult.rows as Array<{
        id: string;
        source: string;
        status: string;
        created_at: Date;
      }>
    )
      .map(
        (r, i) =>
          `  ${i + 1}. id=${r.id}  source=${r.source}  status=${r.status}  created=${new Date(r.created_at).toISOString().slice(0, 10)}`,
      )
      .join("\n"),
  );
  console.log();

  if (!CONFIRM) {
    console.log("Re-run with --confirm to permanently delete these rows.");
    await pool.end();
    process.exit(0);
  }

  // Wrap in a transaction so a partial failure leaves the DB unchanged.
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM platform_sales_leads`);
  });

  // Verify the table is empty after deletion.
  const verifyResult = await db.execute(
    sql`SELECT COUNT(*)::int AS remaining FROM platform_sales_leads`,
  );
  const remaining = (verifyResult.rows[0] as { remaining: number }).remaining;

  if (remaining !== 0) {
    console.error(`ERROR: Expected 0 rows remaining but found ${remaining}. Investigate before re-running.`);
    await pool.end();
    process.exit(1);
  }

  console.log(`Deleted ${total} row(s). Verified: 0 rows remaining in platform_sales_leads.`);
  console.log("Purge complete.");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
