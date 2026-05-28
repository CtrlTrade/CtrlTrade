import { Router, type IRouter } from "express";
import { and, desc, eq, asc, sql } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  customersTable,
  jobsTable,
  quotesTable,
  quoteLineItemsTable,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type Customer,
} from "@workspace/db";
import {
  ListInvoicesResponse,
  CreateInvoiceBody,
  GetInvoiceResponse,
  SendInvoiceResponse,
  VoidInvoiceResponse,
  GetAgedDebtorsResponse,
  ReplaceInvoiceItemsBody,
  MarkInvoicePaidBody,
  GenerateDepositInvoiceFromQuoteBody,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { createStaffNotification } from "../lib/staff-notifications";
import { nextInvoiceNumber } from "../lib/numbering";
import { isTenantCustomer } from "../lib/tenantGuards";
import { getAppBaseUrl } from "../lib/email";
import { dispatchNotification } from "../lib/notifications";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { logger } from "../lib/logger";
import { enqueueJob } from "../lib/queue";

const router: IRouter = Router();

interface Totals {
  subtotalPence: number;
  taxPence: number;
  totalPence: number;
}

function computeTotals(items: { quantity: number; unitPricePence: number }[], vatRatePct: number): Totals {
  const subtotalPence = items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);
  const taxPence = Math.round((subtotalPence * vatRatePct) / 100);
  return { subtotalPence, taxPence, totalPence: subtotalPence + taxPence };
}

function deriveStatus(i: Invoice): string {
  if (i.status === "sent" && i.dueAt && i.dueAt.getTime() < Date.now()) return "overdue";
  return i.status;
}

function serializeSummary(i: Invoice, customerName: string) {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    status: deriveStatus(i),
    customerId: i.customerId,
    customerName,
    totalPence: i.totalPence,
    currency: i.currency,
    dueAt: i.dueAt?.toISOString() ?? null,
    sentAt: i.sentAt?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

function serializeInvoice(
  i: Invoice,
  customer: Customer,
  items: InvoiceItem[],
  payments: Payment[],
  jobNumber: string | null,
) {
  const amountPaidPence = payments
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amountPence, 0);
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    status: deriveStatus(i),
    customerId: i.customerId,
    customerName: customer.name,
    customerEmail: customer.email,
    jobId: i.jobId,
    jobNumber,
    quoteId: i.quoteId,
    notes: i.notes,
    subtotalPence: i.subtotalPence,
    taxPence: i.taxPence,
    totalPence: i.totalPence,
    amountPaidPence,
    vatRatePct: i.vatRatePct,
    currency: i.currency,
    dueAt: i.dueAt?.toISOString() ?? null,
    sentAt: i.sentAt?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    voidedAt: i.voidedAt?.toISOString() ?? null,
    paymentLinkUrl: i.stripePaymentLinkUrl,
    isDeposit: i.isDeposit,
    items: items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      unitPricePence: it.unitPricePence,
      sortOrder: it.sortOrder,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amountPence: p.amountPence,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      receivedAt: p.receivedAt.toISOString(),
    })),
    createdAt: i.createdAt.toISOString(),
  };
}

async function loadInvoiceCtx(tenantId: string, invoiceId: string) {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.id, invoiceId)));
  if (!inv) return null;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, inv.customerId)));
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, inv.id))
    .orderBy(asc(invoiceItemsTable.sortOrder));
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.tenantId, tenantId), eq(paymentsTable.invoiceId, inv.id)))
    .orderBy(desc(paymentsTable.receivedAt));
  let jobNumber: string | null = null;
  if (inv.jobId) {
    const [j] = await db
      .select({ number: jobsTable.number })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, inv.jobId)));
    jobNumber = j?.number ?? null;
  }
  return { inv, customer: customer!, items, payments, jobNumber };
}

