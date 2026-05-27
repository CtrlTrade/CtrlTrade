import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  invoiceTemplatesTable,
  invoicesTable,
  invoiceItemsTable,
  customersTable,
  type InvoiceTemplate,
} from "@workspace/db";
import { CreateInvoiceTemplateBody, UpdateInvoiceTemplateBody } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { isTenantCustomer } from "../lib/tenantGuards";
import { nextInvoiceNumber } from "../lib/numbering";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function serialize(t: InvoiceTemplate, customerName: string) {
  return {
    id: t.id,
    customerId: t.customerId,
    customerName,
    title: t.title,
    notes: t.notes,
    frequency: t.frequency,
    nextRunAt: t.nextRunAt.toISOString(),
    active: t.active,
    vatRatePct: t.vatRatePct,
    items: t.items,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/v1/invoice-templates", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({ t: invoiceTemplatesTable, customerName: customersTable.name })
    .from(invoiceTemplatesTable)
    .innerJoin(customersTable, eq(customersTable.id, invoiceTemplatesTable.customerId))
    .where(eq(invoiceTemplatesTable.tenantId, tenantId))
    .orderBy(desc(invoiceTemplatesTable.createdAt));
  res.json(rows.map((r) => serialize(r.t, r.customerName)));
});

router.post("/v1/invoice-templates", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateInvoiceTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const tenant = req.auth!.tenant!;
  if (!(await isTenantCustomer(tenantId, parsed.data.customerId))) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  const vatRatePct = parsed.data.vatRatePct ?? tenant.vatRatePct ?? 20;
  const [row] = await db
    .insert(invoiceTemplatesTable)
    .values({
      tenantId,
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      frequency: parsed.data.frequency,
      nextRunAt: new Date(parsed.data.nextRunAt as unknown as string),
      vatRatePct,
      items: parsed.data.items,
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.template.created",
    message: `Recurring invoice template "${row.title}" created (${row.frequency})`,
  });
  const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, row.customerId));
  res.status(201).json(serialize(row, c?.name ?? ""));
});

router.patch("/v1/invoice-templates/:templateId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const patch: Partial<typeof invoiceTemplatesTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes ?? null;
  if (parsed.data.frequency !== undefined) patch.frequency = parsed.data.frequency;
  if (parsed.data.nextRunAt !== undefined) patch.nextRunAt = new Date(parsed.data.nextRunAt as unknown as string);
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  if (parsed.data.vatRatePct !== undefined) patch.vatRatePct = parsed.data.vatRatePct;
  if (parsed.data.items !== undefined) patch.items = parsed.data.items;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(invoiceTemplatesTable)
    .set(patch)
    .where(
      and(
        eq(invoiceTemplatesTable.tenantId, tenantId),
        eq(invoiceTemplatesTable.id, req.params.templateId as string),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.template.updated",
    message: `Recurring invoice template "${row.title}" updated`,
  });
  const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, row.customerId));
  res.json(serialize(row, c?.name ?? ""));
});

router.delete("/v1/invoice-templates/:templateId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const result = await db
    .delete(invoiceTemplatesTable)
    .where(
      and(
        eq(invoiceTemplatesTable.tenantId, tenantId),
        eq(invoiceTemplatesTable.id, req.params.templateId as string),
      ),
    )
    .returning({ id: invoiceTemplatesTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.status(204).end();
});

router.post("/v1/invoice-templates/:templateId/run", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [tpl] = await db
    .select()
    .from(invoiceTemplatesTable)
    .where(
      and(
        eq(invoiceTemplatesTable.tenantId, tenantId),
        eq(invoiceTemplatesTable.id, req.params.templateId as string),
      ),
    );
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const subtotal = tpl.items.reduce((s, it) => s + it.quantity * it.unitPricePence, 0);
  const tax = Math.round((subtotal * tpl.vatRatePct) / 100);
  const total = subtotal + tax;
  const number = await nextInvoiceNumber(tenantId);
  const inv = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoicesTable)
      .values({
        tenantId,
        customerId: tpl.customerId,
        number,
        title: tpl.title,
        status: "draft",
        notes: tpl.notes,
        vatRatePct: tpl.vatRatePct,
        subtotalPence: subtotal,
        taxPence: tax,
        totalPence: total,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();
    await tx.insert(invoiceItemsTable).values(
      tpl.items.map((it, idx) => ({
        invoiceId: row.id,
        description: it.description,
        quantity: it.quantity,
        unitPricePence: it.unitPricePence,
        sortOrder: idx,
      })),
    );
    await tx
      .update(invoiceTemplatesTable)
      .set({ nextRunAt: addFrequency(tpl.nextRunAt, tpl.frequency) })
      .where(eq(invoiceTemplatesTable.id, tpl.id));
    return row;
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.template.run",
    message: `Recurring template "${tpl.title}" generated invoice ${inv.number}`,
    metadata: { templateId: tpl.id, invoiceId: inv.id },
  });
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, inv.customerId));
  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
  res.status(201).json({
    id: inv.id,
    number: inv.number,
    title: inv.title,
    status: inv.status,
    customerId: inv.customerId,
    customerName: customer?.name ?? "",
    customerEmail: customer?.email ?? null,
    jobId: null,
    jobNumber: null,
    quoteId: null,
    notes: inv.notes,
    subtotalPence: inv.subtotalPence,
    taxPence: inv.taxPence,
    totalPence: inv.totalPence,
    amountPaidPence: 0,
    vatRatePct: inv.vatRatePct,
    currency: inv.currency,
    dueAt: inv.dueAt?.toISOString() ?? null,
    sentAt: null,
    paidAt: null,
    voidedAt: null,
    paymentLinkUrl: null,
    isDeposit: false,
    items: items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      unitPricePence: it.unitPricePence,
      sortOrder: it.sortOrder,
    })),
    payments: [],
    createdAt: inv.createdAt.toISOString(),
  });
});

export default router;
