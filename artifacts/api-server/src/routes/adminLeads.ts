import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  platformSalesLeadsTable,
  platformSalesLeadMessagesTable,
} from "@workspace/db";
import { requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.use("/v1/admin", requireSuperAdmin);

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

  // Full-text CSV parser — correctly handles quoted fields containing commas and newlines
  const parsedRows = parseCsvText(csvText);
  if (parsedRows.length < 2) {
    res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    return;
  }

  const rawHeaders = parsedRows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  // Alias map: normalised export header -> internal field name
  const HEADER_ALIASES: Record<string, string> = {
    contact_name: "name",
    contact_email: "email",
    contact_phone: "phone",
    mobile_number: "phone",
    company_name: "company",
    industry: "trade",
  };

  // Build resolved header list (internal field names)
  const headers = rawHeaders.map((h) => HEADER_ALIASES[h] ?? h);

  const getCol = (row: string[], col: string): string | null => {
    const idx = headers.indexOf(col);
    if (idx === -1) return null;
    const val = row[idx];
    return val && val.length > 0 ? val : null;
  };

  const hasNameOrCompanyCol = headers.includes("name") || headers.includes("company");
  const hasContactCol = headers.includes("email") || headers.includes("phone");
  if (!hasNameOrCompanyCol) {
    res.status(400).json({ error: "Missing required columns: need at least one of name, contact_name, company_name" });
    return;
  }
  if (!hasContactCol) {
    res.status(400).json({ error: "Missing required columns: need at least one of email, contact_email, phone, contact_phone, mobile_number" });
    return;
  }

  // Per-row name: prefer contact name, fall back to company name
  const getNameForRow = (row: string[]): string | null =>
    getCol(row, "name") ?? getCol(row, "company");

  // Fetch existing emails + phones for duplicate detection
  const existingRows = await db
    .select({ email: platformSalesLeadsTable.email, phone: platformSalesLeadsTable.phone })
    .from(platformSalesLeadsTable);
  const existingEmails = new Set(
    existingRows.filter((r) => r.email).map((r) => r.email!.toLowerCase()),
  );
  const existingPhones = new Set(
    existingRows.filter((r) => r.phone && !r.email).map((r) => normalisePhone(r.phone!)),
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    const name = getNameForRow(row);
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      skipped++;
      continue;
    }

    const email = getCol(row, "email")?.toLowerCase() ?? null;
    const phoneRaw = getCol(row, "phone");
    const phone = phoneRaw ? normalisePhone(phoneRaw) : null;

    if (!email && !phone) {
      errors.push(`Row ${i + 1}: missing contact info (need email or phone)`);
      skipped++;
      continue;
    }

    // Duplicate detection: by email when present, else by phone
    if (email && existingEmails.has(email)) {
      skipped++;
      continue;
    }
    if (!email && phone && existingPhones.has(phone)) {
      skipped++;
      continue;
    }

    await db.insert(platformSalesLeadsTable).values({
      name,
      email: email ?? null,
      phone: phone ?? null,
      company: getCol(row, "company"),
      trade: getCol(row, "trade"),
      source: getCol(row, "source") ?? "import",
      status: getCol(row, "status") ?? "new",
      notes: getCol(row, "notes"),
    });

    if (email) existingEmails.add(email);
    else if (phone) existingPhones.add(phone);
    imported++;
  }

  res.json({ imported, skipped, errors });
});

function normalisePhone(p: string): string {
  return p.replace(/\s+/g, "").toLowerCase();
}

/**
 * RFC-4180-compliant CSV parser.
 * Correctly handles quoted fields that contain commas, double-quotes (escaped as ""),
 * and embedded newlines (\n or \r\n) — all common in real export files.
 * Returns an array of rows, each row being an array of trimmed field strings.
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(cur.trim());
        cur = "";
      } else if (ch === "\r" && text[i + 1] === "\n") {
        i++;
        row.push(cur.trim());
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else if (ch === "\n" || ch === "\r") {
        row.push(cur.trim());
        cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }

  // Flush the last field / row
  row.push(cur.trim());
  if (row.length > 1 || row[0] !== "") rows.push(row);

  return rows;
}

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
