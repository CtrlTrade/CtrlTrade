import { sql } from "drizzle-orm";
import { db, quotesTable, jobsTable } from "@workspace/db";

async function nextSequence(tenantId: string, prefix: string, table: typeof quotesTable | typeof jobsTable): Promise<string> {
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
