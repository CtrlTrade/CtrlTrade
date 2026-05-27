import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, asc, inArray, gt, isNull, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  tenantsTable,
  customersTable,
  quotesTable,
  quoteLineItemsTable,
  jobsTable,
  invoicesTable,
  invoiceItemsTable,
  portalTokensTable,
  customerMessagesTable,
  customerReviewsTable,
  auditLogsTable,
  usersTable,
  type Tenant,
  type Customer,
} from "@workspace/db";
import {
  GetPortalBrandingResponse,
  RequestPortalMagicLinkBody,
  RequestPortalMagicLinkResponse,
  VerifyPortalMagicLinkBody,
  VerifyPortalMagicLinkResponse,
  GetPortalSessionResponse,
  GetPortalDashboardResponse,
  GetPortalQuoteResponse,
  AcceptPortalQuoteBody,
  AcceptPortalQuoteResponse,
  DeclinePortalQuoteBody,
  DeclinePortalQuoteResponse,
  GetPortalInvoiceResponse,
  PayPortalInvoiceResponse,
  GetPortalJobResponse,
  SubmitPortalReviewBody,
  SubmitPortalReviewResponse,
  ListPortalThreadMessagesResponse,
  PostPortalThreadMessageBody,
} from "@workspace/api-zod";
import { logAudit } from "../lib/audit";
import { getAppBaseUrl } from "../lib/email";
import { dispatchNotification } from "../lib/notifications";
import { nextJobNumber, nextInvoiceNumber } from "../lib/numbering";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    portalCustomerId?: string;
    portalTenantId?: string;
  }
}

const router: IRouter = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function brandingOf(t: Tenant) {
  return {
    tenantName: t.name,
    tenantSlug: t.slug,
    brandColor: t.brandColor,
    logoUrl: t.logoUrl,
  };
}

async function loadTenantBySlug(slug: string): Promise<Tenant | null> {
  const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
  return t ?? null;
}

// ---- Public branding / magic link ------------------------------------------

router.get(
  "/v1/public/portal/:tenantSlug/branding",
  async (req: Request, res: Response): Promise<void> => {
    const tenant = await loadTenantBySlug(req.params.tenantSlug as string);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    res.json(GetPortalBrandingResponse.parse(brandingOf(tenant)));
  },
);

router.post(
  "/v1/public/portal/:tenantSlug/magic-link",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RequestPortalMagicLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenant = await loadTenantBySlug(req.params.tenantSlug as string);
    if (!tenant) {
      // Do not disclose tenant existence
      res.json(RequestPortalMagicLinkResponse.parse({ ok: true, devLink: null }));
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tenant.id), eq(customersTable.email, email)));

    let devLink: string | null = null;
    if (customer) {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(portalTokensTable).values({
        tenantId: tenant.id,
        customerId: customer.id,
        tokenHash,
        expiresAt,
      });
      const base = getAppBaseUrl();
      const link = `${base}/portal/${tenant.slug}/verify?token=${encodeURIComponent(rawToken)}`;
      try {
        await dispatchNotification({
          tenantId: tenant.id,
          eventKind: "portal.magic_link",
          vars: { customerName: customer.name, tenantName: tenant.name, magicUrl: link },
          to: { email, name: customer.name, customerId: customer.id },
        });
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, "Magic link email failed");
      }
      await logAudit({
        tenantId: tenant.id,
        actorLabel: email,
        kind: "portal.magic_link.requested",
        message: `Magic link requested for ${email}`,
        metadata: { customerId: customer.id },
      });
      if (process.env.NODE_ENV !== "production") {
        devLink = link;
      }
    } else {
      logger.info({ tenantId: tenant.id, email }, "Portal magic link requested for unknown email");
    }
    res.json(RequestPortalMagicLinkResponse.parse({ ok: true, devLink }));
  },
);