async function ensurePaymentLink(invoiceId: string): Promise<{ url: string | null }> {
  const ctx = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  const inv = ctx[0];
  if (!inv) return { url: null };
  if (inv.stripePaymentLinkUrl) return { url: inv.stripePaymentLinkUrl };
  if (!(await isStripeConnected())) return { url: null };
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, inv.id));
  if (items.length === 0 || inv.totalPence <= 0) return { url: null };

  try {
    const stripe = await getUncachableStripeClient();
    const lineItems = items.map((it) => ({
      price_data: {
        currency: inv.currency,
        product_data: { name: it.description },
        unit_amount: it.unitPricePence,
      },
      quantity: it.quantity,
    }));
    if (inv.taxPence > 0) {
      lineItems.push({
        price_data: {
          currency: inv.currency,
          product_data: { name: `VAT (${inv.vatRatePct}%)` },
          unit_amount: inv.taxPence,
        },
        quantity: 1,
      });
    }
    const base = getAppBaseUrl();
    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      metadata: { invoice_id: inv.id, tenant_id: inv.tenantId, invoice_number: inv.number },
      payment_intent_data: {
        metadata: { invoice_id: inv.id, tenant_id: inv.tenantId, invoice_number: inv.number },
      },
      after_completion: base
        ? { type: "redirect", redirect: { url: `${base}/pay/${inv.id}/thanks` } }
        : { type: "hosted_confirmation" },
    });
    await db
      .update(invoicesTable)
      .set({ stripePaymentLinkId: link.id, stripePaymentLinkUrl: link.url })
      .where(eq(invoicesTable.id, inv.id));
    return { url: link.url };
  } catch (err) {
    logger.warn({ err, invoiceId: inv.id }, "Stripe Payment Link creation failed");
    return { url: null };
  }
}

router.get("/v1/invoices", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const statusQ = req.query.status;
  const status = typeof statusQ === "string" ? statusQ : undefined;
  // "overdue" is derived (sent + dueAt < now); filter sent and then post-filter.
  const dbStatus = status === "overdue" ? "sent" : status;
  const whereClause = dbStatus
    ? and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, dbStatus))
    : eq(invoicesTable.tenantId, tenantId);
  const rows = await db
    .select({ i: invoicesTable, customerName: customersTable.name })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(whereClause)
    .orderBy(desc(invoicesTable.createdAt));
  let summaries = rows.map((r) => serializeSummary(r.i, r.customerName));
  if (status === "overdue") summaries = summaries.filter((s) => s.status === "overdue");
  else if (status === "sent") summaries = summaries.filter((s) => s.status === "sent");
  res.json(ListInvoicesResponse.parse(summaries));
});

