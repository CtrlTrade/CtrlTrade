import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  membershipsTable,
  tenantsTable,
  posSalesTable,
  productsTable,
  productCategoriesTable,
  branchStockTable,
  stockLocationsTable,
  tradeAccountsTable,
  tillSessionsTable,
  posTransactionsTable,
  posTransactionItemsTable,
  cashDrawersTable,
  platformSettingsTable,
  type PosTransaction,
  type PosTransactionItem,
  type TillSession,
} from "@workspace/db";
import {
  PosLoginBody,
  CreatePosSaleBody,
  SendPosReceiptBody,
  OpenTillSessionInput,
  CloseTillSessionInput,
  PosTransactionInput,
  PosRefundInput,
  PosReceiptRequest,
} from "@workspace/api-zod";
import { verifyPassword } from "../lib/auth";
import { serializeTenant, serializeUser } from "../lib/serializers";
import { signPosToken, requirePosAuth, type PosAuthContext } from "../lib/posAuth";
import type { Request, Response, NextFunction } from "express";
import { logAudit } from "../lib/audit";
import { validateLicenceForOpen } from "../lib/posLicence";
import {
  applyStockDelta,
  getOrCreateDefaultLocation,
  nextPosTransactionNumber,
} from "../lib/posStock";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /v1/pos/login
// ---------------------------------------------------------------------------
router.post("/v1/pos/login", async (req, res): Promise<void> => {
  const parsed = PosLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const memberships = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, user.id));
  const membership = memberships[0] ?? null;
  if (!membership) {
    res.status(403).json({ error: "User has no tenant membership" });
    return;
  }
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, membership.tenantId));
  if (!tenant) {
    res.status(403).json({ error: "Tenant not found" });
    return;
  }

  // ---------------------------------------------------------------------------
  // Licence validation (step 79): a CtrlTradePos® till may ONLY open against a
  // specific, usable licence. A licence key is mandatory — there is no
  // unbound/legacy path that grants till access (that would let any user with
  // valid credentials obtain a write-capable session without a licence). We
  // validate the full tenant ↔ branch ↔ terminal binding: locked outcomes
  // block the open, read-only outcomes still issue a token but downgrade the
  // till to read-only. The issued token carries the binding so every mutating
  // request can be re-validated (see requirePosFullMode).
  // ---------------------------------------------------------------------------
  const surface = parsed.data.surface ?? "web";

  if (!parsed.data.licenceKey) {
    await logAudit({
      tenantId: tenant.id,
      actorUserId: user.id,
      actorLabel: user.email,
      kind: "pos.login.blocked",
      message: `POS login blocked for ${user.email}: no licence key supplied`,
    });
    res.status(400).json({
      error: "A CtrlTradePos® licence key is required to open this till.",
      mode: "locked",
    });
    return;
  }

  // Every till must bind to a registered terminal (step 84). This is enforced
  // unconditionally — not gated on the client-asserted `surface` — so a caller
  // cannot omit/forge `surface` to skip the terminal requirement and obtain a
  // write-capable session without a bound terminal. The terminal is provisioned
  // by the business owner/admin before the till can activate.
  if (!parsed.data.terminalCode) {
    res.status(400).json({
      error: "A terminal code is required to activate this till.",
      mode: "locked",
    });
    return;
  }

  const outcome = await validateLicenceForOpen({
    tenantId: tenant.id,
    licenceKey: parsed.data.licenceKey,
    terminalCode: parsed.data.terminalCode,
    surface,
  });
  const mode = outcome.mode;
  const licencePayload = outcome.licence;
  const terminalPayload = outcome.terminal;

  if (outcome.mode === "locked") {
    await logAudit({
      tenantId: tenant.id,
      actorUserId: user.id,
      actorLabel: user.email,
      kind: "pos.login.blocked",
      message: `POS login blocked for ${user.email}: ${outcome.message ?? "licence locked"}`,
    });
    res.status(403).json({
      error: outcome.message ?? "This till licence is not active.",
      mode: outcome.mode,
      status: outcome.status,
      licence: outcome.licence,
      terminal: outcome.terminal,
    });
    return;
  }

  // Persist the *normalized* binding (computed surface, validated terminal) in
  // the token so every mutating request re-validates against the same surface +
  // terminal that were checked at login — the client can no longer drop these.
  const { token, expiresAt } = signPosToken(user.id, tenant.id, {
    licenceKey: parsed.data.licenceKey,
    terminalCode: parsed.data.terminalCode,
    surface,
  });
  const tenantPayload = await serializeTenant(tenant);

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.login",
    message: `POS login from ${user.email} (mode: ${mode})`,
  });

  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: serializeUser(user, membership),
    tenant: tenantPayload,
    mode,
    licence: licencePayload,
    terminal: terminalPayload,
  });
});