router.post(
  "/v1/public/portal/:tenantSlug/verify",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = VerifyPortalMagicLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenant = await loadTenantBySlug(req.params.tenantSlug as string);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const tokenHash = hashToken(parsed.data.token);
    // Atomic consume: only one concurrent verify can flip used_at from NULL → now()
    const [tok] = await db
      .update(portalTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(portalTokensTable.tenantId, tenant.id),
          eq(portalTokensTable.tokenHash, tokenHash),
          isNull(portalTokensTable.usedAt),
          gt(portalTokensTable.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!tok) {
      res.status(400).json({ error: "Invalid or expired link" });
      return;
    }
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tenant.id), eq(customersTable.id, tok.customerId)));
    if (!customer) {
      res.status(400).json({ error: "Customer not found" });
      return;
    }

    if (!req.session) {
      res.status(500).json({ error: "Session not available" });
      return;
    }
    req.session.portalCustomerId = customer.id;
    req.session.portalTenantId = tenant.id;
    await logAudit({
      tenantId: tenant.id,
      actorLabel: customer.email ?? customer.name,
      kind: "portal.signed_in",
      message: `Portal sign-in for ${customer.name}`,
      metadata: { customerId: customer.id, ip: req.ip, ua: req.headers["user-agent"] ?? null },
    });
    res.json(
      VerifyPortalMagicLinkResponse.parse({
        tenant: brandingOf(tenant),
        customer: { id: customer.id, name: customer.name, email: customer.email },
      }),
    );
  },
);

// ---- Portal auth middleware ------------------------------------------------

interface PortalCtx {
  tenant: Tenant;
  customer: Customer;
}

declare module "express-serve-static-core" {
  interface Request {
    portal?: PortalCtx;
  }
}

async function requirePortal(req: Request, res: Response, next: NextFunction): Promise<void> {
  const customerId = req.session?.portalCustomerId;
  const tenantId = req.session?.portalTenantId;
  if (!customerId || !tenantId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(401).json({ error: "Tenant not found" });
    return;
  }
  // If the route includes a tenantSlug, it must match the signed-in tenant.
  // Prevents a customer signed into tenant A from browsing /portal/tenantB/...
  // and seeing tenant B branding with tenant A data.
  const routeSlug = req.params?.tenantSlug as string | undefined;
  if (routeSlug && routeSlug !== tenant.slug) {
    res.status(401).json({ error: "Wrong portal for this session" });
    return;
  }
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, customerId)));
  if (!customer) {
    res.status(401).json({ error: "Customer not found" });
    return;
  }
  req.portal = { tenant, customer };
  next();
}

router.post("/v1/portal/logout", async (req: Request, res: Response): Promise<void> => {
  if (req.session) {
    req.session.portalCustomerId = undefined;
    req.session.portalTenantId = undefined;
  }
  res.status(204).end();
});

router.get("/v1/portal/me", requirePortal, async (req: Request, res: Response): Promise<void> => {
  const { tenant, customer } = req.portal!;
  res.json(
    GetPortalSessionResponse.parse({
      tenant: brandingOf(tenant),
      customer: { id: customer.id, name: customer.name, email: customer.email },
    }),
  );
});

// ---- Dashboard -------------------------------------------------------------

async function quoteTotals(quoteIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (quoteIds.length === 0) return out;
  const items = await db
    .select()
    .from(quoteLineItemsTable)
    .where(inArray(quoteLineItemsTable.quoteId, quoteIds));
  for (const it of items) {
    out.set(it.quoteId, (out.get(it.quoteId) ?? 0) + it.quantity * it.unitPricePence);
  }
  return out;
}

function quoteSummary(q: typeof quotesTable.$inferSelect, totalPence: number) {
  return {
    id: q.id,
    number: q.number,
    title: q.title,
    status: q.status,
    totalPence,
    currency: q.currency,
    createdAt: q.createdAt.toISOString(),
    acceptedAt: q.acceptedAt?.toISOString() ?? null,
  };
}