router.get("/v1/invoices/aged-debtors", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({ i: invoicesTable, customerName: customersTable.name })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "sent")));
  const paymentsByInvoice = new Map<string, number>();
  if (rows.length > 0) {
    const pays = await db
      .select({ invoiceId: paymentsTable.invoiceId, amount: paymentsTable.amountPence, status: paymentsTable.status })
      .from(paymentsTable)
      .where(eq(paymentsTable.tenantId, tenantId));
    for (const p of pays) {
      if (p.status === "succeeded") {
        paymentsByInvoice.set(p.invoiceId, (paymentsByInvoice.get(p.invoiceId) ?? 0) + p.amount);
      }
    }
  }
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const customerBuckets = new Map<
    string,
    { customerName: string; current: number; d30: number; d60: number; d90: number }
  >();
  for (const r of rows) {
    const outstanding = r.i.totalPence - (paymentsByInvoice.get(r.i.id) ?? 0);
    if (outstanding <= 0) continue;
    const due = r.i.dueAt ? r.i.dueAt.getTime() : r.i.createdAt.getTime();
    const overdueDays = Math.max(0, Math.floor((now - due) / day));
    const bucket =
      customerBuckets.get(r.i.customerId) ??
      { customerName: r.customerName, current: 0, d30: 0, d60: 0, d90: 0 };
    if (overdueDays === 0) bucket.current += outstanding;
    else if (overdueDays <= 30) bucket.d30 += outstanding;
    else if (overdueDays <= 60) bucket.d60 += outstanding;
    else bucket.d90 += outstanding;
    customerBuckets.set(r.i.customerId, bucket);
  }
  const debtorRows = Array.from(customerBuckets.entries()).map(([customerId, b]) => ({
    customerId,
    customerName: b.customerName,
    currentPence: b.current,
    days30Pence: b.d30,
    days60Pence: b.d60,
    days90Pence: b.d90,
    totalOutstandingPence: b.current + b.d30 + b.d60 + b.d90,
  }));
  const totals = debtorRows.reduce(
    (acc, r) => ({
      customerId: "",
      customerName: "Totals",
      currentPence: acc.currentPence + r.currentPence,
      days30Pence: acc.days30Pence + r.days30Pence,
      days60Pence: acc.days60Pence + r.days60Pence,
      days90Pence: acc.days90Pence + r.days90Pence,
      totalOutstandingPence: acc.totalOutstandingPence + r.totalOutstandingPence,
    }),
    {
      customerId: "",
      customerName: "Totals",
      currentPence: 0,
      days30Pence: 0,
      days60Pence: 0,
      days90Pence: 0,
      totalOutstandingPence: 0,
    },
  );
  res.json(GetAgedDebtorsResponse.parse({ rows: debtorRows, totals }));
});

async function createInvoiceCore(
  tenantId: string,
  vatRatePct: number,
  data: {
    customerId: string;
    title: string;
    notes?: string | null;
    dueAt?: Date | null;
    jobId?: string | null;
    quoteId?: string | null;
    items: { description: string; quantity: number; unitPricePence: number }[];
  },
) {
  const totals = computeTotals(data.items, vatRatePct);
  const number = await nextInvoiceNumber(tenantId);
  return await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoicesTable)
      .values({
        tenantId,
        customerId: data.customerId,
        jobId: data.jobId ?? null,
        quoteId: data.quoteId ?? null,
        number,
        title: data.title,
        status: "draft",
        notes: data.notes ?? null,
        dueAt: data.dueAt ?? null,
        vatRatePct,
        subtotalPence: totals.subtotalPence,
        taxPence: totals.taxPence,
        totalPence: totals.totalPence,
      })
      .returning();
    if (data.items.length > 0) {
      await tx.insert(invoiceItemsTable).values(
        data.items.map((it, idx) => ({
          invoiceId: inv.id,
          description: it.description,
          quantity: it.quantity,
          unitPricePence: it.unitPricePence,
          sortOrder: idx,
        })),
      );
    }
    return inv;
  });
}

router.post("/v1/invoices", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
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
  if (parsed.data.jobId) {
    const [j] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, parsed.data.jobId)));
    if (!j) {
      res.status(400).json({ error: "Job not found" });
      return;
    }
  }
  if (parsed.data.quoteId) {
    const [q] = await db
      .select({ id: quotesTable.id })
      .from(quotesTable)
      .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, parsed.data.quoteId)));
    if (!q) {
      res.status(400).json({ error: "Quote not found" });
      return;
    }
  }
  const vatRatePct = parsed.data.vatRatePct ?? tenant.vatRatePct ?? 20;
  const inv = await createInvoiceCore(tenantId, vatRatePct, {
    customerId: parsed.data.customerId,
    title: parsed.data.title,
    notes: parsed.data.notes ?? null,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt as unknown as string) : null,
    jobId: parsed.data.jobId ?? null,
    quoteId: parsed.data.quoteId ?? null,
    items: parsed.data.items,
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.created",
    message: `Invoice ${inv.number} created`,
  });
  // Fan out to accounting integrations (best-effort, sync runs on worker).
  await enqueueJob({
    kind: "integration_sync",
    payload: { tenantId, provider: "xero", kind: "invoice.upsert", entityId: inv.id },
  }).catch((err) => logger.warn({ err }, "integration_sync enqueue (invoice.create) failed"));
  const ctx = (await loadInvoiceCtx(tenantId, inv.id))!;
  res.status(201).json(
    GetInvoiceResponse.parse(serializeInvoice(ctx.inv, ctx.customer, ctx.items, ctx.payments, ctx.jobNumber)),
  );
});