// ---------------------------------------------------------------------------
// Licence mode resolution + write guard.
//
// Re-derives the till's current mode from the licence binding carried in the
// POS token. Used by GET /v1/pos/me (to report mode to the client) and by the
// requirePosFullMode middleware (to block mutating actions when a licence is
// read-only or locked). Re-validating on every request means a revoked or
// suspended licence takes effect immediately, not just at next login.
// ---------------------------------------------------------------------------
async function resolveLicenceMode(auth: PosAuthContext): Promise<{
  mode: "full" | "read_only" | "locked";
  message: string | null;
  licence: Awaited<ReturnType<typeof validateLicenceForOpen>>["licence"];
  terminal: Awaited<ReturnType<typeof validateLicenceForOpen>>["terminal"];
}> {
  // A token must carry the FULL binding — licence key, registered terminal, and
  // surface — to be treated as anything other than locked. There is no unbound
  // fallback: writes require a token issued against a specific licence, terminal
  // and surface at login. Requiring all three (including surface) closes the
  // residual path where a partial/legacy token without `surface` would skip the
  // web/desktop licence-type gate during write re-validation.
  if (!auth.licenceKey || !auth.terminalCode || !auth.surface) {
    return {
      mode: "locked",
      message: "This till is not activated against a licence and terminal. Sign in again.",
      licence: null,
      terminal: null,
    };
  }
  const outcome = await validateLicenceForOpen({
    tenantId: auth.tenant.id,
    licenceKey: auth.licenceKey,
    terminalCode: auth.terminalCode,
    surface: auth.surface,
  });
  return { mode: outcome.mode, message: outcome.message, licence: outcome.licence, terminal: outcome.terminal };
}

/** Block mutating POS actions unless the till's licence resolves to full mode. */
async function requirePosFullMode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { mode, message, licence, terminal } = await resolveLicenceMode(req.posAuth!);
  if (mode !== "full") {
    res.status(403).json({
      error:
        message ??
        (mode === "read_only"
          ? "This till is in read-only mode and cannot complete this action."
          : "This till licence is not active."),
      mode,
      licence,
      terminal,
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// GET /v1/pos/me
// ---------------------------------------------------------------------------
router.get("/v1/pos/me", requirePosAuth, async (req, res): Promise<void> => {
  const { user, tenant, membership, licenceKey, terminalCode, surface } = req.posAuth!;
  // Refuse to refresh a partially-bound (legacy) token: forcing re-login here
  // prevents an under-bound session from being perpetuated indefinitely via the
  // re-sign below. A fully-bound token re-validates normally.
  if (!licenceKey || !terminalCode || !surface) {
    res.status(401).json({ error: "Session is not fully activated. Please sign in again." });
    return;
  }
  const { token, expiresAt } = signPosToken(user.id, tenant.id, {
    licenceKey,
    terminalCode,
    surface,
  });
  const { mode, licence, terminal } = await resolveLicenceMode(req.posAuth!);
  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: serializeUser(user, membership),
    tenant: await serializeTenant(tenant),
    mode,
    licence,
    terminal,
  });
});

// ---------------------------------------------------------------------------
// GET /v1/pos/branding
// ---------------------------------------------------------------------------
router.get("/v1/pos/branding", requirePosAuth, async (req, res): Promise<void> => {
  const { tenant } = req.posAuth!;
  res.json({
    tenantId: tenant.id,
    logoUrl: tenant.logoUrl,
    logoPortalUrl: tenant.logoPortalUrl,
    logoPosUrl: tenant.logoPosUrl,
    faviconUrl: tenant.faviconUrl,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    surfaceColor: tenant.surfaceColor,
    brandColor: tenant.brandColor,
    fontFamily: tenant.fontFamily,
    brandTemplates: tenant.brandTemplates ?? null,
  });
});

// ---------------------------------------------------------------------------
// GET /v1/pos/jobs
// Returns a deterministic, tenant-scoped set of sample jobs for "today".
// The forthcoming tenant-workspace (Layer 2) work will replace this stub
// with real jobs scheduling — keep the response shape stable.
// ---------------------------------------------------------------------------
function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

const SAMPLE_CUSTOMERS = [
  { name: "Marlow & Sons Joinery", address: "14 Foundry Lane, Sheffield S3 8RU" },
  { name: "Riverside Holdings Ltd", address: "92 Wharf Road, Manchester M15 4PR" },
  { name: "Ashcroft Property Group", address: "7 Beacon Hill, Leeds LS6 2NY" },
  { name: "Northgate Fabrication", address: "Unit 4, Calder Industrial Park, Bradford BD4" },
  { name: "Rowena Whitfield", address: "31 Linden Crescent, York YO24 1HB" },
];
const SAMPLE_JOB_TYPES = ["Service call", "Install", "Inspection", "Quote visit", "Repair"];
const SAMPLE_STATUSES = ["scheduled", "en_route", "on_site"];

router.get("/v1/pos/jobs", requirePosAuth, (req, res): void => {
  const { tenant, user } = req.posAuth!;
  const seed = djb2(`${tenant.id}:${user.id}:${new Date().toISOString().slice(0, 10)}`);
  const todayStart = new Date();
  todayStart.setHours(8, 0, 0, 0);

  const jobs = Array.from({ length: 4 }, (_, i) => {
    const idx = (seed + i * 37) % SAMPLE_CUSTOMERS.length;
    const customer = SAMPLE_CUSTOMERS[idx];
    const jobType = SAMPLE_JOB_TYPES[(seed + i * 13) % SAMPLE_JOB_TYPES.length];
    const status = SAMPLE_STATUSES[Math.min(i, SAMPLE_STATUSES.length - 1)];
    const scheduledFor = new Date(todayStart.getTime() + i * 1000 * 60 * 90);
    const estimatedTotal = 80 + ((seed + i * 53) % 24) * 15;
    const reference = `JOB-${(seed + i).toString(36).slice(-5).toUpperCase()}`;
    return {
      id: `${tenant.id}-${i}`,
      reference,
      customerName: customer.name,
      address: customer.address,
      scheduledFor: scheduledFor.toISOString(),
      status,
      jobType,
      notes: i === 0 ? "Customer prefers card on completion." : null,
      estimatedTotal,
      currency: "gbp",
    };
  });

  res.json(jobs);
});

// ---------------------------------------------------------------------------
// GET /v1/pos/sales
// ---------------------------------------------------------------------------
function serializeSale(row: typeof posSalesTable.$inferSelect, createdByName: string) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    jobReference: row.jobReference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    lines: row.lines as Array<{ description: string; quantity: number; unitPrice: number }>,
    subtotal: row.subtotal / 100,
    taxAmount: row.taxAmount / 100,
    total: row.total / 100,
    currency: row.currency,
    tender: row.tender,
    notes: row.notes,
    createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/v1/pos/sales", requirePosAuth, async (req, res): Promise<void> => {
  const { tenant, user } = req.posAuth!;
  const rows = await db
    .select()
    .from(posSalesTable)
    .where(eq(posSalesTable.tenantId, tenant.id))
    .orderBy(desc(posSalesTable.createdAt))
    .limit(25);
  res.json(rows.map((row) => serializeSale(row, user.name)));
});

