import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  platformSalesLeadsTable,
  platformSalesLeadMessagesTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireSuperAdmin);

// GET /v1/admin/leads/pipeline-summary — counts by stage + sparkline
router.get("/v1/admin/leads/pipeline-summary", async (_req, res): Promise<void> => {
  const counts = await db
    .select({
      status: platformSalesLeadsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(platformSalesLeadsTable)
    .groupBy(platformSalesLeadsTable.status);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [wonThis] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformSalesLeadsTable)
    .where(
      and(
        eq(platformSalesLeadsTable.status, "won"),
        sql`${platformSalesLeadsTable.updatedAt} >= ${startOfMonth}`,
      ),
    );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const sparkline = await db
    .select({
      date: sql<string>`date_trunc('day', ${platformSalesLeadsTable.createdAt})::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(platformSalesLeadsTable)
    .where(sql`${platformSalesLeadsTable.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(sql`date_trunc('day', ${platformSalesLeadsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${platformSalesLeadsTable.createdAt})`);

  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row.status] = row.count;

  res.json({
    byStatus,
    wonThisMonth: wonThis?.count ?? 0,
    sparkline,
    inProgress: (byStatus["contacted"] ?? 0) + (byStatus["demo_booked"] ?? 0),
    total: counts.reduce((s, r) => s + r.count, 0),
  });
});

// GET /v1/admin/leads — list with search + status filter
router.get("/v1/admin/leads", async (req, res): Promise<void> => {
  const search = (req.query.search as string | undefined)?.trim();
  const status = req.query.status as string | undefined;
  const filters = [] as ReturnType<typeof eq>[];
  if (status && status !== "all") filters.push(eq(platformSalesLeadsTable.status, status));
  if (search) {
    filters.push(
      or(
        ilike(platformSalesLeadsTable.name, `%${search}%`),
        ilike(platformSalesLeadsTable.email, `%${search}%`),
        ilike(platformSalesLeadsTable.company, `%${search}%`),
      ) as any,
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(platformSalesLeadsTable)
    .where(where as any)
    .orderBy(desc(platformSalesLeadsTable.createdAt))
    .limit(200);
  res.json(rows.map(serializeLead));
});

// GET /v1/admin/leads/:id
router.get("/v1/admin/leads/:id", async (req, res): Promise<void> => {
  const [lead] = await db
    .select()
    .from(platformSalesLeadsTable)
    .where(eq(platformSalesLeadsTable.id, req.params.id));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const messages = await db
    .select()
    .from(platformSalesLeadMessagesTable)
    .where(eq(platformSalesLeadMessagesTable.leadId, lead.id))
    .orderBy(asc(platformSalesLeadMessagesTable.createdAt));
  res.json({ ...serializeLead(lead), messages: messages.map(serializeMsg) });
});

// PUT /v1/admin/leads/:id
router.put("/v1/admin/leads/:id", async (req, res): Promise<void> => {
  const [existing] = await db
    .select()
    .from(platformSalesLeadsTable)
    .where(eq(platformSalesLeadsTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const allowed = ["name", "email", "phone", "company", "trade", "source", "status", "notes"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in (req.body ?? {})) {
      updates[key] = req.body[key] === null ? null : String(req.body[key]);
    }
  }
  const [updated] = await db
    .update(platformSalesLeadsTable)
    .set(updates as any)
    .where(eq(platformSalesLeadsTable.id, req.params.id))
    .returning();
  res.json(serializeLead(updated));
});

// GET /v1/admin/leads/:id/messages
router.get("/v1/admin/leads/:id/messages", async (req, res): Promise<void> => {
  const [lead] = await db
    .select({ id: platformSalesLeadsTable.id })
    .from(platformSalesLeadsTable)
    .where(eq(platformSalesLeadsTable.id, req.params.id));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const messages = await db
    .select()
    .from(platformSalesLeadMessagesTable)
    .where(eq(platformSalesLeadMessagesTable.leadId, lead.id))
    .orderBy(asc(platformSalesLeadMessagesTable.createdAt));
  res.json(messages.map(serializeMsg));
});

// POST /v1/admin/leads/:id/messages — log interaction
router.post("/v1/admin/leads/:id/messages", async (req, res): Promise<void> => {
  const [lead] = await db
    .select({ id: platformSalesLeadsTable.id })
    .from(platformSalesLeadsTable)
    .where(eq(platformSalesLeadsTable.id, req.params.id));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const { body, channel, direction } = req.body ?? {};
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const authorName = req.auth?.user?.name ?? req.auth?.user?.email ?? "Admin";
  const [msg] = await db
    .insert(platformSalesLeadMessagesTable)
    .values({
      leadId: lead.id,
      body: String(body).trim(),
      channel: channel ? String(channel) : "note",
      direction: direction ? String(direction) : "out",
      authorName,
    })
    .returning();
  res.status(201).json(serializeMsg(msg));
});

// POST /v1/admin/leads/import — CSV bulk import
router.post("/v1/admin/leads/import", async (req, res): Promise<void> => {
  const csvText = req.body?.csv as string | undefined;
  if (!csvText) {
    res.status(400).json({ error: "csv field is required" });
    return;
  }
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    return;
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const required = ["name", "email"];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required columns: ${missing.join(", ")}` });
    return;
  }

  const getCol = (row: string[], col: string): string | null => {
    const idx = headers.indexOf(col);
    if (idx === -1) return null;
    const val = row[idx];
    return val && val.length > 0 ? val : null;
  };

  // Fetch existing emails to detect duplicates
  const existingEmails = new Set(
    (await db.select({ email: platformSalesLeadsTable.email }).from(platformSalesLeadsTable)).map(
      (r) => r.email.toLowerCase(),
    ),
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    const name = getCol(row, "name");
    const email = getCol(row, "email")?.toLowerCase();
    if (!name || !email) {
      errors.push(`Row ${i + 1}: missing name or email`);
      skipped++;
      continue;
    }
    if (existingEmails.has(email)) {
      skipped++;
      continue;
    }
    await db.insert(platformSalesLeadsTable).values({
      name,
      email,
      phone: getCol(row, "phone"),
      company: getCol(row, "company"),
      trade: getCol(row, "trade"),
      source: getCol(row, "source") ?? "import",
      status: getCol(row, "status") ?? "new",
      notes: getCol(row, "notes"),
    });
    existingEmails.add(email);
    imported++;
  }

  res.json({ imported, skipped, errors });
});

function serializeLead(lead: typeof platformSalesLeadsTable.$inferSelect) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone ?? null,
    company: lead.company ?? null,
    trade: lead.trade ?? null,
    source: lead.source,
    status: lead.status,
    notes: lead.notes ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function serializeMsg(msg: typeof platformSalesLeadMessagesTable.$inferSelect) {
  return {
    id: msg.id,
    leadId: msg.leadId,
    channel: msg.channel,
    direction: msg.direction,
    body: msg.body,
    authorName: msg.authorName ?? null,
    createdAt: msg.createdAt.toISOString(),
  };
}

export default router;
