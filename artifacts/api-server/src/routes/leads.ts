import { Router, type IRouter } from "express";
import { and, desc, eq, sql, asc } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadNotesTable,
  leadActivitiesTable,
  customersTable,
  quotesTable,
  quoteLineItemsTable,
  tenantsTable,
  usersTable,
  type Lead,
  type LeadNote,
  type LeadActivity,
} from "@workspace/db";
import {
  ListLeadsResponse,
  CreateLeadBody,
  GetLeadResponse,
  UpdateLeadBody,
  UpdateLeadResponse,
  AddLeadNoteBody,
  LogLeadActivityBody,
  ConvertLeadToQuoteBody,
  ConvertLeadToQuoteResponse,
  LoseLeadBody,
  LoseLeadResponse,
  GetLeadEmbedSnippetResponse,
  GetLeadSourceRoiResponse,
  CaptureLeadPublicBody,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { nextQuoteNumber } from "../lib/numbering";
import { isTenantMember } from "../lib/tenantGuards";

const router: IRouter = Router();

const SOURCE_WEIGHTS: Record<string, number> = {
  referral: 35,
  website: 25,
  marketplace: 20,
  manual: 15,
};

const FOLLOW_UP_HOURS = 24;

function scoreLead(input: {
  source: string;
  valuePence: number;
  email: string | null;
  phone: string | null;
  message: string | null;
}): number {
  const sourceWeight = SOURCE_WEIGHTS[input.source] ?? 10;
  let value = 0;
  if (input.valuePence >= 500000) value = 35;
  else if (input.valuePence >= 100000) value = 25;
  else if (input.valuePence >= 25000) value = 15;
  else if (input.valuePence > 0) value = 5;
  let contact = 0;
  if (input.email && input.phone) contact = 20;
  else if (input.email || input.phone) contact = 10;
  const msg = (input.message ?? "").length;
  const msgBonus = msg >= 80 ? 10 : msg >= 20 ? 5 : 0;
  return Math.max(0, Math.min(100, sourceWeight + value + contact + msgBonus));
}

function followUpOverdue(lead: Lead, now: Date): boolean {
  if (lead.status === "won" || lead.status === "lost") return false;
  if (lead.followUpDoneAt) return false;
  if (!lead.followUpDueAt) return false;
  return lead.followUpDueAt.getTime() < now.getTime();
}

function nextFollowUpFor(status: string, now: Date): Date | null {
  if (status === "won" || status === "lost") return null;
  return new Date(now.getTime() + FOLLOW_UP_HOURS * 60 * 60 * 1000);
}

function serializeSummary(
  l: Lead,
  ownerUserName: string | null,
  currency: string,
  now: Date,
) {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    company: l.company,
    source: l.source,
    sourceDetail: l.sourceDetail,
    status: l.status,
    title: l.title,
    score: l.score,
    valuePence: l.valuePence,
    currency,
    ownerUserId: l.ownerUserId,
    ownerUserName,
    convertedQuoteId: l.convertedQuoteId,
    convertedCustomerId: l.convertedCustomerId,
    followUpDueAt: l.followUpDueAt?.toISOString() ?? null,
    followUpOverdue: followUpOverdue(l, now),
    createdAt: l.createdAt.toISOString(),
  };
}

function serializeLead(
  l: Lead,
  ownerUserName: string | null,
  currency: string,
  notes: LeadNote[],
  activities: LeadActivity[],
  now: Date,
) {
  return {
    ...serializeSummary(l, ownerUserName, currency, now),
    message: l.message,
    lostReason: l.lostReason,
    firstContactedAt: l.firstContactedAt?.toISOString() ?? null,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorUserId: n.authorUserId,
      authorLabel: n.authorLabel,
      createdAt: n.createdAt.toISOString(),
    })),
    activities: activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      subject: a.subject,
      body: a.body,
      occurredAt: a.occurredAt.toISOString(),
      actorUserId: a.actorUserId,
      actorLabel: a.actorLabel,
    })),
  };
}

async function loadOwnerName(ownerUserId: string | null): Promise<string | null> {
  if (!ownerUserId) return null;
  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerUserId));
  return u?.name ?? null;
}

