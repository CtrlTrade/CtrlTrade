import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import {
  db,
  branchStockTable,
  stockMovementsTable,
  productsTable,
  stockLocationsTable,
} from "@workspace/db";

function variantEq(variantId: string | null | undefined): SQL {
  return variantId
    ? eq(branchStockTable.variantId, variantId)
    : isNull(branchStockTable.variantId);
}

/**
 * Adjust on-hand qty for a (location, product[, variant]) and write a movement row.
 * Returns the new qty.
 */
export async function applyStockDelta(opts: {
  tenantId: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  qtyDelta: number;
  reason: string;
  refKind?: string | null;
  refId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
}): Promise<number> {
  const {
    tenantId,
    locationId,
    productId,
    variantId = null,
    qtyDelta,
    reason,
    refKind = null,
    refId = null,
    note = null,
    actorUserId = null,
  } = opts;

  // Upsert branch_stock row
  const [existing] = await db
    .select()
    .from(branchStockTable)
    .where(
      and(
        eq(branchStockTable.tenantId, tenantId),
        eq(branchStockTable.locationId, locationId),
        eq(branchStockTable.productId, productId),
        variantEq(variantId),
      ),
    );

  let newQty: number;
  if (existing) {
    const [updated] = await db
      .update(branchStockTable)
      .set({ qty: existing.qty + qtyDelta })
      .where(eq(branchStockTable.id, existing.id))
      .returning();
    newQty = updated.qty;
  } else {
    const [created] = await db
      .insert(branchStockTable)
      .values({ tenantId, locationId, productId, variantId, qty: qtyDelta })
      .returning();
    newQty = created.qty;
  }

  await db.insert(stockMovementsTable).values({
    tenantId,
    locationId,
    productId,
    variantId,
    qtyDelta,
    reason,
    refKind,
    refId,
    note,
    actorUserId,
  });

  return newQty;
}

/** Return or auto-create a default stock location for the tenant. */
export async function getOrCreateDefaultLocation(tenantId: string): Promise<string> {
  const [defaultRow] = await db
    .select()
    .from(stockLocationsTable)
    .where(
      and(eq(stockLocationsTable.tenantId, tenantId), eq(stockLocationsTable.isDefault, true)),
    );
  if (defaultRow) return defaultRow.id;
  const [any] = await db
    .select()
    .from(stockLocationsTable)
    .where(eq(stockLocationsTable.tenantId, tenantId))
    .limit(1);
  if (any) return any.id;
  const [created] = await db
    .insert(stockLocationsTable)
    .values({ tenantId, name: "Main Shop", kind: "shop", isDefault: true })
    .returning();
  return created.id;
}

/** Sum qty across all locations for a product. */
export async function totalStock(tenantId: string, productId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${branchStockTable.qty}), 0)::int` })
    .from(branchStockTable)
    .where(
      and(eq(branchStockTable.tenantId, tenantId), eq(branchStockTable.productId, productId)),
    );
  return row?.total ?? 0;
}

/** Per-tenant atomic-ish sequence helper for POS transaction numbers. */
export async function nextPosTransactionNumber(tenantId: string): Promise<string> {
  // Collisions are caught by the unique index — caller retries on conflict.
  const result = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int + 1 AS n
    FROM pos_transactions
    WHERE tenant_id = ${tenantId}
  `);
  const rows = (result as unknown as { rows?: Array<{ n: number }> }).rows
    ?? (result as unknown as Array<{ n: number }>);
  const n = rows[0]?.n ?? 1;
  return `S-${String(n).padStart(5, "0")}`;
}

export { productsTable };