router.get("/v1/invoices/:invoiceId", requireTenant, async (req, res): Promise<void> => {
  const ctx = await loadInvoiceCtx(req.auth!.tenant!.id, req.params.invoiceId as string);
  if (!ctx) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(GetInvoiceResponse.parse(serializeInvoice(ctx.inv, ctx.customer, ctx.items, ctx.payments, ctx.jobNumber)));
});

router.post("/v1/invoices/:invoiceId/send", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadInvoiceCtx(tenantId, req.params.invoiceId as string);
  if (!ctx) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (ctx.inv.status === "paid" || ctx.inv.status === "void") {
    res.status(409).json({ error: `Cannot send invoice in status ${ctx.inv.status}` });
    return;
  }
  const { url } = await ensurePaymentLink(ctx.inv.id);
  const now = new Date();
  await db
    .update(invoicesTable)
    .set({ status: "sent", sentAt: ctx.inv.sentAt ?? now })
    .where(eq(invoicesTable.id, ctx.inv.id));

  if (ctx.customer.email) {
    const totalGbp = (ctx.inv.totalPence / 100).toFixed(2);
    const lines = [
      `Hi ${ctx.customer.name},`,
      ``,
      `Invoice ${ctx.inv.number} for ${ctx.inv.title} is ready.`,
      `Total due: £${totalGbp}`,
      ``,
      url ? `Pay online: ${url}` : `Please contact us to arrange payment.`,
      ``,
      `Thanks,`,
      `${req.auth!.tenant!.name}`,
    ];
    try {
      await dispatchNotification({
        tenantId,
        eventKind: "invoice.sent",
        vars: {
          customerName: ctx.customer.name,
          tenantName: req.auth!.tenant!.name,
          invoiceNumber: ctx.inv.number,
          amount: `£${(ctx.inv.totalPence / 100).toFixed(2)}`,
          paymentUrl: url ?? "",
        },
        to: { email: ctx.customer.email, name: ctx.customer.name, customerId: ctx.customer.id },
        subject: `Invoice ${ctx.inv.number} from ${req.auth!.tenant!.name}`,
        text: lines.join("\n"),
        jobId: ctx.inv.jobId ?? null,
        metadata: { invoiceId: ctx.inv.id, paymentLinkUrl: url },
      });
    } catch (err) {
      logger.warn({ err, invoiceId: ctx.inv.id }, "Invoice email send failed");
    }
  }

  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.sent",
    message: `Invoice ${ctx.inv.number} sent to ${ctx.customer.name}`,
    metadata: { paymentLinkUrl: url },
  });

  const updated = (await loadInvoiceCtx(tenantId, ctx.inv.id))!;
  res.json(
    SendInvoiceResponse.parse(
      serializeInvoice(updated.inv, updated.customer, updated.items, updated.payments, updated.jobNumber),
    ),
  );
});

router.post("/v1/invoices/:invoiceId/void", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadInvoiceCtx(tenantId, req.params.invoiceId as string);
  if (!ctx) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (ctx.inv.status === "paid") {
    res.status(409).json({ error: "Cannot void a paid invoice" });
    return;
  }
  await db
    .update(invoicesTable)
    .set({ status: "void", voidedAt: new Date() })
    .where(eq(invoicesTable.id, ctx.inv.id));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.voided",
    message: `Invoice ${ctx.inv.number} voided`,
  });
  const updated = (await loadInvoiceCtx(tenantId, ctx.inv.id))!;
  res.json(
    VoidInvoiceResponse.parse(
      serializeInvoice(updated.inv, updated.customer, updated.items, updated.payments, updated.jobNumber),
    ),
  );
});