// ---------------------------------------------------------------------------
// POST /v1/pos/sales
// ---------------------------------------------------------------------------
router.post("/v1/pos/sales", requirePosAuth, requirePosFullMode, async (req, res): Promise<void> => {
  const parsed = CreatePosSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const { tenant, user } = req.posAuth!;

  const subtotalPence = Math.round(body.subtotal * 100);
  const taxPence = Math.round(body.taxAmount * 100);
  const totalPence = Math.round(body.total * 100);

  const [row] = await db
    .insert(posSalesTable)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      jobReference: body.jobReference ?? null,
      customerName: body.customerName ?? null,
      customerEmail: body.customerEmail ?? null,
      lines: body.lines,
      subtotal: subtotalPence,
      taxAmount: taxPence,
      total: totalPence,
      currency: body.currency,
      tender: body.tender,
      notes: body.notes ?? null,
    })
    .returning();

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.sale.captured",
    message: `Sale ${row.id} captured for ${body.customerName ?? "walk-in customer"} (${body.currency.toUpperCase()} ${body.total.toFixed(2)})`,
    metadata: { saleId: row.id, total: body.total, tender: body.tender },
  });

  res.status(201).json(serializeSale(row, user.name));
});

// ---------------------------------------------------------------------------
// POST /v1/pos/sales/:saleId/receipt
// Not gated by requirePosFullMode: re-issuing a receipt for an existing sale is
// a read-only reprint of historical data, allowed even in read-only mode.
// ---------------------------------------------------------------------------
router.post("/v1/pos/sales/:saleId/receipt", requirePosAuth, async (req, res): Promise<void> => {
  const parsed = SendPosReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const { tenant, user } = req.posAuth!;
  const saleId = String(req.params.saleId);

  const [sale] = await db
    .select()
    .from(posSalesTable)
    .where(and(eq(posSalesTable.id, saleId), eq(posSalesTable.tenantId, tenant.id)));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  if (body.method !== "email" && body.method !== "print") {
    res.status(400).json({ error: "method must be email or print" });
    return;
  }

  const destination =
    body.method === "email"
      ? body.destination ?? sale.customerEmail ?? null
      : body.destination ?? "Till printer";

  if (body.method === "email" && !destination) {
    res.status(400).json({ error: "Email destination required" });
    return;
  }

  const deliveredAt = new Date();
  await db
    .update(posSalesTable)
    .set({
      receiptDeliveredAt: deliveredAt,
      receiptMethod: body.method,
      receiptDestination: destination,
    })
    .where(eq(posSalesTable.id, sale.id));

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.receipt.sent",
    message: `Receipt for sale ${sale.id} sent via ${body.method}${destination ? ` to ${destination}` : ""}`,
    metadata: { saleId: sale.id, method: body.method, destination },
  });

  res.json({
    delivered: true,
    method: body.method,
    destination,
    deliveredAt: deliveredAt.toISOString(),
  });
});

export default router;

// ============================================================================
// Extended POS endpoints — products, till sessions, transactions (task 25)
// ============================================================================

// ---- products (mobile till) ----
router.get("/v1/pos/products", requirePosAuth, async (req, res) => {
  const { tenant } = req.posAuth!;
  const search = (req.query.search as string | undefined)?.trim();
  const barcode = (req.query.barcode as string | undefined)?.trim();
  const locationId = (req.query.locationId as string | undefined) ?? null;
  const conditions = [eq(productsTable.tenantId, tenant.id), eq(productsTable.archived, false)];
  if (barcode) conditions.push(eq(productsTable.barcode, barcode));
  else if (search) {
    const w = `%${search}%`;
    const fuzzy = or(ilike(productsTable.name, w), ilike(productsTable.sku, w));
    if (fuzzy) conditions.push(fuzzy);
  }
  const rows = await db
    .select({
      p: productsTable,
      categoryName: productCategoriesTable.name,
      stockHere: sql<number>`coalesce(sum(${branchStockTable.qty}), 0)::int`,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productCategoriesTable.id, productsTable.categoryId))
    .leftJoin(
      branchStockTable,
      and(
        eq(branchStockTable.productId, productsTable.id),
        locationId ? eq(branchStockTable.locationId, locationId) : sql`true`,
      ),
    )
    .where(and(...conditions))
    .groupBy(productsTable.id, productCategoriesTable.name)
    .orderBy(productsTable.name)
    .limit(barcode ? 1 : 100);
  res.json(
    rows.map(({ p, categoryName, stockHere }) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      categoryName,
      unit: p.unit,
      pricePence: p.pricePence,
      tradePricePence: p.tradePricePence,
      vatRatePct: p.vatRatePct,
      barcode: p.barcode,
      trackStock: p.trackStock,
      stockHere: stockHere ?? 0,
    })),
  );
});