function invoiceSummary(i: typeof invoicesTable.$inferSelect) {
  const status =
    i.status === "sent" && i.dueAt && i.dueAt.getTime() < Date.now() ? "overdue" : i.status;
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    status,
    totalPence: i.totalPence,
    currency: i.currency,
    isDeposit: i.isDeposit,
    dueAt: i.dueAt?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get(
  "/v1/portal/dashboard",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const { tenant, customer } = req.portal!;
    const quotes = await db
      .select()
      .from(quotesTable)
      .where(and(eq(quotesTable.tenantId, tenant.id), eq(quotesTable.customerId, customer.id)))
      .orderBy(desc(quotesTable.createdAt));
    const visibleQuotes = quotes.filter((q) => q.status !== "draft");
    const totals = await quoteTotals(visibleQuotes.map((q) => q.id));

    const jobsRows = await db
      .select({ j: jobsTable, engineerName: usersTable.name })
      .from(jobsTable)
      .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
      .where(and(eq(jobsTable.tenantId, tenant.id), eq(jobsTable.customerId, customer.id)))
      .orderBy(desc(jobsTable.createdAt));

    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.tenantId, tenant.id),
          eq(invoicesTable.customerId, customer.id),
        ),
      )
      .orderBy(desc(invoicesTable.createdAt));
    const visibleInvoices = invoices.filter((i) => i.status !== "draft");

    res.json(
      GetPortalDashboardResponse.parse({
        unreadMessageCount: 0,
        quotes: visibleQuotes.map((q) => quoteSummary(q, totals.get(q.id) ?? 0)),
        jobs: jobsRows.map((r) => ({
          id: r.j.id,
          number: r.j.number,
          title: r.j.title,
          status: r.j.status,
          scheduledStart: r.j.scheduledStart?.toISOString() ?? null,
          scheduledEnd: r.j.scheduledEnd?.toISOString() ?? null,
          engineerName: r.engineerName ?? null,
          createdAt: r.j.createdAt.toISOString(),
        })),
        invoices: visibleInvoices.map(invoiceSummary),
      }),
    );
  },
);

// ---- Quote: view / accept / decline ----------------------------------------

async function loadPortalQuote(tenantId: string, customerId: string, quoteId: string) {
  const [q] = await db
    .select()
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.tenantId, tenantId),
        eq(quotesTable.customerId, customerId),
        eq(quotesTable.id, quoteId),
      ),
    );
  if (!q) return null;
  if (q.status === "draft") return null; // not yet shared with the customer
  const items = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, q.id))
    .orderBy(asc(quoteLineItemsTable.sortOrder));
  return { q, items };
}

function serializePortalQuote(
  q: typeof quotesTable.$inferSelect,
  items: Array<typeof quoteLineItemsTable.$inferSelect>,
) {
  const total = items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);
  return {
    ...quoteSummary(q, total),
    notes: q.notes,
    depositPct: q.depositPct,
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPricePence: i.unitPricePence,
    })),
  };
}

router.get(
  "/v1/portal/quotes/:quoteId",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await loadPortalQuote(
      req.portal!.tenant.id,
      req.portal!.customer.id,
      req.params.quoteId as string,
    );
    if (!ctx) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    res.json(GetPortalQuoteResponse.parse(serializePortalQuote(ctx.q, ctx.items)));
  },
);