router.put("/v1/invoices/:invoiceId/items", requireTenant, async (req, res): Promise<void> => {
  const parsed = ReplaceInvoiceItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadInvoiceCtx(tenantId, req.params.invoiceId as string);
  if (!ctx) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (ctx.inv.status !== "draft") {
    res.status(409).json({ error: "Only draft invoices can be edited" });
    return;
  }
  const totals = computeTotals(parsed.data.items, ctx.inv.vatRatePct);
  await db.transaction(async (tx) => {
    await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, ctx.inv.id));
    if (parsed.data.items.length > 0) {
      await tx.insert(invoiceItemsTable).values(
        parsed.data.items.map((it, idx) => ({
          invoiceId: ctx.inv.id,
          description: it.description,
          quantity: it.quantity,
          unitPricePence: it.unitPricePence,
          sortOrder: idx,
        })),
      );
    }
    await tx
      .update(invoicesTable)
      .set({
        subtotalPence: totals.subtotalPence,
        taxPence: totals.taxPence,
        totalPence: totals.totalPence,
        stripePaymentLinkId: null,
        stripePaymentLinkUrl: null,
      })
      .where(eq(invoicesTable.id, ctx.inv.id));
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.items.updated",
    message: `Invoice ${ctx.inv.number} line items updated`,
  });
  const updated = (await loadInvoiceCtx(tenantId, ctx.inv.id))!;
  res.json(
    GetInvoiceResponse.parse(
      serializeInvoice(updated.inv, updated.customer, updated.items, updated.payments, updated.jobNumber),
    ),
  );
});

