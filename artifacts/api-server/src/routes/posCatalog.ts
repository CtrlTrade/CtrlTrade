import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  productCategoriesTable,
  stockLocationsTable,
  branchStockTable,
  stockMovementsTable,
  suppliersTable,
  supplierOrdersTable,
  supplierDeliveriesTable,
  tradeAccountsTable,
  cashDrawersTable,
  inventoryAdjustmentsTable,
  type Product,
  type Supplier,
  type SupplierOrder,
  type TradeAccount,
  type StockLocation,
  type CashDrawer,
  type ProductCategory,
} from "@workspace/db";
import {
  ProductInput,
  ProductCategoryInput,
  StockLocationInput,
  StockAdjustmentInput,
  StockTransferInput,
  SupplierInput,
  SupplierOrderInput,
  SupplierDeliveryInput,
  TradeAccountInput,
  CashDrawerInput,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { applyStockDelta, totalStock } from "../lib/posStock";

const router: IRouter = Router();

// ---- serializers ---------------------------------------------------------
function serializeLocation(l: StockLocation) {
  return {
    id: l.id,
    name: l.name,
    kind: l.kind,
    code: l.code,
    addressLine1: l.addressLine1,
    city: l.city,
    postcode: l.postcode,
    isDefault: l.isDefault,
    archived: l.archived,
    createdAt: l.createdAt.toISOString(),
  };
}

function serializeCategory(c: ProductCategory) {
  return {
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
  };
}

function serializeSupplier(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    accountReference: s.accountReference,
    paymentTermsDays: s.paymentTermsDays,
    notes: s.notes,
    archived: s.archived,
    createdAt: s.createdAt.toISOString(),
  };
}

function serializeTradeAccount(t: TradeAccount) {
  return {
    id: t.id,
    customerId: t.customerId,
    accountCode: t.accountCode,
    name: t.name,
    email: t.email,
    phone: t.phone,
    pricingTier: t.pricingTier,
    discountPct: t.discountPct,
    creditLimitPence: t.creditLimitPence,
    balancePence: t.balancePence,
    paymentTermsDays: t.paymentTermsDays,
    archived: t.archived,
    createdAt: t.createdAt.toISOString(),
  };
}

function serializeCashDrawer(c: CashDrawer, locationName: string | null = null) {
  return {
    id: c.id,
    locationId: c.locationId,
    locationName,
    name: c.name,
    deviceCode: c.deviceCode,
    refundApprovalPin: c.refundApprovalPin,
    archived: c.archived,
    createdAt: c.createdAt.toISOString(),
  };
}

async function serializeProduct(
  p: Product,
  extras: { categoryName?: string | null; supplierName?: string | null; totalStock?: number } = {},
) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    categoryName: extras.categoryName ?? null,
    sku: p.sku,
    name: p.name,
    description: p.description,
    unit: p.unit,
    pricePence: p.pricePence,
    costPence: p.costPence,
    tradePricePence: p.tradePricePence,
    vatRatePct: p.vatRatePct,
    barcode: p.barcode,
    trackStock: p.trackStock,
    reorderLevel: p.reorderLevel,
    reorderQty: p.reorderQty,
    supplierId: p.supplierId,
    supplierName: extras.supplierName ?? null,
    archived: p.archived,
    totalStock: extras.totalStock ?? 0,
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeSupplierOrder(o: SupplierOrder, supplierName: string) {
  return {
    id: o.id,
    supplierId: o.supplierId,
    supplierName,
    locationId: o.locationId,
    number: o.number,
    status: o.status,
    items: o.items,
    subtotalPence: o.subtotalPence,
    notes: o.notes,
    expectedAt: o.expectedAt?.toISOString() ?? null,
    sentAt: o.sentAt?.toISOString() ?? null,
    receivedAt: o.receivedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

// ============================================================================
// Categories
// ============================================================================
router.get("/v1/pos-catalog/categories", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(productCategoriesTable)
    .where(eq(productCategoriesTable.tenantId, tenantId))
    .orderBy(productCategoriesTable.sortOrder, productCategoriesTable.name);
  res.json(rows.map(serializeCategory));
});

router.post("/v1/pos-catalog/categories", requireTenant, async (req, res): Promise<void> => {
  const parsed = ProductCategoryInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .insert(productCategoriesTable)
    .values({ tenantId, name: parsed.data.name, sortOrder: parsed.data.sortOrder ?? 0 })
    .returning();
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.category.created", message: `Category created: ${row.name}` });
  res.status(201).json(serializeCategory(row));
});

// ============================================================================
// Stock locations
// ============================================================================
router.get("/v1/pos-catalog/stock-locations", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(stockLocationsTable)
    .where(eq(stockLocationsTable.tenantId, tenantId))
    .orderBy(desc(stockLocationsTable.isDefault), stockLocationsTable.name);
  res.json(rows.map(serializeLocation));
});