router.post(
  "/v1/portal/quotes/:quoteId/accept",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AcceptPortalQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { tenant, customer } = req.portal!;
    const ctx = await loadPortalQuote(tenant.id, customer.id, req.params.quoteId as string);
    if (!ctx) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    if (ctx.q.status === "converted" || ctx.q.convertedJobId) {
      res.status(409).json({ error: "Quote already accepted" });
      return;
    }
    if (ctx.q.status === "declined") {
      res.status(409).json({ error: "Quote was declined" });
      return;
    }

    const now = new Date();
    const valuePence = ctx.items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);

    let result: { jobId: string; depositInvoiceId: string | null; raceLost?: true };
    try {
      result = await db.transaction(async (tx) => {
        // Lock the quote row inside the tx and re-check status to prevent
        // concurrent accept/decline races overwriting each other.
        const lockedRows = await tx.execute(
          sql`SELECT id, status, converted_job_id, deposit_pct, title, notes FROM quotes WHERE id = ${ctx.q.id} AND tenant_id = ${tenant.id} FOR UPDATE`,
        );
        const locked = (lockedRows as unknown as { rows: Array<{ status: string; converted_job_id: string | null; deposit_pct: number; title: string; notes: string | null }> }).rows[0];
        if (!locked) throw new Error("RACE_LOST_NOT_FOUND");
        if (locked.status === "converted" || locked.converted_job_id) throw new Error("RACE_LOST_CONVERTED");
        if (locked.status === "declined") throw new Error("RACE_LOST_DECLINED");

        const jobNumber = await nextJobNumber(tenant.id);
        const [job] = await tx
          .insert(jobsTable)
          .values({
            tenantId: tenant.id,
            customerId: customer.id,
            quoteId: ctx.q.id,
            number: jobNumber,
            title: locked.title,
            description: locked.notes,
            status: "scheduled",
            valuePence,
          })
          .returning();
        await tx
          .update(quotesTable)
          .set({ status: "converted", acceptedAt: now, convertedJobId: job.id })
          .where(eq(quotesTable.id, ctx.q.id));
        let depositInvoiceId: string | null = null;
        if (locked.deposit_pct > 0 && valuePence > 0) {
          const depositPct = locked.deposit_pct;
          const depositPence = Math.round((valuePence * depositPct) / 100);
          const vatRatePct = tenant.vatRatePct ?? 20;
          const taxPence = Math.round((depositPence * vatRatePct) / 100);
          const number = await nextInvoiceNumber(tenant.id);
          const [inv] = await tx
            .insert(invoicesTable)
            .values({
              tenantId: tenant.id,
              customerId: customer.id,
              quoteId: ctx.q.id,
              jobId: job.id,
              number,
              title: `Deposit (${depositPct}%) for ${locked.title}`,
              status: "sent",
              notes: locked.notes,
              isDeposit: true,
              vatRatePct,
              subtotalPence: depositPence,
              taxPence,
              totalPence: depositPence + taxPence,
              sentAt: now,
              dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            })
            .returning();
          await tx.insert(invoiceItemsTable).values({
            invoiceId: inv.id,
            description: `Deposit (${depositPct}%) for ${locked.title}`,
            quantity: 1,
            unitPricePence: depositPence,
            sortOrder: 0,
          });
          depositInvoiceId = inv.id;
        }
        return { jobId: job.id, depositInvoiceId };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "RACE_LOST_CONVERTED") {
        res.status(409).json({ error: "Quote already accepted" });
        return;
      }
      if (msg === "RACE_LOST_DECLINED") {
        res.status(409).json({ error: "Quote was declined" });
        return;
      }
      if (msg === "RACE_LOST_NOT_FOUND") {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      throw err;
    }

    await logAudit({
      tenantId: tenant.id,
      actorLabel: customer.email ?? customer.name,
      kind: "portal.quote.accepted",
      message: `Customer ${customer.name} accepted quote ${ctx.q.number}`,
      metadata: {
        customerId: customer.id,
        quoteId: ctx.q.id,
        signatureName: parsed.data.signatureName,
        ip: req.ip,
        ua: req.headers["user-agent"] ?? null,
        jobId: result.jobId,
        depositInvoiceId: result.depositInvoiceId,
      },
    });

    const refreshed = await loadPortalQuote(tenant.id, customer.id, ctx.q.id);
    res.json(
      AcceptPortalQuoteResponse.parse({
        quote: serializePortalQuote(refreshed!.q, refreshed!.items),
        jobId: result.jobId,
        depositInvoiceId: result.depositInvoiceId,
      }),
    );
  },
);

router.post(
  "/v1/portal/quotes/:quoteId/decline",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = DeclinePortalQuoteBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { tenant, customer } = req.portal!;
    const ctx = await loadPortalQuote(tenant.id, customer.id, req.params.quoteId as string);
    if (!ctx) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }
    if (ctx.q.status === "converted") {
      res.status(409).json({ error: "Quote already converted" });
      return;
    }
    await db
      .update(quotesTable)
      .set({ status: "declined" })
      .where(eq(quotesTable.id, ctx.q.id));
    await logAudit({
      tenantId: tenant.id,
      actorLabel: customer.email ?? customer.name,
      kind: "portal.quote.declined",
      message: `Customer ${customer.name} declined quote ${ctx.q.number}`,
      metadata: {
        customerId: customer.id,
        quoteId: ctx.q.id,
        reason: parsed.data.reason ?? null,
        ip: req.ip,
      },
    });
    if (parsed.data.reason) {
      await db.insert(customerMessagesTable).values({
        tenantId: tenant.id,
        customerId: customer.id,
        subjectKind: "quote",
        subjectId: ctx.q.id,
        fromRole: "customer",
        authorLabel: customer.name,
        body: `Quote declined: ${parsed.data.reason}`,
      });
    }
    const refreshed = await loadPortalQuote(tenant.id, customer.id, ctx.q.id);
    res.json(DeclinePortalQuoteResponse.parse(serializePortalQuote(refreshed!.q, refreshed!.items)));
  },
);