router.post("/v1/invoices/:invoiceId/mark-paid", requireTenant, async (req, res): Promise<void> => {
  const parsed = MarkInvoicePaidBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadInvoiceCtx(tenantId, req.params.invoiceId as string);
  if (!ctx) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (ctx.inv.status === "void") {
    res.status(409).json({ error: "Cannot mark a void invoice as paid" });
    return;
  }
  if (ctx.inv.status === "paid") {
    res.status(409).json({ error: "Invoice already paid" });
    return;
  }
  const receivedAt = parsed.data.receivedAt ? new Date(parsed.data.receivedAt as unknown as string) : new Date();
  // Lock the invoice row and recompute paid sum inside the transaction so
  // concurrent mark-paid calls cannot over-record cash beyond the invoice
  // total (financial-correctness invariant).
  let amount = 0;
  try {
    await db.transaction(async (tx) => {
      const lockRes = await tx.execute<{ id: string; total_pence: number; status: string }>(
        sql`SELECT id, total_pence, status FROM invoices WHERE id = ${ctx.inv.id} FOR UPDATE`,
      );
      const locked = lockRes.rows[0];
      if (!locked) throw new Error("Invoice disappeared");
      if (locked.status === "paid") throw new Error("ALREADY_PAID");
      if (locked.status === "void") throw new Error("VOID");
      const sumRes = await tx.execute<{ s: number | null }>(
        sql`SELECT COALESCE(SUM(amount_pence), 0)::int AS s FROM payments WHERE invoice_id = ${ctx.inv.id} AND status = 'succeeded'`,
      );
      const alreadyPaid = Number(sumRes.rows[0]?.s ?? 0);
      const remaining = Math.max(0, locked.total_pence - alreadyPaid);
      const requested = parsed.data.amountPence ?? remaining;
      amount = Math.min(requested, remaining);
      if (amount <= 0) throw new Error("NOTHING_TO_PAY");
      await tx.insert(paymentsTable).values({
        tenantId,
        invoiceId: ctx.inv.id,
        amountPence: amount,
        currency: ctx.inv.currency,
        provider: "manual",
        status: "succeeded",
        receivedAt,
      });
      if (alreadyPaid + amount >= locked.total_pence) {
        await tx
          .update(invoicesTable)
          .set({ status: "paid", paidAt: receivedAt })
          .where(eq(invoicesTable.id, ctx.inv.id));
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "ALREADY_PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }
    if (msg === "VOID") { res.status(409).json({ error: "Cannot mark a void invoice as paid" }); return; }
    if (msg === "NOTHING_TO_PAY") { res.status(400).json({ error: "Nothing to mark paid" }); return; }
    throw err;
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.payment.manual",
    message: `Invoice ${ctx.inv.number} manual payment recorded`,
    metadata: { amountPence: amount, note: parsed.data.note ?? null },
  });
  // Receipt email
  await sendPaymentReceipt(ctx.inv.id, amount).catch((err) =>
    logger.warn({ err, invoiceId: ctx.inv.id }, "Receipt email failed"),
  );
  const updated = (await loadInvoiceCtx(tenantId, ctx.inv.id))!;
  res.json(
    GetInvoiceResponse.parse(
      serializeInvoice(updated.inv, updated.customer, updated.items, updated.payments, updated.jobNumber),
    ),
  );
});

async function sendPaymentReceipt(invoiceId: string, amountPence: number): Promise<void> {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv) return;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, inv.tenantId), eq(customersTable.id, inv.customerId)));
  if (!customer?.email) return;
  const totalGbp = (amountPence / 100).toFixed(2);
  const fullyPaid = inv.status === "paid";
  const lines = [
    `Hi ${customer.name},`,
    ``,
    `We've received your payment of £${totalGbp} for invoice ${inv.number}.`,
    fullyPaid ? `This invoice is now fully paid. Thank you!` : `Thank you — your invoice balance has been updated.`,
    ``,
    `Reference: ${inv.number}`,
  ];
  await dispatchNotification({
    tenantId: inv.tenantId,
    eventKind: "invoice.payment.receipt",
    vars: {
      customerName: customer.name,
      tenantName: "",
      invoiceNumber: inv.number,
      amount: `£${totalGbp}`,
      fullyPaidLine: fullyPaid ? " This invoice is now fully paid. Thank you!" : "",
    },
    to: { email: customer.email, name: customer.name, customerId: customer.id },
    subject: `Payment received — invoice ${inv.number}`,
    text: lines.join("\n"),
    jobId: inv.jobId ?? null,
    metadata: { invoiceId: inv.id, amountPence },
  });
}

router.post("/v1/jobs/:jobId/invoice", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const tenant = req.auth!.tenant!;
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, req.params.jobId as string)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "completed") {
    res.status(409).json({ error: "Job must be completed before invoicing" });
    return;
  }
  const [existing] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.jobId, job.id)));
  if (existing) {
    res.status(409).json({ error: "Job already invoiced", invoiceId: existing.id });
    return;
  }
  let items: { description: string; quantity: number; unitPricePence: number }[] = [];
  if (job.quoteId) {
    const qItems = await db
      .select()
      .from(quoteLineItemsTable)
      .where(eq(quoteLineItemsTable.quoteId, job.quoteId))
      .orderBy(asc(quoteLineItemsTable.sortOrder));
    items = qItems.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPricePence: it.unitPricePence,
    }));
  }
  if (items.length === 0) {
    items = [{ description: job.title, quantity: 1, unitPricePence: job.valuePence }];
  }
  const inv = await createInvoiceCore(tenantId, tenant.vatRatePct ?? 20, {
    customerId: job.customerId,
    title: `Invoice for ${job.title}`,
    notes: job.description ?? null,
    jobId: job.id,
    quoteId: job.quoteId,
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    items,
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.created.from_job",
    message: `Invoice ${inv.number} generated from job ${job.number}`,
    metadata: { jobId: job.id, invoiceId: inv.id },
  });
  const ctx = (await loadInvoiceCtx(tenantId, inv.id))!;
  res.status(201).json(
    serializeInvoice(ctx.inv, ctx.customer, ctx.items, ctx.payments, ctx.jobNumber),
  );
});

