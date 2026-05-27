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
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextInvoiceNumber } from "../lib/numbering";
import { isTenantCustomer } from "../lib/tenantGuards";
import { sendEmail, getAppBaseUrl } from "../lib/email";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { logger } from "../lib/logger";

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

function serializeSummary(i: Invoice, customerName: string) {
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    status: i.status,
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
    status: i.status,
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
  const whereClause = status
    ? and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, status))
    : eq(invoicesTable.tenantId, tenantId);
  const rows = await db
    .select({ i: invoicesTable, customerName: customersTable.name })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(whereClause)
    .orderBy(desc(invoicesTable.createdAt));
  res.json(ListInvoicesResponse.parse(rows.map((r) => serializeSummary(r.i, r.customerName))));
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
      await sendEmail({
        tenantId,
        template: "invoice.sent",
        to: [{ email: ctx.customer.email, name: ctx.customer.name }],
        subject: `Invoice ${ctx.inv.number} from ${req.auth!.tenant!.name}`,
        text: lines.join("\n"),
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
  const [existing] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.quoteId, quote.id)));
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
  if (opts.stripeCheckoutSessionId) {
    const [dup] = await db
      .select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(eq(paymentsTable.stripeCheckoutSessionId, opts.stripeCheckoutSessionId));
    if (dup) return;
  }
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
  }
}

export default router;