router.post("/v1/pos-catalog/stock-locations", requireTenant, async (req, res): Promise<void> => {
  const parsed = StockLocationInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  if (parsed.data.isDefault) {
    await db.update(stockLocationsTable).set({ isDefault: false }).where(eq(stockLocationsTable.tenantId, tenantId));
  }
  const [row] = await db
    .insert(stockLocationsTable)
    .values({ tenantId, ...parsed.data })
    .returning();
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.stockLocation.created", message: `Location created: ${row.name}` });
  res.status(201).json(serializeLocation(row));
});

// ============================================================================
// Products
// ============================================================================
router.get("/v1/pos-catalog/products", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      p: productsTable,
      categoryName: productCategoriesTable.name,
      supplierName: suppliersTable.name,
      totalStock: sql<number>`coalesce(sum(${branchStockTable.qty}), 0)::int`,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productCategoriesTable.id, productsTable.categoryId))
    .leftJoin(suppliersTable, eq(suppliersTable.id, productsTable.supplierId))
    .leftJoin(branchStockTable, eq(branchStockTable.productId, productsTable.id))
    .where(eq(productsTable.tenantId, tenantId))
    .groupBy(productsTable.id, productCategoriesTable.name, suppliersTable.name)
    .orderBy(desc(productsTable.createdAt));
  const serialized = await Promise.all(
    rows.map(({ p, categoryName, supplierName, totalStock: ts }) =>
      serializeProduct(p, { categoryName, supplierName, totalStock: ts ?? 0 }),
    ),
  );
  res.json(serialized);
});

router.post("/v1/pos-catalog/products", requireTenant, async (req, res): Promise<void> => {
  const parsed = ProductInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  try {
    const [row] = await db
      .insert(productsTable)
      .values({ tenantId, ...parsed.data })
      .returning();
    await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.product.created", message: `Product created: ${row.sku} ${row.name}` });
    res.status(201).json(await serializeProduct(row, { totalStock: 0 }));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/v1/pos-catalog/products/:productId", requireTenant, async (req, res): Promise<void> => {
  const parsed = ProductInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, req.params.productId as string)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.product.updated", message: `Product updated: ${row.sku}` });
  res.json(await serializeProduct(row, { totalStock: await totalStock(tenantId, row.id) }));
});

router.delete("/v1/pos-catalog/products/:productId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .update(productsTable)
    .set({ archived: true })
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, req.params.productId as string)))
    .returning({ id: productsTable.id, name: productsTable.name });
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.product.archived", message: `Product archived: ${row.name}` });
  res.status(204).send();
});

// ============================================================================
// Stock — list, adjust, transfer, low
// ============================================================================
router.get("/v1/pos-catalog/stock", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const locationId = (req.query.locationId as string | undefined) ?? null;
  const where = locationId
    ? and(eq(branchStockTable.tenantId, tenantId), eq(branchStockTable.locationId, locationId))
    : eq(branchStockTable.tenantId, tenantId);
  const rows = await db
    .select({
      id: branchStockTable.id,
      locationId: branchStockTable.locationId,
      locationName: stockLocationsTable.name,
      productId: branchStockTable.productId,
      variantId: branchStockTable.variantId,
      productSku: productsTable.sku,
      productName: productsTable.name,
      qty: branchStockTable.qty,
      reorderLevel: productsTable.reorderLevel,
      binCode: branchStockTable.binCode,
      updatedAt: branchStockTable.updatedAt,
    })
    .from(branchStockTable)
    .innerJoin(stockLocationsTable, eq(stockLocationsTable.id, branchStockTable.locationId))
    .innerJoin(productsTable, eq(productsTable.id, branchStockTable.productId))
    .where(where);
  res.json(
    rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
  );
});

