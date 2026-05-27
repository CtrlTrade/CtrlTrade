import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  membershipsTable,
  tenantsTable,
  posSalesTable,
} from "@workspace/db";
import {
  LoginBody,
  CreatePosSaleBody,
  SendPosReceiptBody,
} from "@workspace/api-zod";
import { verifyPassword } from "../lib/auth";
import { serializeTenant, serializeUser } from "../lib/serializers";
import { signPosToken, requirePosAuth } from "../lib/posAuth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /v1/pos/login
// ---------------------------------------------------------------------------
router.post("/v1/pos/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
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

  const { token, expiresAt } = signPosToken(user.id, tenant.id);
  const tenantPayload = await serializeTenant(tenant);

  await logAudit({
    tenantId: tenant.id,
    actorUserId: user.id,
    actorLabel: user.email,
    kind: "pos.login",
    message: `POS login from ${user.email}`,
  });

  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: serializeUser(user, membership),
    tenant: tenantPayload,
  });
});

// ---------------------------------------------------------------------------
// GET /v1/pos/me
// ---------------------------------------------------------------------------
router.get("/v1/pos/me", requirePosAuth, async (req, res): Promise<void> => {
  const { user, tenant, membership } = req.posAuth!;
  const { token, expiresAt } = signPosToken(user.id, tenant.id);
  res.json({
    token,
    expiresAt: expiresAt.toISOString(),
    user: serializeUser(user, membership),
    tenant: await serializeTenant(tenant),
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
router.post("/v1/pos/sales", requirePosAuth, async (req, res): Promise<void> => {
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
