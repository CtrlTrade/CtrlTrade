import { Router, type IRouter } from "express";
import { and, desc, eq, asc } from "drizzle-orm";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  customersTable,
  jobsTable,
  type Quote,
  type QuoteLineItem,
  type Customer,
} from "@workspace/db";
import {
  ListQuotesResponse,
  CreateQuoteBody,
  GetQuoteResponse,
  UpdateQuoteBody,
  UpdateQuoteResponse,
  SendQuoteResponse,
  AcceptQuoteResponse,
  ConvertQuoteToJobBody,
  ConvertQuoteToJobResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextQuoteNumber, nextJobNumber } from "../lib/numbering";
import { isTenantCustomer, isTenantMember } from "../lib/tenantGuards";

const router: IRouter = Router();

function lineTotal(items: QuoteLineItem[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);
}

function serializeQuoteSummary(q: Quote, customerName: string, totalPence: number) {
  return {
    id: q.id,
    number: q.number,
    title: q.title,
    status: q.status,
    customerId: q.customerId,
    customerName,
    totalPence,
    currency: q.currency,
    createdAt: q.createdAt.toISOString(),
    sentAt: q.sentAt?.toISOString() ?? null,
    acceptedAt: q.acceptedAt?.toISOString() ?? null,
  };
}

function serializeQuote(q: Quote, customer: Customer, items: QuoteLineItem[]) {
  return {
    ...serializeQuoteSummary(q, customer.name, lineTotal(items)),
    notes: q.notes,
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPricePence: i.unitPricePence,
      sortOrder: i.sortOrder,
    })),
    convertedJobId: q.convertedJobId,
  };
}

async function loadQuoteContext(tenantId: string, quoteId: string) {
  const [q] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, quoteId)));
  if (!q) return null;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, q.customerId));
  const items = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, q.id))
    .orderBy(asc(quoteLineItemsTable.sortOrder));
  return { q, customer: customer!, items };
}

router.get("/v1/quotes", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      q: quotesTable,
      customerName: customersTable.name,
    })
    .from(quotesTable)
    .innerJoin(customersTable, eq(customersTable.id, quotesTable.customerId))
    .where(eq(quotesTable.tenantId, tenantId))
    .orderBy(desc(quotesTable.createdAt));
  // batch totals
  const quoteIds = rows.map((r) => r.q.id);
  const totalsByQuote: Record<string, number> = {};
  if (quoteIds.length > 0) {
    const allItems = await db
      .select()
      .from(quoteLineItemsTable);
    for (const it of allItems) {
      if (quoteIds.includes(it.quoteId)) {
        totalsByQuote[it.quoteId] = (totalsByQuote[it.quoteId] ?? 0) + it.quantity * it.unitPricePence;
      }
    }
  }
  res.json(
    ListQuotesResponse.parse(
      rows.map((r) => serializeQuoteSummary(r.q, r.customerName, totalsByQuote[r.q.id] ?? 0)),
    ),
  );
});

router.post("/v1/quotes", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, parsed.data.customerId)));
  if (!customer) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  const number = await nextQuoteNumber(tenantId);
  const [quote] = await db
    .insert(quotesTable)
    .values({
      tenantId,
      customerId: parsed.data.customerId,
      number,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  const items = parsed.data.items.length
    ? await db
        .insert(quoteLineItemsTable)
        .values(
          parsed.data.items.map((it, idx) => ({
            quoteId: quote.id,
            description: it.description,
            quantity: it.quantity,
            unitPricePence: it.unitPricePence,
            sortOrder: idx,
          })),
        )
        .returning()
    : [];
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "quote.created",
    message: `Quote ${quote.number} created for ${customer.name}`,
  });
  res.status(201).json(GetQuoteResponse.parse(serializeQuote(quote, customer, items)));
});

router.get("/v1/quotes/:quoteId", requireTenant, async (req, res): Promise<void> => {
  const ctx = await loadQuoteContext(req.auth!.tenant!.id, (req.params.quoteId as string));
  if (!ctx) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  res.json(GetQuoteResponse.parse(serializeQuote(ctx.q, ctx.customer, ctx.items)));
});

router.patch("/v1/quotes/:quoteId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.tenantId, tenantId), eq(quotesTable.id, (req.params.quoteId as string))));
  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (existing.status === "converted") {
    res.status(409).json({ error: "Quote already converted to job" });
    return;
  }
  if (!(await isTenantCustomer(tenantId, parsed.data.customerId))) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(quotesTable)
      .set({
        customerId: parsed.data.customerId,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
      })
      .where(eq(quotesTable.id, existing.id));
    await tx.delete(quoteLineItemsTable).where(eq(quoteLineItemsTable.quoteId, existing.id));
    if (parsed.data.items.length > 0) {
      await tx.insert(quoteLineItemsTable).values(
        parsed.data.items.map((it, idx) => ({
          quoteId: existing.id,
          description: it.description,
          quantity: it.quantity,
          unitPricePence: it.unitPricePence,
          sortOrder: idx,
        })),
      );
    }
  });
  const ctx = (await loadQuoteContext(tenantId, existing.id))!;
  res.json(UpdateQuoteResponse.parse(serializeQuote(ctx.q, ctx.customer, ctx.items)));
});

