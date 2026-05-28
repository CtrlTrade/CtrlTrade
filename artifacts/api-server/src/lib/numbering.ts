import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Atomic per-tenant quote number sequence.
 * Increments `tenants.quote_number_seq` and returns the new Q-#### value.
 */
export async function nextQuoteNumber(tenantId: string): Promise<string> {
  const rows = await db.execute<{ quote_number_seq: number }>(sql`
    UPDATE tenants
    SET quote_number_seq = quote_number_seq + 1
    WHERE id = ${tenantId}
    RETURNING quote_number_seq
  `);
  const n = (rows as any).rows?.[0]?.quote_number_seq ?? (rows as any)[0]?.quote_number_seq ?? 1;
  return `Q-${String(n).padStart(4, "0")}`;
}

/**
 * Atomic per-tenant job number sequence.
 * Increments `tenants.job_number_seq` and returns the new J-#### value.
 */
export async function nextJobNumber(tenantId: string): Promise<string> {
  const rows = await db.execute<{ job_number_seq: number }>(sql`
    UPDATE tenants
    SET job_number_seq = job_number_seq + 1
    WHERE id = ${tenantId}
    RETURNING job_number_seq
  `);
  const n = (rows as any).rows?.[0]?.job_number_seq ?? (rows as any)[0]?.job_number_seq ?? 1;
  return `J-${String(n).padStart(4, "0")}`;
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