router.post("/v1/quotes/:quoteId/invoice", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const tenant = req.auth!.tenant!;
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, req.params.quoteId as string)));
  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (quote.status !== "accepted" && quote.status !== "converted") {
    res.status(409).json({ error: "Only accepted or converted quotes can be invoiced" });
    return;
  }
  // Only a prior FINAL invoice blocks issuance. Deposit invoices are
  // allowed to co-exist with a later final invoice for the same quote.
  const [existing] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.quoteId, quote.id),
      eq(invoicesTable.isDeposit, false),
    ));
  if (existing) {
    res.status(409).json({ error: "Quote already invoiced", invoiceId: existing.id });
    return;
  }
  const qItems = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, quote.id))
    .orderBy(asc(quoteLineItemsTable.sortOrder));
  if (qItems.length === 0) {
    res.status(400).json({ error: "Quote has no line items" });
    return;
  }
  const inv = await createInvoiceCore(tenantId, tenant.vatRatePct ?? 20, {
    customerId: quote.customerId,
    title: `Invoice for ${quote.title}`,
    notes: quote.notes,
    quoteId: quote.id,
    jobId: quote.convertedJobId,
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    items: qItems.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPricePence: it.unitPricePence,
    })),
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.created.from_quote",
    message: `Invoice ${inv.number} generated from quote ${quote.number}`,
    metadata: { quoteId: quote.id, invoiceId: inv.id },
  });
  const ctx = (await loadInvoiceCtx(tenantId, inv.id))!;
  res.status(201).json(
    serializeInvoice(ctx.inv, ctx.customer, ctx.items, ctx.payments, ctx.jobNumber),
  );
});

router.post("/v1/quotes/:quoteId/deposit-invoice", requireTenant, async (req, res): Promise<void> => {
  const parsed = GenerateDepositInvoiceFromQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const tenant = req.auth!.tenant!;
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, req.params.quoteId as string)));
  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (quote.status !== "accepted" && quote.status !== "converted" && quote.status !== "sent") {
    res.status(409).json({ error: "Quote must be sent, accepted, or converted to invoice a deposit" });
    return;
  }
  const qItems = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, quote.id));
  const quoteSubtotal = qItems.reduce((s, it) => s + it.quantity * it.unitPricePence, 0);
  if (quoteSubtotal <= 0) {
    res.status(400).json({ error: "Quote has no value" });
    return;
  }
  const depositPence = Math.round((quoteSubtotal * parsed.data.depositPct) / 100);
  const vatRatePct = tenant.vatRatePct ?? 20;
  const number = await nextInvoiceNumber(tenantId);
  const totals = computeTotals(
    [{ quantity: 1, unitPricePence: depositPence }],
    vatRatePct,
  );
  const inv = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoicesTable)
      .values({
        tenantId,
        customerId: quote.customerId,
        quoteId: quote.id,
        number,
        title: `Deposit (${parsed.data.depositPct}%) for ${quote.title}`,
        status: "draft",
        notes: quote.notes,
        isDeposit: true,
        vatRatePct,
        subtotalPence: totals.subtotalPence,
        taxPence: totals.taxPence,
        totalPence: totals.totalPence,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();
    await tx.insert(invoiceItemsTable).values({
      invoiceId: row.id,
      description: `Deposit (${parsed.data.depositPct}%) for ${quote.title}`,
      quantity: 1,
      unitPricePence: depositPence,
      sortOrder: 0,
    });
    return row;
  });
  // Also persist depositPct on the quote so future runs are idempotent at the UI layer
  await db
    .update(quotesTable)
    .set({ depositPct: parsed.data.depositPct })
    .where(eq(quotesTable.id, quote.id));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "invoice.deposit.created",
    message: `Deposit invoice ${inv.number} (${parsed.data.depositPct}%) generated from quote ${quote.number}`,
    metadata: { quoteId: quote.id, invoiceId: inv.id, depositPct: parsed.data.depositPct },
  });
  const ctx = (await loadInvoiceCtx(tenantId, inv.id))!;
  res.status(201).json(
    serializeInvoice(ctx.inv, ctx.customer, ctx.items, ctx.payments, ctx.jobNumber),
  );
});