router.post("/v1/quotes/:quoteId/send", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadQuoteContext(tenantId, (req.params.quoteId as string));
  if (!ctx) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (ctx.q.status !== "draft" && ctx.q.status !== "sent") {
    res.status(409).json({ error: `Cannot send quote in status ${ctx.q.status}` });
    return;
  }
  const now = new Date();
  const [updated] = await db
    .update(quotesTable)
    .set({ status: "sent", sentAt: now })
    .where(eq(quotesTable.id, ctx.q.id))
    .returning();
  if (ctx.customer.email) {
    try {
      const { dispatchNotification } = await import("../lib/notifications");
      const { getAppBaseUrl } = await import("../lib/email");
      await dispatchNotification({
        tenantId,
        eventKind: "quote.sent",
        vars: {
          customerName: ctx.customer.name,
          tenantName: req.auth!.tenant!.name,
          quoteNumber: updated.number,
          quoteUrl: `${getAppBaseUrl()}/portal/${req.auth!.tenant!.slug}`,
        },
        to: { email: ctx.customer.email, name: ctx.customer.name, customerId: ctx.customer.id },
        metadata: { quoteId: updated.id },
      });
    } catch (err) {
      req.log.warn({ err, quoteId: updated.id }, "Quote send email failed");
    }
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "quote.sent",
    message: `Quote ${updated.number} sent to ${ctx.customer.name}`,
  });
  res.json(SendQuoteResponse.parse(serializeQuote(updated, ctx.customer, ctx.items)));
});

router.post("/v1/quotes/:quoteId/accept", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadQuoteContext(tenantId, (req.params.quoteId as string));
  if (!ctx) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (ctx.q.status === "converted") {
    res.status(409).json({ error: "Quote already converted" });
    return;
  }
  const now = new Date();
  const [updated] = await db
    .update(quotesTable)
    .set({ status: "accepted", acceptedAt: now })
    .where(eq(quotesTable.id, ctx.q.id))
    .returning();
  if (ctx.customer.email) {
    try {
      const { dispatchNotification } = await import("../lib/notifications");
      await dispatchNotification({
        tenantId,
        eventKind: "quote.accepted",
        vars: {
          customerName: ctx.customer.name,
          tenantName: req.auth!.tenant!.name,
          quoteNumber: updated.number,
        },
        to: { email: ctx.customer.email, name: ctx.customer.name, customerId: ctx.customer.id },
        metadata: { quoteId: updated.id },
      });
    } catch (err) {
      req.log.warn({ err, quoteId: updated.id }, "Quote accepted email failed");
    }
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "quote.accepted",
    message: `Quote ${updated.number} accepted`,
  });
  res.json(AcceptQuoteResponse.parse(serializeQuote(updated, ctx.customer, ctx.items)));
});

router.post("/v1/quotes/:quoteId/convert", requireTenant, async (req, res): Promise<void> => {
  const parsed = ConvertQuoteToJobBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const ctx = await loadQuoteContext(tenantId, (req.params.quoteId as string));
  if (!ctx) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  if (ctx.q.convertedJobId) {
    res.status(409).json({ error: "Quote already converted" });
    return;
  }
  if (parsed.data.assignedUserId && !(await isTenantMember(tenantId, parsed.data.assignedUserId))) {
    res.status(400).json({ error: "Assignee is not a member of this tenant" });
    return;
  }
  const number = await nextJobNumber(tenantId);
  const valuePence = lineTotal(ctx.items);
  const [job] = await db
    .insert(jobsTable)
    .values({
      tenantId,
      customerId: ctx.q.customerId,
      quoteId: ctx.q.id,
      number,
      title: ctx.q.title,
      description: ctx.q.notes,
      status: "scheduled",
      scheduledStart: parsed.data.scheduledStart ?? null,
      scheduledEnd: parsed.data.scheduledEnd ?? null,
      assignedUserId: parsed.data.assignedUserId ?? null,
      valuePence,
    })
    .returning();
  await db
    .update(quotesTable)
    .set({ status: "converted", convertedJobId: job.id, acceptedAt: ctx.q.acceptedAt ?? new Date() })
    .where(eq(quotesTable.id, ctx.q.id));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "quote.converted",
    message: `Quote ${ctx.q.number} converted to job ${job.number}`,
    metadata: { quoteId: ctx.q.id, jobId: job.id },
  });
  res.json(
    ConvertQuoteToJobResponse.parse({
      id: job.id,
      number: job.number,
      title: job.title,
      description: job.description,
      status: job.status,
      customerId: job.customerId,
      customerName: ctx.customer.name,
      quoteId: job.quoteId,
      scheduledStart: job.scheduledStart?.toISOString() ?? null,
      scheduledEnd: job.scheduledEnd?.toISOString() ?? null,
      addressLine1: job.addressLine1,
      city: job.city,
      postcode: job.postcode,
      assignedUserId: job.assignedUserId,
      assignedUserName: null,
      assignedVehicleId: job.assignedVehicleId,
      valuePence: job.valuePence,
      createdAt: job.createdAt.toISOString(),
    }),
  );
});

export default router;