router.get("/v1/leads", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const source = typeof req.query.source === "string" ? req.query.source : null;
  const whereParts = [eq(leadsTable.tenantId, tenantId)];
  if (status) whereParts.push(eq(leadsTable.status, status));
  if (source) whereParts.push(eq(leadsTable.source, source));
  const rows = await db
    .select({ lead: leadsTable, ownerName: usersTable.name })
    .from(leadsTable)
    .leftJoin(usersTable, eq(usersTable.id, leadsTable.ownerUserId))
    .where(and(...whereParts))
    .orderBy(desc(leadsTable.score), desc(leadsTable.createdAt));
  const now = new Date();
  const currency = "GBP";
  res.json(ListLeadsResponse.parse(rows.map((r) => serializeSummary(r.lead, r.ownerName ?? null, currency, now))));
});

router.post("/v1/leads", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = CreateLeadBody.parse(req.body);
  const now = new Date();
  const source = body.source ?? "manual";
  const valuePence = body.valuePence ?? 0;
  const score = scoreLead({
    source,
    valuePence,
    email: body.email ?? null,
    phone: body.phone ?? null,
    message: body.message ?? null,
  });
  let ownerUserId: string = req.auth!.user.id;
  if (body.ownerUserId) {
    if (!(await isTenantMember(tenantId, body.ownerUserId))) {
      res.status(400).json({ error: "ownerUserId is not a member of this tenant" });
      return;
    }
    ownerUserId = body.ownerUserId;
  }
  const [lead] = await db
    .insert(leadsTable)
    .values({
      tenantId,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      company: body.company ?? null,
      source,
      sourceDetail: body.sourceDetail ?? null,
      title: body.title ?? null,
      message: body.message ?? null,
      valuePence,
      score,
      ownerUserId,
      followUpDueAt: nextFollowUpFor("new", now),
    })
    .returning();
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "lead.created",
    message: `Lead ${lead.name} created (score ${lead.score})`,
    metadata: { leadId: lead.id, source: lead.source },
  });
  const ownerName = await loadOwnerName(lead.ownerUserId);
  res.status(201).json(GetLeadResponse.parse(serializeLead(lead, ownerName, "GBP", [], [], now)));
});

router.get("/v1/leads/embed-snippet", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  const baseDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "your-app.replit.app";
  const endpoint = `https://${baseDomain}/api/v1/public/leads/${tenant.slug}`;
  const html = `<form action="${endpoint}" method="post" data-ctrltrade-leadform>\n  <input name="name" placeholder="Full name" required />\n  <input name="email" type="email" placeholder="Email" />\n  <input name="phone" placeholder="Phone" />\n  <input name="title" placeholder="What do you need?" />\n  <textarea name="message" placeholder="Tell us more"></textarea>\n  <button type="submit">Request a quote</button>\n</form>`;
  const script = `<script>(function(){var f=document.querySelector('[data-ctrltrade-leadform]');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var d={};new FormData(f).forEach(function(v,k){d[k]=v});fetch(f.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(r){if(r.ok){f.innerHTML='<p>Thanks — we will be in touch shortly.</p>'}else{alert('Sorry, please try again.')}})})})();</script>`;
  res.json(GetLeadEmbedSnippetResponse.parse({ tenantSlug: tenant.slug, endpoint, html, script }));
});

router.get("/v1/dashboard/lead-source-roi", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      source: leadsTable.source,
      total: sql<number>`count(*)::int`,
      won: sql<number>`sum(case when ${leadsTable.status} = 'won' then 1 else 0 end)::int`,
      wonValue: sql<number>`coalesce(sum(case when ${leadsTable.status} = 'won' then ${leadsTable.valuePence} else 0 end),0)::int`,
      pipelineValue: sql<number>`coalesce(sum(case when ${leadsTable.status} in ('new','contacted','qualified') then ${leadsTable.valuePence} else 0 end),0)::int`,
    })
    .from(leadsTable)
    .where(eq(leadsTable.tenantId, tenantId))
    .groupBy(leadsTable.source);
  let totalLeads = 0;
  let wonLeads = 0;
  let wonValuePence = 0;
  let pipelineValuePence = 0;
  const out = rows.map((r) => {
    totalLeads += r.total;
    wonLeads += r.won;
    wonValuePence += r.wonValue;
    pipelineValuePence += r.pipelineValue;
    return {
      source: r.source,
      totalLeads: r.total,
      wonLeads: r.won,
      conversionPct: r.total > 0 ? Math.round((r.won / r.total) * 100) : 0,
      wonValuePence: r.wonValue,
      pipelineValuePence: r.pipelineValue,
      currency: "GBP",
    };
  });
  out.sort((a, b) => b.wonValuePence - a.wonValuePence);
  res.json(GetLeadSourceRoiResponse.parse({
    currency: "GBP",
    totalLeads,
    wonLeads,
    wonValuePence,
    pipelineValuePence,
    rows: out,
  }));
});