// Used by webhook handler to credit a payment + mark invoice paid.
export async function recordInvoicePayment(opts: {
  invoiceId: string;
  amountPence: number;
  currency: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, opts.invoiceId));
  if (!inv) {
    logger.warn({ invoiceId: opts.invoiceId }, "recordInvoicePayment: invoice not found");
    return;
  }
  if (inv.status === "void") {
    logger.warn({ invoiceId: inv.id, number: inv.number }, "recordInvoicePayment: ignoring payment for void invoice");
    return;
  }
  if (inv.status === "paid") {
    // Reusable Stripe Payment Links can deliver additional completed
    // sessions after the invoice has been fully paid. Ignore them to
    // avoid over-recording payments against a closed invoice.
    logger.info({ invoiceId: inv.id, number: inv.number, checkoutSessionId: opts.stripeCheckoutSessionId },
      "recordInvoicePayment: invoice already paid, ignoring additional session");
    return;
  }
  if (opts.stripeCheckoutSessionId) {
    const [dup] = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(eq(paymentsTable.stripeCheckoutSessionId, opts.stripeCheckoutSessionId));
    if (dup) return;
  }
  try {
    await db.insert(paymentsTable).values({
      tenantId: inv.tenantId,
      invoiceId: inv.id,
      amountPence: opts.amountPence,
      currency: opts.currency,
      provider: "stripe",
      stripeCheckoutSessionId: opts.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: opts.stripePaymentIntentId ?? null,
      status: "succeeded",
    });
  } catch (err) {
    // Idempotent: a concurrent webhook delivery may have raced us and the
    // partial unique index on stripe_checkout_session_id rejected our insert.
    const code = (err as { code?: string } | null)?.code;
    if (opts.stripeCheckoutSessionId && code === "23505") {
      logger.info({ invoiceId: inv.id, checkoutSessionId: opts.stripeCheckoutSessionId },
        "recordInvoicePayment: duplicate webhook delivery suppressed");
      return;
    }
    throw err;
  }
  const totalPaid = await db
    .select({ s: sql<number>`coalesce(sum(amount_pence), 0)::int` })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.invoiceId, inv.id), eq(paymentsTable.status, "succeeded")));
  const paid = totalPaid[0]?.s ?? 0;
  if (paid >= inv.totalPence && inv.status !== "paid" && inv.status !== "void") {
    await db
      .update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), stripeCheckoutSessionId: opts.stripeCheckoutSessionId ?? inv.stripeCheckoutSessionId })
      .where(eq(invoicesTable.id, inv.id));
    await logAudit({
      tenantId: inv.tenantId,
      actorLabel: "stripe.webhook",
      kind: "invoice.paid",
      message: `Invoice ${inv.number} marked paid`,
      metadata: { amountPence: paid, checkoutSessionId: opts.stripeCheckoutSessionId },
    });
    createStaffNotification({
      tenantId: inv.tenantId,
      kind: "invoice_paid",
      title: "Invoice paid",
      message: `Invoice #${inv.number} has been paid`,
      linkPath: `/invoices/${inv.id}`,
    }).catch(() => {});
  }
  await sendPaymentReceipt(inv.id, opts.amountPence).catch((err) =>
    logger.warn({ err, invoiceId: inv.id }, "Receipt email failed"),
  );
  // Re-push to accounting integrations so Xero reflects the new paid state.
  await enqueueJob({
    kind: "integration_sync",
    payload: { tenantId: inv.tenantId, provider: "xero", kind: "invoice.upsert", entityId: inv.id },
  }).catch((err) => logger.warn({ err, invoiceId: inv.id }, "integration_sync (payment) enqueue failed"));
}

export default router;