router.post("/v1/pos-catalog/stock/adjust", requireTenant, async (req, res): Promise<void> => {
  const parsed = StockAdjustmentInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const newQty = await applyStockDelta({
    tenantId,
    locationId: parsed.data.locationId,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId ?? null,
    qtyDelta: parsed.data.qtyDelta,
    reason: parsed.data.reason ?? "adjustment",
    note: parsed.data.note ?? null,
    actorUserId: userId,
  });
  await db.insert(inventoryAdjustmentsTable).values({
    tenantId,
    locationId: parsed.data.locationId,
    productId: parsed.data.productId,
    variantId: parsed.data.variantId ?? null,
    qtyDelta: parsed.data.qtyDelta,
    reason: parsed.data.reason ?? "adjustment",
    note: parsed.data.note ?? null,
    actorUserId: userId,
  });
  await logAudit({
    tenantId,
    actorUserId: userId,
    kind: "pos.stock.adjusted",
    message: `Stock adjusted by ${parsed.data.qtyDelta}`,
    metadata: parsed.data,
  });
  const [row] = await db
    .select({
      id: branchStockTable.id,
      locationId: branchStockTable.locationId,
      locationName: stockLocationsTable.name,
      productId: branchStockTable.productId,
      variantId: branchStockTable.variantId,
      productSku: productsTable.sku,
      productName: productsTable.name,
      qty: branchStockTable.qty,
      reorderLevel: productsTable.reorderLevel,
      binCode: branchStockTable.binCode,
      updatedAt: branchStockTable.updatedAt,
    })
    .from(branchStockTable)
    .innerJoin(stockLocationsTable, eq(stockLocationsTable.id, branchStockTable.locationId))
    .innerJoin(productsTable, eq(productsTable.id, branchStockTable.productId))
    .where(
      and(
        eq(branchStockTable.tenantId, tenantId),
        eq(branchStockTable.locationId, parsed.data.locationId),
        eq(branchStockTable.productId, parsed.data.productId),
      ),
    );
  res.json({ ...row, qty: newQty, updatedAt: row.updatedAt.toISOString() });
});

router.post("/v1/pos-catalog/stock/transfer", requireTenant, async (req, res): Promise<void> => {
  const parsed = StockTransferInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.fromLocationId === parsed.data.toLocationId) {
    res.status(400).json({ error: "From and to locations must differ" });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  let count = 0;
  for (const item of parsed.data.items) {
    await applyStockDelta({
      tenantId,
      locationId: parsed.data.fromLocationId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      qtyDelta: -item.quantity,
      reason: "transfer_out",
      note: parsed.data.note ?? null,
      actorUserId: userId,
    });
    await applyStockDelta({
      tenantId,
      locationId: parsed.data.toLocationId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      qtyDelta: item.quantity,
      reason: "transfer_in",
      note: parsed.data.note ?? null,
      actorUserId: userId,
    });
    count += item.quantity;
  }
  await logAudit({
    tenantId,
    actorUserId: userId,
    kind: "pos.stock.transferred",
    message: `Transferred ${count} units between locations`,
    metadata: parsed.data,
  });
  res.json({
    transferred: count,
    fromLocationId: parsed.data.fromLocationId,
    toLocationId: parsed.data.toLocationId,
  });
});