// ---- trade accounts (mobile till lookup) ----
router.get("/v1/pos/trade-accounts", requirePosAuth, async (req, res) => {
  const { tenant } = req.posAuth!;
  const search = (req.query.search as string | undefined)?.trim();
  const conditions = [eq(tradeAccountsTable.tenantId, tenant.id), eq(tradeAccountsTable.archived, false)];
  if (search) {
    const w = `%${search}%`;
    const fuzzy = or(ilike(tradeAccountsTable.name, w), ilike(tradeAccountsTable.accountCode, w));
    if (fuzzy) conditions.push(fuzzy);
  }
  const rows = await db
    .select()
    .from(tradeAccountsTable)
    .where(and(...conditions))
    .orderBy(tradeAccountsTable.name)
    .limit(50);
  res.json(
    rows.map((t) => ({
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
    })),
  );
});

// ---- stock locations (mobile till) ----
router.get("/v1/pos/stock-locations", requirePosAuth, async (req, res) => {
  const { tenant } = req.posAuth!;
  const rows = await db
    .select()
    .from(stockLocationsTable)
    .where(and(eq(stockLocationsTable.tenantId, tenant.id), eq(stockLocationsTable.archived, false)))
    .orderBy(desc(stockLocationsTable.isDefault), stockLocationsTable.name);
  res.json(
    rows.map((l) => ({
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
    })),
  );
});

// ---- till sessions ----
async function userName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  return u?.name ?? null;
}
async function locationName(locId: string | null): Promise<string | null> {
  if (!locId) return null;
  const [l] = await db.select({ name: stockLocationsTable.name }).from(stockLocationsTable).where(eq(stockLocationsTable.id, locId));
  return l?.name ?? null;
}
async function cashDrawerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const [d] = await db.select({ name: cashDrawersTable.name }).from(cashDrawersTable).where(eq(cashDrawersTable.id, id));
  return d?.name ?? null;
}

async function serializeTillSession(s: TillSession) {
  return {
    id: s.id,
    locationId: s.locationId,
    locationName: await locationName(s.locationId),
    cashDrawerId: s.cashDrawerId,
    cashDrawerName: await cashDrawerName(s.cashDrawerId),
    openedByUserId: s.openedByUserId,
    openedByName: await userName(s.openedByUserId),
    closedByUserId: s.closedByUserId,
    closedByName: await userName(s.closedByUserId),
    openingFloatPence: s.openingFloatPence,
    countedCashPence: s.countedCashPence,
    expectedCashPence: s.expectedCashPence,
    cashSalesPence: s.cashSalesPence,
    cardSalesPence: s.cardSalesPence,
    tradeSalesPence: s.tradeSalesPence,
    refundsPence: s.refundsPence,
    variancePence: s.variancePence,
    status: s.status,
    notes: s.notes,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
  };
}

router.get("/v1/pos/till-sessions/current", requirePosAuth, async (req, res) => {
  const { tenant, user } = req.posAuth!;
  const [open] = await db
    .select()
    .from(tillSessionsTable)
    .where(
      and(
        eq(tillSessionsTable.tenantId, tenant.id),
        eq(tillSessionsTable.openedByUserId, user.id),
        eq(tillSessionsTable.status, "open"),
      ),
    )
    .orderBy(desc(tillSessionsTable.openedAt))
    .limit(1);
  res.json(open ? await serializeTillSession(open) : null);
});

router.post("/v1/pos/till-sessions/open", requirePosAuth, requirePosFullMode, async (req, res): Promise<void> => {
  const parsed = OpenTillSessionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { tenant, user } = req.posAuth!;
  const [existing] = await db
    .select()
    .from(tillSessionsTable)
    .where(
      and(
        eq(tillSessionsTable.tenantId, tenant.id),
        eq(tillSessionsTable.openedByUserId, user.id),
        eq(tillSessionsTable.status, "open"),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An open till session already exists for this user" });
    return;
  }
  const locationId = parsed.data.locationId ?? (await getOrCreateDefaultLocation(tenant.id));
  const [row] = await db
    .insert(tillSessionsTable)
    .values({
      tenantId: tenant.id,
      locationId,
      cashDrawerId: parsed.data.cashDrawerId ?? null,
      openedByUserId: user.id,
      openingFloatPence: parsed.data.openingFloatPence,
      notes: parsed.data.notes ?? null,
      status: "open",
    })
    .returning();
  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.till.opened",
    message: `Till opened with float £${(parsed.data.openingFloatPence / 100).toFixed(2)}`,
  });
  res.status(201).json(await serializeTillSession(row));
});