async function loadLeadOr404(tenantId: string, leadId: string): Promise<Lead | null> {
  const [l] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.tenantId, tenantId), eq(leadsTable.id, leadId)));
  return l ?? null;
}

router.get("/v1/leads/:leadId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const lead = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const [ownerName, notes, activities] = await Promise.all([
    loadOwnerName(lead.ownerUserId),
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, lead.id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadActivitiesTable).where(eq(leadActivitiesTable.leadId, lead.id)).orderBy(desc(leadActivitiesTable.occurredAt)),
  ]);
  res.json(GetLeadResponse.parse(serializeLead(lead, ownerName, "GBP", notes, activities, new Date())));
});

router.patch("/v1/leads/:leadId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = UpdateLeadBody.parse(req.body);
  const existing = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const now = new Date();
  const patch: Partial<Lead> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.email !== undefined) patch.email = body.email;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.company !== undefined) patch.company = body.company;
  if (body.source !== undefined) patch.source = body.source;
  if (body.sourceDetail !== undefined) patch.sourceDetail = body.sourceDetail;
  if (body.title !== undefined) patch.title = body.title;
  if (body.message !== undefined) patch.message = body.message;
  if (body.valuePence !== undefined) patch.valuePence = body.valuePence;
  if (body.ownerUserId !== undefined) {
    if (body.ownerUserId !== null && !(await isTenantMember(tenantId, body.ownerUserId))) {
      res.status(400).json({ error: "ownerUserId is not a member of this tenant" });
      return;
    }
    patch.ownerUserId = body.ownerUserId;
  }
  if (body.followUpDueAt !== undefined) patch.followUpDueAt = body.followUpDueAt ? new Date(body.followUpDueAt) : null;
  let statusChanged = false;
  if (body.status !== undefined && body.status !== existing.status) {
    patch.status = body.status;
    statusChanged = true;
    if (body.status === "contacted" && !existing.firstContactedAt) {
      patch.firstContactedAt = now;
    }
    patch.followUpDueAt = nextFollowUpFor(body.status, now);
    if (body.status === "won" || body.status === "lost") {
      patch.followUpDoneAt = now;
    }
  }
  const merged = { ...existing, ...patch };
  patch.score = scoreLead({
    source: merged.source,
    valuePence: merged.valuePence,
    email: merged.email,
    phone: merged.phone,
    message: merged.message,
  });
  const [lead] = await db.update(leadsTable).set(patch).where(eq(leadsTable.id, existing.id)).returning();
  if (statusChanged) {
    await db.insert(leadActivitiesTable).values({
      leadId: lead.id,
      tenantId,
      kind: "status",
      subject: `Status → ${lead.status}`,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.name,
      occurredAt: now,
    });
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      kind: "lead.status_changed",
      message: `Lead ${lead.name}: ${existing.status} → ${lead.status}`,
      metadata: { leadId: lead.id },
    });
  }
  const ownerName = await loadOwnerName(lead.ownerUserId);
  const [notes, activities] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, lead.id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadActivitiesTable).where(eq(leadActivitiesTable.leadId, lead.id)).orderBy(desc(leadActivitiesTable.occurredAt)),
  ]);
  res.json(UpdateLeadResponse.parse(serializeLead(lead, ownerName, "GBP", notes, activities, now)));
});

router.delete("/v1/leads/:leadId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const lead = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  await db.delete(leadsTable).where(eq(leadsTable.id, lead.id));
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "lead.deleted",
    message: `Lead ${lead.name} deleted`,
    metadata: { leadId: lead.id },
  });
  res.status(204).end();
});

router.post("/v1/leads/:leadId/notes", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = AddLeadNoteBody.parse(req.body);
  const lead = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const [note] = await db.insert(leadNotesTable).values({
    leadId: lead.id,
    tenantId,
    body: body.body,
    authorUserId: req.auth!.user.id,
    authorLabel: req.auth!.user.name,
  }).returning();
  res.status(201).json(({
    id: note.id,
    body: note.body,
    authorUserId: note.authorUserId,
    authorLabel: note.authorLabel,
    createdAt: note.createdAt.toISOString(),
  }));
});