// ---- Invoices --------------------------------------------------------------

async function loadPortalInvoice(tenantId: string, customerId: string, invoiceId: string) {
  const [i] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.tenantId, tenantId),
        eq(invoicesTable.customerId, customerId),
        eq(invoicesTable.id, invoiceId),
      ),
    );
  if (!i || i.status === "draft") return null;
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, i.id))
    .orderBy(asc(invoiceItemsTable.sortOrder));
  return { i, items };
}

router.get(
  "/v1/portal/invoices/:invoiceId",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await loadPortalInvoice(
      req.portal!.tenant.id,
      req.portal!.customer.id,
      req.params.invoiceId as string,
    );
    if (!ctx) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(
      GetPortalInvoiceResponse.parse({
        ...invoiceSummary(ctx.i),
        paymentLinkUrl: ctx.i.stripePaymentLinkUrl,
        items: ctx.items.map((it) => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unitPricePence: it.unitPricePence,
        })),
      }),
    );
  },
);

router.post(
  "/v1/portal/invoices/:invoiceId/pay",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await loadPortalInvoice(
      req.portal!.tenant.id,
      req.portal!.customer.id,
      req.params.invoiceId as string,
    );
    if (!ctx) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (ctx.i.status === "paid") {
      res.status(409).json({ error: "Invoice already paid" });
      return;
    }
    if (ctx.i.stripePaymentLinkUrl) {
      res.json(PayPortalInvoiceResponse.parse({ url: ctx.i.stripePaymentLinkUrl }));
      return;
    }
    if (!(await isStripeConnected()) || ctx.items.length === 0 || ctx.i.totalPence <= 0) {
      res.json(PayPortalInvoiceResponse.parse({ url: null }));
      return;
    }
    try {
      const stripe = await getUncachableStripeClient();
      const lineItems = ctx.items.map((it) => ({
        price_data: {
          currency: ctx.i.currency,
          product_data: { name: it.description },
          unit_amount: it.unitPricePence,
        },
        quantity: it.quantity,
      }));
      if (ctx.i.taxPence > 0) {
        lineItems.push({
          price_data: {
            currency: ctx.i.currency,
            product_data: { name: `VAT (${ctx.i.vatRatePct}%)` },
            unit_amount: ctx.i.taxPence,
          },
          quantity: 1,
        });
      }
      const base = getAppBaseUrl();
      const link = await stripe.paymentLinks.create({
        line_items: lineItems,
        metadata: {
          invoice_id: ctx.i.id,
          tenant_id: ctx.i.tenantId,
          invoice_number: ctx.i.number,
        },
        payment_intent_data: {
          metadata: {
            invoice_id: ctx.i.id,
            tenant_id: ctx.i.tenantId,
            invoice_number: ctx.i.number,
          },
        },
        after_completion: base
          ? { type: "redirect", redirect: { url: `${base}/pay/${ctx.i.id}/thanks` } }
          : { type: "hosted_confirmation" },
      });
      await db
        .update(invoicesTable)
        .set({ stripePaymentLinkId: link.id, stripePaymentLinkUrl: link.url })
        .where(eq(invoicesTable.id, ctx.i.id));
      res.json(PayPortalInvoiceResponse.parse({ url: link.url }));
    } catch (err) {
      logger.warn({ err, invoiceId: ctx.i.id }, "Portal Stripe Payment Link creation failed");
      res.json(PayPortalInvoiceResponse.parse({ url: null }));
    }
  },
);

// ---- Jobs ------------------------------------------------------------------