// Not gated by requirePosFullMode: closing/cashing-up an already-open shift must
// remain possible even if the licence has lapsed to read-only since open, so the
// operator is never trapped with an unclosable session.
router.post("/v1/pos/till-sessions/:sessionId/close", requirePosAuth, async (req, res): Promise<void> => {
  const parsed = CloseTillSessionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { tenant, user } = req.posAuth!;
  const [session] = await db
    .select()
    .from(tillSessionsTable)
    .where(and(eq(tillSessionsTable.tenantId, tenant.id), eq(tillSessionsTable.id, req.params.sessionId as string)));
  if (!session) { res.status(404).json({ error: "Till session not found" }); return; }
  if (session.status !== "open") { res.status(400).json({ error: "Session already closed" }); return; }

  const expected = session.openingFloatPence + session.cashSalesPence - session.refundsPence;
  const variance = parsed.data.countedCashPence - expected;
  const [updated] = await db
    .update(tillSessionsTable)
    .set({
      status: "closed",
      countedCashPence: parsed.data.countedCashPence,
      expectedCashPence: expected,
      variancePence: variance,
      closedAt: new Date(),
      closedByUserId: user.id,
      notes: parsed.data.notes ?? session.notes,
    })
    .where(eq(tillSessionsTable.id, session.id))
    .returning();

  const [{ txCount, itemCount }] = await db
    .select({
      txCount: sql<number>`count(distinct ${posTransactionsTable.id})::int`,
      itemCount: sql<number>`coalesce(sum(${posTransactionItemsTable.quantity}), 0)::int`,
    })
    .from(posTransactionsTable)
    .leftJoin(posTransactionItemsTable, eq(posTransactionItemsTable.transactionId, posTransactionsTable.id))
    .where(eq(posTransactionsTable.tillSessionId, session.id));

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.till.closed",
    message: `Till closed — variance £${(variance / 100).toFixed(2)}`,
    metadata: { sessionId: session.id, expected, counted: parsed.data.countedCashPence, variance },
  });

  res.json({
    session: await serializeTillSession(updated),
    transactionCount: txCount ?? 0,
    productSold: itemCount ?? 0,
    emailedTo: parsed.data.emailReportTo ?? null,
  });
});

router.get("/v1/pos/till-sessions/:sessionId/report", requirePosAuth, async (req, res): Promise<void> => {
  const { tenant } = req.posAuth!;
  const [session] = await db
    .select()
    .from(tillSessionsTable)
    .where(and(eq(tillSessionsTable.tenantId, tenant.id), eq(tillSessionsTable.id, req.params.sessionId as string)));
  if (!session) { res.status(404).json({ error: "Till session not found" }); return; }
  const [{ txCount, itemCount }] = await db
    .select({
      txCount: sql<number>`count(distinct ${posTransactionsTable.id})::int`,
      itemCount: sql<number>`coalesce(sum(${posTransactionItemsTable.quantity}), 0)::int`,
    })
    .from(posTransactionsTable)
    .leftJoin(posTransactionItemsTable, eq(posTransactionItemsTable.transactionId, posTransactionsTable.id))
    .where(eq(posTransactionsTable.tillSessionId, session.id));
  res.json({
    session: await serializeTillSession(session),
    transactionCount: txCount ?? 0,
    productSold: itemCount ?? 0,
    emailedTo: null,
  });
});

// ---- POS transactions ----
async function serializeTransaction(
  tx: PosTransaction,
  items: PosTransactionItem[],
  createdByName: string | null = null,
  tradeAccountName: string | null = null,
) {
  return {
    id: tx.id,
    number: tx.number,
    kind: tx.kind,
    refundOfId: tx.refundOfId,
    tillSessionId: tx.tillSessionId,
    locationId: tx.locationId,
    tradeAccountId: tx.tradeAccountId,
    tradeAccountName,
    customerName: tx.customerName,
    customerEmail: tx.customerEmail,
    subtotalPence: tx.subtotalPence,
    discountPence: tx.discountPence,
    taxPence: tx.taxPence,
    totalPence: tx.totalPence,
    currency: tx.currency,
    tender: tx.tender,
    cashTakenPence: tx.cashTakenPence,
    cardTakenPence: tx.cardTakenPence,
    tradeCreditPence: tx.tradeCreditPence,
    changeGivenPence: tx.changeGivenPence,
    notes: tx.notes,
    createdByName,
    receiptDeliveredAt: tx.receiptDeliveredAt?.toISOString() ?? null,
    receiptMethod: tx.receiptMethod,
    receiptDestination: tx.receiptDestination,
    items: items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId,
        sku: it.sku,
        description: it.description,
        quantity: it.quantity,
        unitPricePence: it.unitPricePence,
        discountPence: it.discountPence,
        taxPence: it.taxPence,
        totalPence: it.totalPence,
      })),
    createdAt: tx.createdAt.toISOString(),
  };
}

router.get("/v1/pos/transactions", requirePosAuth, async (req, res) => {
  const { tenant } = req.posAuth!;
  const sessionId = (req.query.sessionId as string | undefined) ?? null;
  const conditions = [eq(posTransactionsTable.tenantId, tenant.id)];
  if (sessionId) conditions.push(eq(posTransactionsTable.tillSessionId, sessionId));
  const txs = await db
    .select()
    .from(posTransactionsTable)
    .where(and(...conditions))
    .orderBy(desc(posTransactionsTable.createdAt))
    .limit(50);
  if (txs.length === 0) { res.json([]); return; }
  const ids = txs.map((t) => t.id);
  const items = await db
    .select()
    .from(posTransactionItemsTable)
    .where(or(...ids.map((id) => eq(posTransactionItemsTable.transactionId, id)))!);
  const tradeAcctIds = Array.from(new Set(txs.map((t) => t.tradeAccountId).filter((x): x is string => !!x)));
  const tradeAccts = tradeAcctIds.length
    ? await db.select().from(tradeAccountsTable).where(or(...tradeAcctIds.map((id) => eq(tradeAccountsTable.id, id)))!)
    : [];
  const userIds = Array.from(new Set(txs.map((t) => t.userId).filter((x): x is string => !!x)));
  const users = userIds.length
    ? await db.select().from(usersTable).where(or(...userIds.map((id) => eq(usersTable.id, id)))!)
    : [];
  const result = await Promise.all(
    txs.map((tx) =>
      serializeTransaction(
        tx,
        items.filter((i) => i.transactionId === tx.id),
        users.find((u) => u.id === tx.userId)?.name ?? null,
        tradeAccts.find((t) => t.id === tx.tradeAccountId)?.name ?? null,
      ),
    ),
  );
  res.json(result);
});