router.get("/v1/pos-catalog/stock/low", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      productId: productsTable.id,
      productSku: productsTable.sku,
      productName: productsTable.name,
      totalQty: sql<number>`coalesce(sum(${branchStockTable.qty}), 0)::int`,
      reorderLevel: productsTable.reorderLevel,
      reorderQty: productsTable.reorderQty,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
    })
    .from(productsTable)
    .leftJoin(branchStockTable, eq(branchStockTable.productId, productsTable.id))
    .leftJoin(suppliersTable, eq(suppliersTable.id, productsTable.supplierId))
    .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.archived, false), eq(productsTable.trackStock, true)))
    .groupBy(productsTable.id, suppliersTable.name)
    .having(sql`coalesce(sum(${branchStockTable.qty}), 0) <= ${productsTable.reorderLevel}`);
  res.json(rows);
});

// ============================================================================
// Suppliers
// ============================================================================
router.get("/v1/pos-catalog/suppliers", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.tenantId, tenantId))
    .orderBy(suppliersTable.name);
  res.json(rows.map(serializeSupplier));
});

router.post("/v1/pos-catalog/suppliers", requireTenant, async (req, res): Promise<void> => {
  const parsed = SupplierInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db.insert(suppliersTable).values({ tenantId, ...parsed.data }).returning();
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.supplier.created", message: `Supplier created: ${row.name}` });
  res.status(201).json(serializeSupplier(row));
});