router.get(
  "/v1/portal/jobs/:jobId",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const { tenant, customer } = req.portal!;
    const [row] = await db
      .select({ j: jobsTable, engineerName: usersTable.name })
      .from(jobsTable)
      .leftJoin(usersTable, eq(usersTable.id, jobsTable.assignedUserId))
      .where(
        and(
          eq(jobsTable.tenantId, tenant.id),
          eq(jobsTable.customerId, customer.id),
          eq(jobsTable.id, req.params.jobId as string),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const audits = await db
      .select()
      .from(auditLogsTable)
      .where(and(eq(auditLogsTable.tenantId, tenant.id)))
      .orderBy(asc(auditLogsTable.createdAt));
    const timeline = [
      { kind: "created", label: "Job created", at: row.j.createdAt.toISOString() },
      ...(row.j.scheduledStart
        ? [{ kind: "scheduled", label: "Scheduled", at: row.j.scheduledStart.toISOString() }]
        : []),
      ...audits
        .filter((a) => {
          const m = (a.metadata ?? {}) as Record<string, unknown>;
          return m.jobId === row.j.id && a.kind.startsWith("job.");
        })
        .map((a) => ({ kind: a.kind, label: a.message, at: a.createdAt.toISOString() })),
    ];
    const [review] = await db
      .select()
      .from(customerReviewsTable)
      .where(
        and(
          eq(customerReviewsTable.tenantId, tenant.id),
          eq(customerReviewsTable.jobId, row.j.id),
        ),
      );
    res.json(
      GetPortalJobResponse.parse({
        id: row.j.id,
        number: row.j.number,
        title: row.j.title,
        status: row.j.status,
        scheduledStart: row.j.scheduledStart?.toISOString() ?? null,
        scheduledEnd: row.j.scheduledEnd?.toISOString() ?? null,
        engineerName: row.engineerName ?? null,
        createdAt: row.j.createdAt.toISOString(),
        description: row.j.description,
        addressLine1: row.j.addressLine1,
        city: row.j.city,
        postcode: row.j.postcode,
        timeline,
        review: review
          ? {
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              createdAt: review.createdAt.toISOString(),
            }
          : null,
      }),
    );
  },
);

router.post(
  "/v1/portal/jobs/:jobId/review",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SubmitPortalReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { tenant, customer } = req.portal!;
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenant.id),
          eq(jobsTable.customerId, customer.id),
          eq(jobsTable.id, req.params.jobId as string),
        ),
      );
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.status !== "completed") {
      res.status(409).json({ error: "Job not yet completed" });
      return;
    }
    const [existing] = await db
      .select()
      .from(customerReviewsTable)
      .where(
        and(
          eq(customerReviewsTable.tenantId, tenant.id),
          eq(customerReviewsTable.jobId, job.id),
        ),
      );
    if (existing) {
      res.status(409).json({ error: "Review already submitted" });
      return;
    }
    const [review] = await db
      .insert(customerReviewsTable)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        jobId: job.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      })
      .returning();
    await logAudit({
      tenantId: tenant.id,
      actorLabel: customer.email ?? customer.name,
      kind: "portal.review.submitted",
      message: `Customer ${customer.name} left a ${parsed.data.rating}-star review on job ${job.number}`,
      metadata: { customerId: customer.id, jobId: job.id, rating: parsed.data.rating },
    });
    res.json(
      SubmitPortalReviewResponse.parse({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      }),
    );
  },
);

// ---- Threads (customer side + tenant side) ---------------------------------

const SUBJECT_KINDS = new Set(["quote", "job", "general"]);

async function verifyThreadAccessForCustomer(
  tenantId: string,
  customerId: string,
  kind: string,
  subjectId: string,
): Promise<boolean> {
  if (kind === "general") return true;
  if (kind === "quote") {
    const [q] = await db
      .select({ id: quotesTable.id })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.tenantId, tenantId),
          eq(quotesTable.customerId, customerId),
          eq(quotesTable.id, subjectId),
        ),
      );
    return !!q;
  }
  if (kind === "job") {
    const [j] = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.tenantId, tenantId),
          eq(jobsTable.customerId, customerId),
          eq(jobsTable.id, subjectId),
        ),
      );
    return !!j;
  }
  return false;
}

async function customerIdForSubject(
  tenantId: string,
  kind: string,
  subjectId: string,
): Promise<string | null> {
  if (kind === "quote") {
    const [q] = await db
      .select({ customerId: quotesTable.customerId })
      .from(quotesTable)
      .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, subjectId)));
    return q?.customerId ?? null;
  }
  if (kind === "job") {
    const [j] = await db
      .select({ customerId: jobsTable.customerId })
      .from(jobsTable)
      .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, subjectId)));
    return j?.customerId ?? null;
  }
  return null;
}