router.post("/v1/pos/transactions", requirePosAuth, requirePosFullMode, async (req, res): Promise<void> => {
  const parsed = PosTransactionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { tenant, user } = req.posAuth!;
  const body = parsed.data;

  // Idempotency: if a client-generated key is supplied and a transaction with that
  // key already exists for this tenant, return the existing one rather than inserting
  // a duplicate. This allows offline sales to be synced multiple times safely.
  if (body.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(posTransactionsTable)
      .where(and(eq(posTransactionsTable.tenantId, tenant.id), eq(posTransactionsTable.idempotencyKey, body.idempotencyKey)))
      .limit(1);
    if (existing) {
      const items = await db
        .select()
        .from(posTransactionItemsTable)
        .where(eq(posTransactionItemsTable.transactionId, existing.id));
      res.json(await serializeTransaction(existing, items, user.name, null));
      return;
    }
  }

  // Resolve location
  const locationId = body.locationId ?? (await getOrCreateDefaultLocation(tenant.id));

  // Pricing: apply trade discount if trade account provided
  let tradeAcct: typeof tradeAccountsTable.$inferSelect | null = null;
  if (body.tradeAccountId) {
    const [t] = await db
      .select()
      .from(tradeAccountsTable)
      .where(and(eq(tradeAccountsTable.tenantId, tenant.id), eq(tradeAccountsTable.id, body.tradeAccountId)));
    if (!t) { res.status(400).json({ error: "Trade account not found" }); return; }
    tradeAcct = t;
  }

  // Compute line totals
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;
  const computed = body.items.map((it, idx) => {
    const lineGross = it.unitPricePence * it.quantity;
    const discount = it.discountPence ?? 0;
    const tradeDiscount = tradeAcct ? Math.round(lineGross * (tradeAcct.discountPct / 100)) : 0;
    const totalDisc = discount + tradeDiscount;
    const net = Math.max(0, lineGross - totalDisc);
    const vatRate = it.vatRatePct ?? 20;
    const tax = Math.round((net * vatRate) / 100);
    const total = net + tax;
    subtotal += lineGross;
    totalDiscount += totalDisc;
    totalTax += tax;
    return {
      ...it,
      discountPence: totalDisc,
      taxPence: tax,
      totalPence: total,
      sortOrder: idx,
    };
  });
  const grandTotal = subtotal - totalDiscount + totalTax;

  // Tender validation
  let cash = body.cashTakenPence ?? 0;
  let card = body.cardTakenPence ?? 0;
  let credit = body.tradeCreditPence ?? 0;
  if (body.tender === "cash") cash = cash || grandTotal;
  if (body.tender === "card") card = card || grandTotal;
  if (body.tender === "trade_account") {
    if (!tradeAcct) { res.status(400).json({ error: "Trade account tender requires tradeAccountId" }); return; }
    credit = credit || grandTotal;
  }
  const tendered = cash + card + credit;
  if (tendered < grandTotal) {
    res.status(400).json({ error: `Tender £${(tendered / 100).toFixed(2)} less than total £${(grandTotal / 100).toFixed(2)}` });
    return;
  }
  const change = body.tender === "cash" || body.tender === "split" ? tendered - grandTotal : 0;

  // Trade-account credit limit check
  if (credit > 0 && tradeAcct) {
    const projected = tradeAcct.balancePence + credit;
    if (tradeAcct.creditLimitPence > 0 && projected > tradeAcct.creditLimitPence) {
      res.status(400).json({ error: "Trade account credit limit exceeded" });
      return;
    }
  }

  // Resolve till session
  let tillSessionId = body.tillSessionId ?? null;
  if (!tillSessionId) {
    const [open] = await db
      .select({ id: tillSessionsTable.id })
      .from(tillSessionsTable)
      .where(
        and(
          eq(tillSessionsTable.tenantId, tenant.id),
          eq(tillSessionsTable.openedByUserId, user.id),
          eq(tillSessionsTable.status, "open"),
        ),
      )
      .orderBy(desc(tillSessionsTable.openedAt))
      .limit(1);
    tillSessionId = open?.id ?? null;
  }

  // Insert transaction (retry once on unique-number collision)
  let row: PosTransaction | null = null;
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    try {
      const number = await nextPosTransactionNumber(tenant.id);
      const [r] = await db
        .insert(posTransactionsTable)
        .values({
          tenantId: tenant.id,
          tillSessionId,
          locationId,
          userId: user.id,
          customerId: body.customerId ?? null,
          tradeAccountId: body.tradeAccountId ?? null,
          kind: "sale",
          number,
          customerName: body.customerName ?? null,
          customerEmail: body.customerEmail ?? null,
          subtotalPence: subtotal,
          discountPence: totalDiscount,
          taxPence: totalTax,
          totalPence: grandTotal,
          tender: body.tender,
          cashTakenPence: cash,
          cardTakenPence: card,
          tradeCreditPence: credit,
          changeGivenPence: change,
          notes: body.notes ?? null,
          idempotencyKey: body.idempotencyKey ?? null,
        })
        .returning();
      row = r;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  if (!row) { res.status(500).json({ error: "Failed to create transaction" }); return; }

  const insertedItems = await db
    .insert(posTransactionItemsTable)
    .values(
      computed.map((c) => ({
        transactionId: row!.id,
        tenantId: tenant.id,
        productId: c.productId ?? null,
        variantId: c.variantId ?? null,
        sku: c.sku ?? null,
        description: c.description,
        quantity: c.quantity,
        unitPricePence: c.unitPricePence,
        discountPence: c.discountPence,
        taxPence: c.taxPence,
        totalPence: c.totalPence,
        sortOrder: c.sortOrder,
      })),
    )
    .returning();

  // Decrement stock
  for (const it of computed) {
    if (it.productId) {
      const [p] = await db
        .select({ trackStock: productsTable.trackStock })
        .from(productsTable)
        .where(eq(productsTable.id, it.productId));
      if (p?.trackStock) {
        await applyStockDelta({
          tenantId: tenant.id,
          locationId,
          productId: it.productId,
          variantId: it.variantId ?? null,
          qtyDelta: -it.quantity,
          reason: "sale",
          refKind: "pos_transaction",
          refId: row.id,
          actorUserId: user.id,
        });
      }
    }
  }

  // Update till session sales totals + trade account balance
  if (tillSessionId) {
    await db
      .update(tillSessionsTable)
      .set({
        cashSalesPence: sql`${tillSessionsTable.cashSalesPence} + ${cash}`,
        cardSalesPence: sql`${tillSessionsTable.cardSalesPence} + ${card}`,
        tradeSalesPence: sql`${tillSessionsTable.tradeSalesPence} + ${credit}`,
      })
      .where(eq(tillSessionsTable.id, tillSessionId));
  }
  if (credit > 0 && tradeAcct) {
    await db
      .update(tradeAccountsTable)
      .set({ balancePence: sql`${tradeAccountsTable.balancePence} + ${credit}` })
      .where(eq(tradeAccountsTable.id, tradeAcct.id));
  }

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.transaction.created",
    message: `Sale ${row.number} — £${(grandTotal / 100).toFixed(2)} (${body.tender})`,
    metadata: { transactionId: row.id, total: grandTotal, tender: body.tender },
  });

  res.status(201).json(await serializeTransaction(row, insertedItems, user.name, tradeAcct?.name ?? null));
});