router.post("/v1/leads/:leadId/activities", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = LogLeadActivityBody.parse(req.body);
  const lead = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const now = new Date();
  const [act] = await db.insert(leadActivitiesTable).values({
    leadId: lead.id,
    tenantId,
    kind: body.kind,
    subject: body.subject ?? null,
    body: body.body ?? null,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : now,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.name,
  }).returning();
  // touch follow-up — any contact resets the 24h clock
  const updates: Partial<Lead> = {
    followUpDueAt: nextFollowUpFor(lead.status, now),
  };
  if (!lead.firstContactedAt && ["call", "email", "sms", "meeting"].includes(body.kind)) {
    updates.firstContactedAt = now;
    if (lead.status === "new") updates.status = "contacted";
  }
  await db.update(leadsTable).set(updates).where(eq(leadsTable.id, lead.id));
  res.status(201).json(({
    id: act.id,
    kind: act.kind,
    subject: act.subject,
    body: act.body,
    occurredAt: act.occurredAt.toISOString(),
    actorUserId: act.actorUserId,
    actorLabel: act.actorLabel,
  }));
});

router.post("/v1/leads/:leadId/convert", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const userId = req.auth!.user.id;
  const userName = req.auth!.user.name;
  const leadId = req.params.leadId as string;
  const body = ConvertLeadToQuoteBody.parse(req.body ?? {});
  const now = new Date();

  type TxResult =
    | { kind: "notFound" }
    | { kind: "conflict" }
    | { kind: "badCustomer" }
    | { kind: "ok"; updated: Lead; customer: typeof customersTable.$inferSelect; quote: typeof quotesTable.$inferSelect; quoteNumber: string };

  const result = await db.transaction(async (tx): Promise<TxResult> => {
    const lockRows = await tx.execute(
      sql`select * from ${leadsTable} where ${leadsTable.tenantId} = ${tenantId} and ${leadsTable.id} = ${leadId} for update`,
    );
    const lead = (lockRows.rows?.[0] ?? null) as Lead | null;
    if (!lead) return { kind: "notFound" };
    if (lead.convertedQuoteId) return { kind: "conflict" };

    const valuePence = body.valuePence ?? lead.valuePence ?? 0;
    const quoteTitle = (body.quoteTitle ?? lead.title ?? `Quote for ${lead.name}`).slice(0, 200);

    let customer: typeof customersTable.$inferSelect | null = null;
    if (body.customerId) {
      const [c] = await tx
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, body.customerId)));
      if (!c) return { kind: "badCustomer" };
      customer = c;
    } else if (lead.email) {
      const [c] = await tx
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.email, lead.email)));
      customer = c ?? null;
    }
    if (!customer) {
      const [c] = await tx.insert(customersTable).values({
        tenantId,
        name: lead.company ?? lead.name,
        email: lead.email,
        phone: lead.phone,
      }).returning();
      customer = c;
    }

    const quoteNumber = await nextQuoteNumber(tenantId);
    const [quote] = await tx.insert(quotesTable).values({
      tenantId,
      customerId: customer.id,
      number: quoteNumber,
      title: quoteTitle,
      status: "draft",
      notes: lead.message ?? null,
      currency: "GBP",
    }).returning();

    if (valuePence > 0) {
      await tx.insert(quoteLineItemsTable).values({
        quoteId: quote.id,
        description: quoteTitle,
        quantity: 1,
        unitPricePence: valuePence,
        sortOrder: 0,
      });
    }

    const [updated] = await tx.update(leadsTable).set({
      status: "won",
      convertedCustomerId: customer.id,
      convertedQuoteId: quote.id,
      followUpDoneAt: now,
      followUpDueAt: null,
    }).where(eq(leadsTable.id, lead.id)).returning();

    await tx.insert(leadActivitiesTable).values({
      leadId: lead.id,
      tenantId,
      kind: "status",
      subject: `Converted to quote ${quoteNumber}`,
      actorUserId: userId,
      actorLabel: userName,
      occurredAt: now,
    });

    return { kind: "ok", updated, customer, quote, quoteNumber };
  });

  if (result.kind === "notFound") {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (result.kind === "conflict") {
    res.status(409).json({ error: "Lead already converted" });
    return;
  }
  if (result.kind === "badCustomer") {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  const { updated, customer, quote, quoteNumber } = result;
  await logAudit({
    tenantId,
    actorUserId: userId,
    kind: "lead.converted",
    message: `Lead ${updated.name} converted to quote ${quoteNumber}`,
    metadata: { leadId: updated.id, quoteId: quote.id, customerId: customer.id },
  });

  const items = await db.select().from(quoteLineItemsTable).where(eq(quoteLineItemsTable.quoteId, quote.id));
  const totalPence = items.reduce((s, i) => s + i.quantity * i.unitPricePence, 0);
  const ownerName = await loadOwnerName(updated.ownerUserId);
  const [notes, acts] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, updated.id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadActivitiesTable).where(eq(leadActivitiesTable.leadId, updated.id)).orderBy(desc(leadActivitiesTable.occurredAt)),
  ]);

  res.json(ConvertLeadToQuoteResponse.parse({
    lead: serializeLead(updated, ownerName, "GBP", notes, acts, now),
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      addressLine1: customer.addressLine1,
      city: customer.city,
      postcode: customer.postcode,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
    },
    quote: {
      id: quote.id,
      number: quote.number,
      title: quote.title,
      status: quote.status,
      customerId: customer.id,
      customerName: customer.name,
      notes: quote.notes,
      totalPence,
      currency: quote.currency,
      items: items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitPricePence: i.unitPricePence,
        sortOrder: i.sortOrder,
      })),
      createdAt: quote.createdAt.toISOString(),
      sentAt: quote.sentAt?.toISOString() ?? null,
      acceptedAt: quote.acceptedAt?.toISOString() ?? null,
      convertedJobId: quote.convertedJobId ?? null,
    },
  }));
});