function serializeMessage(m: typeof customerMessagesTable.$inferSelect) {
  return {
    id: m.id,
    subjectKind: m.subjectKind,
    subjectId: m.subjectId,
    fromRole: m.fromRole,
    authorLabel: m.authorLabel,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get(
  "/v1/portal/threads/:subjectKind/:subjectId/messages",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const kind = req.params.subjectKind as string;
    const subjectId = req.params.subjectId as string;
    if (!SUBJECT_KINDS.has(kind)) {
      res.status(400).json({ error: "Invalid subject kind" });
      return;
    }
    const { tenant, customer } = req.portal!;
    if (!(await verifyThreadAccessForCustomer(tenant.id, customer.id, kind, subjectId))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const rows = await db
      .select()
      .from(customerMessagesTable)
      .where(
        and(
          eq(customerMessagesTable.tenantId, tenant.id),
          eq(customerMessagesTable.customerId, customer.id),
          eq(customerMessagesTable.subjectKind, kind),
          eq(customerMessagesTable.subjectId, subjectId),
        ),
      )
      .orderBy(asc(customerMessagesTable.createdAt));
    res.json(ListPortalThreadMessagesResponse.parse(rows.map(serializeMessage)));
  },
);

router.post(
  "/v1/portal/threads/:subjectKind/:subjectId/messages",
  requirePortal,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PostPortalThreadMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const kind = req.params.subjectKind as string;
    const subjectId = req.params.subjectId as string;
    if (!SUBJECT_KINDS.has(kind)) {
      res.status(400).json({ error: "Invalid subject kind" });
      return;
    }
    const { tenant, customer } = req.portal!;
    if (!(await verifyThreadAccessForCustomer(tenant.id, customer.id, kind, subjectId))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    const [row] = await db
      .insert(customerMessagesTable)
      .values({
        tenantId: tenant.id,
        customerId: customer.id,
        subjectKind: kind,
        subjectId,
        fromRole: "customer",
        authorLabel: customer.name,
        body: parsed.data.body,
      })
      .returning();
    res.status(201).json(serializeMessage(row));
  },
);

// ---- Tenant side threads (staff view) --------------------------------------

import { requireTenant } from "../middlewares/auth";

router.get(
  "/v1/threads/:subjectKind/:subjectId/messages",
  requireTenant,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const kind = req.params.subjectKind as string;
    const subjectId = req.params.subjectId as string;
    if (!SUBJECT_KINDS.has(kind) || kind === "general") {
      res.status(400).json({ error: "Invalid subject kind" });
      return;
    }
    const customerId = await customerIdForSubject(tenantId, kind, subjectId);
    if (!customerId) {
      res.status(404).json({ error: "Subject not found" });
      return;
    }
    const rows = await db
      .select()
      .from(customerMessagesTable)
      .where(
        and(
          eq(customerMessagesTable.tenantId, tenantId),
          eq(customerMessagesTable.customerId, customerId),
          eq(customerMessagesTable.subjectKind, kind),
          eq(customerMessagesTable.subjectId, subjectId),
        ),
      )
      .orderBy(asc(customerMessagesTable.createdAt));
    res.json(rows.map(serializeMessage));
  },
);

router.post(
  "/v1/threads/:subjectKind/:subjectId/messages",
  requireTenant,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PostPortalThreadMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const kind = req.params.subjectKind as string;
    const subjectId = req.params.subjectId as string;
    if (!SUBJECT_KINDS.has(kind) || kind === "general") {
      res.status(400).json({ error: "Invalid subject kind" });
      return;
    }
    const customerId = await customerIdForSubject(tenantId, kind, subjectId);
    if (!customerId) {
      res.status(404).json({ error: "Subject not found" });
      return;
    }
    const [row] = await db
      .insert(customerMessagesTable)
      .values({
        tenantId,
        customerId,
        subjectKind: kind,
        subjectId,
        fromRole: "staff",
        authorUserId: req.auth!.user.id,
        authorLabel: req.auth!.user.name ?? req.auth!.user.email,
        body: parsed.data.body,
      })
      .returning();
    res.status(201).json(serializeMessage(row));
  },
);

export default router;