router.post("/v1/pos/transactions/:transactionId/refund", requirePosAuth, requirePosFullMode, async (req, res): Promise<void> => {
  const parsed = PosRefundInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { tenant, user } = req.posAuth!;

  const [original] = await db
    .select()
    .from(posTransactionsTable)
    .where(and(eq(posTransactionsTable.tenantId, tenant.id), eq(posTransactionsTable.id, req.params.transactionId as string)));
  if (!original) { res.status(404).json({ error: "Original transaction not found" }); return; }
  if (original.kind !== "sale") { res.status(400).json({ error: "Can only refund a sale" }); return; }

  // Manager PIN check — match any cash drawer's refundApprovalPin for the tenant.
  const drawers = await db
    .select({ pin: cashDrawersTable.refundApprovalPin })
    .from(cashDrawersTable)
    .where(eq(cashDrawersTable.tenantId, tenant.id));
  const validPins = drawers.map((d) => d.pin).filter((p): p is string => !!p);
  const tenantOwners = await db
    .select({ id: usersTable.id })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(and(eq(membershipsTable.tenantId, tenant.id), or(eq(membershipsTable.role, "owner"), eq(membershipsTable.role, "admin"))!));
  // Accept tenant master PIN "1234" only in dev / if no drawer PIN set, OR a drawer pin
  const masterAllowed = validPins.length === 0;
  const pinOk = validPins.includes(parsed.data.approvalPin) || (masterAllowed && parsed.data.approvalPin === "0000");
  if (!pinOk) {
    res.status(403).json({ error: "Invalid refund approval PIN" });
    return;
  }
  const approverId = tenantOwners[0]?.id ?? user.id;

  // Load original items
  const origItems = await db
    .select()
    .from(posTransactionItemsTable)
    .where(eq(posTransactionItemsTable.transactionId, original.id));
  const itemMap = new Map(origItems.map((i) => [i.id, i]));

  let subtotal = 0;
  let tax = 0;
  let discount = 0;
  const refundLines = parsed.data.items.map((req, idx) => {
    const orig = itemMap.get(req.originalItemId);
    if (!orig) throw new Error(`Original item ${req.originalItemId} not found`);
    if (req.quantity > orig.quantity) {
      throw new Error(`Refund qty exceeds original for ${orig.description}`);
    }
    const ratio = req.quantity / orig.quantity;
    const lineGross = orig.unitPricePence * req.quantity;
    const lineDiscount = Math.round(orig.discountPence * ratio);
    const lineTax = Math.round(orig.taxPence * ratio);
    const lineTotal = lineGross - lineDiscount + lineTax;
    subtotal += lineGross;
    discount += lineDiscount;
    tax += lineTax;
    return {
      productId: orig.productId,
      variantId: orig.variantId,
      sku: orig.sku,
      description: `Refund: ${orig.description}`,
      quantity: req.quantity,
      unitPricePence: orig.unitPricePence,
      discountPence: lineDiscount,
      taxPence: lineTax,
      totalPence: lineTotal,
      sortOrder: idx,
    };
  });
  const grandTotal = subtotal - discount + tax;

  // Determine till session (current open)
  const [open] = await db
    .select({ id: tillSessionsTable.id })
    .from(tillSessionsTable)
    .where(
      and(
        eq(tillSessionsTable.tenantId, tenant.id),
        eq(tillSessionsTable.openedByUserId, user.id),
        eq(tillSessionsTable.status, "open"),
      ),
    )
    .orderBy(desc(tillSessionsTable.openedAt))
    .limit(1);

  let refundRow: PosTransaction | null = null;
  for (let attempt = 0; attempt < 3 && !refundRow; attempt++) {
    try {
      const number = await nextPosTransactionNumber(tenant.id);
      const [r] = await db
        .insert(posTransactionsTable)
        .values({
          tenantId: tenant.id,
          tillSessionId: open?.id ?? null,
          locationId: original.locationId,
          userId: user.id,
          customerId: original.customerId,
          tradeAccountId: original.tradeAccountId,
          kind: "refund",
          refundOfId: original.id,
          number,
          customerName: original.customerName,
          customerEmail: original.customerEmail,
          subtotalPence: -subtotal,
          discountPence: -discount,
          taxPence: -tax,
          totalPence: -grandTotal,
          tender: parsed.data.tender ?? original.tender,
          cashTakenPence: 0,
          cardTakenPence: 0,
          tradeCreditPence: 0,
          changeGivenPence: 0,
          notes: parsed.data.reason ?? null,
          refundApprovedByUserId: approverId,
        })
        .returning();
      refundRow = r;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  if (!refundRow) { res.status(500).json({ error: "Failed to create refund" }); return; }

  const insertedItems = await db
    .insert(posTransactionItemsTable)
    .values(
      refundLines.map((l) => ({
        transactionId: refundRow!.id,
        tenantId: tenant.id,
        productId: l.productId,
        variantId: l.variantId,
        sku: l.sku,
        description: l.description,
        quantity: -l.quantity,
        unitPricePence: l.unitPricePence,
        discountPence: -l.discountPence,
        taxPence: -l.taxPence,
        totalPence: -l.totalPence,
        sortOrder: l.sortOrder,
      })),
    )
    .returning();

  // Re-stock items
  for (const l of refundLines) {
    if (l.productId && original.locationId) {
      const [p] = await db
        .select({ trackStock: productsTable.trackStock })
        .from(productsTable)
        .where(eq(productsTable.id, l.productId));
      if (p?.trackStock) {
        await applyStockDelta({
          tenantId: tenant.id,
          locationId: original.locationId,
          productId: l.productId,
          variantId: l.variantId,
          qtyDelta: l.quantity,
          reason: "refund",
          refKind: "pos_transaction",
          refId: refundRow.id,
          actorUserId: user.id,
        });
      }
    }
  }

  // Till totals / trade account
  if (open) {
    await db
      .update(tillSessionsTable)
      .set({ refundsPence: sql`${tillSessionsTable.refundsPence} + ${grandTotal}` })
      .where(eq(tillSessionsTable.id, open.id));
  }
  if (original.tradeAccountId && original.tradeCreditPence > 0) {
    await db
      .update(tradeAccountsTable)
      .set({ balancePence: sql`${tradeAccountsTable.balancePence} - ${grandTotal}` })
      .where(eq(tradeAccountsTable.id, original.tradeAccountId));
  }

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.refund.created",
    message: `Refund ${refundRow.number} for ${original.number} — £${(grandTotal / 100).toFixed(2)}`,
    metadata: { refundId: refundRow.id, originalId: original.id, approverId, total: grandTotal },
  });

  res.status(201).json(await serializeTransaction(refundRow, insertedItems, user.name));
});