router.post("/v1/leads/:leadId/lose", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const body = LoseLeadBody.parse(req.body ?? {});
  const lead = await loadLeadOr404(tenantId, (req.params.leadId as string));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const now = new Date();
  const [updated] = await db.update(leadsTable).set({
    status: "lost",
    lostReason: body.reason ?? null,
    followUpDoneAt: now,
    followUpDueAt: null,
  }).where(eq(leadsTable.id, lead.id)).returning();
  await db.insert(leadActivitiesTable).values({
    leadId: lead.id,
    tenantId,
    kind: "status",
    subject: "Marked lost",
    body: body.reason ?? null,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.name,
    occurredAt: now,
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "lead.lost",
    message: `Lead ${lead.name} marked lost${body.reason ? `: ${body.reason}` : ""}`,
    metadata: { leadId: lead.id },
  });
  const ownerName = await loadOwnerName(updated.ownerUserId);
  const [notes, acts] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, lead.id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadActivitiesTable).where(eq(leadActivitiesTable.leadId, lead.id)).orderBy(desc(leadActivitiesTable.occurredAt)),
  ]);
  res.json(LoseLeadResponse.parse(serializeLead(updated, ownerName, "GBP", notes, acts, now)));
});

// Public capture endpoint — no auth, resolves tenant by slug, origin allowlist
router.post("/v1/public/leads/:tenantSlug", async (req, res): Promise<void> => {
  const body = CaptureLeadPublicBody.parse(req.body);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, (req.params.tenantSlug as string)));
  if (!tenant) {
    res.status(404).json({ error: "Unknown tenant" });
    return;
  }
  const now = new Date();
  const score = scoreLead({
    source: "website",
    valuePence: 0,
    email: body.email ?? null,
    phone: body.phone ?? null,
    message: body.message ?? null,
  });
  const [lead] = await db.insert(leadsTable).values({
    tenantId: tenant.id,
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    company: body.company ?? null,
    source: "website",
    sourceDetail: body.sourceDetail ?? req.headers.referer ?? null,
    title: body.title ?? null,
    message: body.message ?? null,
    valuePence: 0,
    score,
    followUpDueAt: nextFollowUpFor("new", now),
  }).returning();
  await db.insert(leadActivitiesTable).values({
    leadId: lead.id,
    tenantId: tenant.id,
    kind: "note",
    subject: "Captured from website",
    actorLabel: "Public form",
    occurredAt: now,
  });
  await logAudit({
    tenantId: tenant.id,
    actorLabel: "public-form",
    kind: "lead.captured",
    message: `Public lead captured: ${lead.name}`,
    metadata: { leadId: lead.id, referer: req.headers.referer ?? null },
  });
  res.status(201).json(({ ok: true, leadId: lead.id }));
});

export default router;