router.patch("/v1/pos-catalog/suppliers/:supplierId", requireTenant, async (req, res): Promise<void> => {
  const parsed = SupplierInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .update(suppliersTable)
    .set(parsed.data)
    .where(and(eq(suppliersTable.tenantId, tenantId), eq(suppliersTable.id, req.params.supplierId as string)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(serializeSupplier(row));
});

// ============================================================================
// Supplier orders + deliveries
// ============================================================================
router.get("/v1/pos-catalog/supplier-orders", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({ o: supplierOrdersTable, supplierName: suppliersTable.name })
    .from(supplierOrdersTable)
    .innerJoin(suppliersTable, eq(suppliersTable.id, supplierOrdersTable.supplierId))
    .where(eq(supplierOrdersTable.tenantId, tenantId))
    .orderBy(desc(supplierOrdersTable.createdAt));
  res.json(rows.map(({ o, supplierName }) => serializeSupplierOrder(o, supplierName)));
});

router.post("/v1/pos-catalog/supplier-orders", requireTenant, async (req, res): Promise<void> => {
  const parsed = SupplierOrderInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const subtotal = parsed.data.items.reduce(
    (sum, it) => sum + it.quantity * it.unitCostPence,
    0,
  );
  // Generate a number — simple count-based
  const [{ c }] = await db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int + 1 AS c FROM supplier_orders WHERE tenant_id = ${tenantId}
  `).then((r) => {
    const arr = (r as unknown as { rows?: Array<{ c: number }> }).rows
      ?? (r as unknown as Array<{ c: number }>);
    return arr;
  });
  const number = `PO-${String(c).padStart(4, "0")}`;
  const [row] = await db
    .insert(supplierOrdersTable)
    .values({
      tenantId,
      supplierId: parsed.data.supplierId,
      locationId: parsed.data.locationId ?? null,
      number,
      status: "draft",
      items: parsed.data.items.map((i) => ({
        productId: i.productId,
        sku: i.sku ?? null,
        description: i.description,
        quantity: i.quantity,
        unitCostPence: i.unitCostPence,
      })),
      subtotalPence: subtotal,
      notes: parsed.data.notes ?? null,
      expectedAt: parsed.data.expectedAt ?? null,
      createdByUserId: req.auth!.user.id,
    })
    .returning();
  const [supplier] = await db
    .select({ name: suppliersTable.name })
    .from(suppliersTable)
    .where(eq(suppliersTable.id, row.supplierId));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "pos.supplierOrder.created",
    message: `Supplier order ${row.number} created`,
  });
  res.status(201).json(serializeSupplierOrder(row, supplier?.name ?? ""));
});

router.post("/v1/pos-catalog/supplier-orders/:orderId/receive", requireTenant, async (req, res): Promise<void> => {
  const parsed = SupplierDeliveryInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const [order] = await db
    .select()
    .from(supplierOrdersTable)
    .where(and(eq(supplierOrdersTable.tenantId, tenantId), eq(supplierOrdersTable.id, req.params.orderId as string)));
  if (!order) {
    res.status(404).json({ error: "Supplier order not found" });
    return;
  }
  await db.insert(supplierDeliveriesTable).values({
    tenantId,
    supplierOrderId: order.id,
    locationId: parsed.data.locationId,
    items: parsed.data.items.map((i: { productId: string; variantId?: string | null; quantity: number }) => ({
      productId: i.productId,
      variantId: i.variantId ?? null,
      quantity: i.quantity,
    })),
    notes: parsed.data.notes ?? null,
    receivedByUserId: userId,
  });
  for (const item of parsed.data.items) {
    await applyStockDelta({
      tenantId,
      locationId: parsed.data.locationId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      qtyDelta: item.quantity,
      reason: "delivery",
      refKind: "supplier_order",
      refId: order.id,
      actorUserId: userId,
    });
  }
  const [updated] = await db
    .update(supplierOrdersTable)
    .set({ status: "received", receivedAt: new Date() })
    .where(eq(supplierOrdersTable.id, order.id))
    .returning();
  const [supplier] = await db
    .select({ name: suppliersTable.name })
    .from(suppliersTable)
    .where(eq(suppliersTable.id, updated.supplierId));
  await logAudit({
    tenantId,
    actorUserId: userId,
    kind: "pos.supplierOrder.received",
    message: `Supplier order ${updated.number} received`,
  });
  res.json(serializeSupplierOrder(updated, supplier?.name ?? ""));
});

// ============================================================================
// Trade accounts
// ============================================================================
router.get("/v1/pos-catalog/trade-accounts", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(tradeAccountsTable)
    .where(eq(tradeAccountsTable.tenantId, tenantId))
    .orderBy(tradeAccountsTable.name);
  res.json(rows.map(serializeTradeAccount));
});

router.post("/v1/pos-catalog/trade-accounts", requireTenant, async (req, res): Promise<void> => {
  const parsed = TradeAccountInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  try {
    const [row] = await db
      .insert(tradeAccountsTable)
      .values({ tenantId, ...parsed.data })
      .returning();
    await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.tradeAccount.created", message: `Trade account created: ${row.name}` });
    res.status(201).json(serializeTradeAccount(row));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/v1/pos-catalog/trade-accounts/:tradeAccountId", requireTenant, async (req, res): Promise<void> => {
  const parsed = TradeAccountInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .update(tradeAccountsTable)
    .set(parsed.data)
    .where(and(eq(tradeAccountsTable.tenantId, tenantId), eq(tradeAccountsTable.id, req.params.tradeAccountId as string)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Trade account not found" });
    return;
  }
  res.json(serializeTradeAccount(row));
});

// ============================================================================
// Cash drawers
// ============================================================================
router.get("/v1/pos-catalog/cash-drawers", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({ d: cashDrawersTable, locationName: stockLocationsTable.name })
    .from(cashDrawersTable)
    .leftJoin(stockLocationsTable, eq(stockLocationsTable.id, cashDrawersTable.locationId))
    .where(eq(cashDrawersTable.tenantId, tenantId))
    .orderBy(cashDrawersTable.name);
  res.json(rows.map(({ d, locationName }) => serializeCashDrawer(d, locationName)));
});

router.post("/v1/pos-catalog/cash-drawers", requireTenant, async (req, res): Promise<void> => {
  const parsed = CashDrawerInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db.insert(cashDrawersTable).values({ tenantId, ...parsed.data }).returning();
  let locationName: string | null = null;
  if (row.locationId) {
    const [loc] = await db
      .select({ name: stockLocationsTable.name })
      .from(stockLocationsTable)
      .where(eq(stockLocationsTable.id, row.locationId));
    locationName = loc?.name ?? null;
  }
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "pos.cashDrawer.created", message: `Cash drawer created: ${row.name}` });
  res.status(201).json(serializeCashDrawer(row, locationName));
});

// Suppress unused-import warnings
void or;
void ilike;

export default router;