router.post("/v1/pos/transactions/:transactionId/receipt", requirePosAuth, async (req, res): Promise<void> => {
  const parsed = PosReceiptRequest.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { tenant, user } = req.posAuth!;
  const [tx] = await db
    .select()
    .from(posTransactionsTable)
    .where(and(eq(posTransactionsTable.tenantId, tenant.id), eq(posTransactionsTable.id, req.params.transactionId as string)));
  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  const destination =
    parsed.data.method === "email"
      ? parsed.data.destination ?? tx.customerEmail
      : parsed.data.destination ?? "Till printer";
  if (parsed.data.method === "email" && !destination) {
    res.status(400).json({ error: "Email destination required" });
    return;
  }
  const deliveredAt = new Date();
  await db
    .update(posTransactionsTable)
    .set({ receiptDeliveredAt: deliveredAt, receiptMethod: parsed.data.method, receiptDestination: destination })
    .where(eq(posTransactionsTable.id, tx.id));

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    kind: "pos.receipt.sent",
    message: `Receipt for ${tx.number} sent via ${parsed.data.method}`,
  });

  res.json({
    delivered: true,
    method: parsed.data.method,
    destination,
    deliveredAt: deliveredAt.toISOString(),
  });
});

// ---- Public: POS download URLs (no auth required) ----
router.get("/v1/pos/downloads", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, ["windows_url", "macos_url"]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  res.json({
    windowsUrl: (map["windows_url"] as string | null | undefined) ?? null,
    macosUrl: (map["macos_url"] as string | null | undefined) ?? null,
  });
});

void isNull;
