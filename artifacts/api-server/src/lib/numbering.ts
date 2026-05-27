import { sql } from "drizzle-orm";
import { db, quotesTable, jobsTable, invoicesTable } from "@workspace/db";

async function nextSequence(tenantId: string, prefix: string, table: typeof quotesTable | typeof jobsTable | typeof invoicesTable): Promise<string> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table as any)
    .where(sql`tenant_id = ${tenantId}`);
  const n = (count ?? 0) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export async function nextQuoteNumber(tenantId: string): Promise<string> {
  return nextSequence(tenantId, "Q", quotesTable);
}

export async function nextJobNumber(tenantId: string): Promise<string> {
  return nextSequence(tenantId, "J", jobsTable);
}

/**
 * Atomic per-tenant invoice number sequence.
 * Increments `tenants.invoice_number_seq` and returns the new INV-#### value.
 */
export async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const rows = await db.execute<{ invoice_number_seq: number }>(sql`
    UPDATE tenants
    SET invoice_number_seq = invoice_number_seq + 1
    WHERE id = ${tenantId}
    RETURNING invoice_number_seq
  `);
  const n = (rows as any).rows?.[0]?.invoice_number_seq ?? (rows as any)[0]?.invoice_number_seq ?? 1;
  return `INV-${String(n).padStart(4, "0")}`;
}
