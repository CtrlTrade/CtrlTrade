import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  jobCostEntriesTable,
  usersTable,
  productsTable,
  membershipsTable,
  type JobCostEntry,
} from "@workspace/db";
import { requireTenant } from "../middlewares/auth";
import {
  CreateJobCostEntryBody as CreateCostEntryBody,
  UpdateJobCostEntryBody as UpdateCostEntryBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_KINDS = new Set(["labour", "material", "other"]);

function computeTotal(quantity: number, unitCostPence: number): number {
  return Math.round(quantity * unitCostPence);
}

function serializeEntry(
  e: JobCostEntry,
  userName: string | null,
  productName: string | null,
) {
  return {
    id: e.id,
    jobId: e.jobId,
    kind: e.kind,
    description: e.description,
    quantity: parseFloat(e.quantity),
    unitCostPence: e.unitCostPence,
    totalCostPence: e.totalCostPence,
    productId: e.productId ?? null,
    productName,
    userId: e.userId ?? null,
    userName,
    createdByUserId: e.createdByUserId ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function loadEntry(tenantId: string, jobId: string, costId: string) {
  const [row] = await db
    .select({
      e: jobCostEntriesTable,
      userName: usersTable.name,
      productName: productsTable.name,
    })
    .from(jobCostEntriesTable)
    .leftJoin(usersTable, eq(usersTable.id, jobCostEntriesTable.userId))
    .leftJoin(productsTable, eq(productsTable.id, jobCostEntriesTable.productId))
    .where(
      and(
        eq(jobCostEntriesTable.tenantId, tenantId),
        eq(jobCostEntriesTable.jobId, jobId),
        eq(jobCostEntriesTable.id, costId),
      ),
    );
  return row;
}

// GET /v1/jobs/:jobId/costs — list all cost entries and summary
router.get("/v1/jobs/:jobId/costs", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const jobId = req.params.jobId as string;

  const [job] = await db
    .select({ id: jobsTable.id, valuePence: jobsTable.valuePence })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const rows = await db
    .select({
      e: jobCostEntriesTable,
      userName: usersTable.name,
      productName: productsTable.name,
    })
    .from(jobCostEntriesTable)
    .leftJoin(usersTable, eq(usersTable.id, jobCostEntriesTable.userId))
    .leftJoin(productsTable, eq(productsTable.id, jobCostEntriesTable.productId))
    .where(
      and(eq(jobCostEntriesTable.tenantId, tenantId), eq(jobCostEntriesTable.jobId, jobId)),
    )
    .orderBy(jobCostEntriesTable.createdAt);

  const entries = rows.map((r) => serializeEntry(r.e, r.userName ?? null, r.productName ?? null));

  const labourCost = entries
    .filter((e) => e.kind === "labour")
    .reduce((s, e) => s + e.totalCostPence, 0);
  const materialCost = entries
    .filter((e) => e.kind === "material")
    .reduce((s, e) => s + e.totalCostPence, 0);
  const otherCost = entries
    .filter((e) => e.kind === "other")
    .reduce((s, e) => s + e.totalCostPence, 0);
  const actualCostPence = labourCost + materialCost + otherCost;
  const quotedValuePence = job.valuePence ?? 0;
  const grossMarginPct =
    quotedValuePence > 0
      ? Math.round(((quotedValuePence - actualCostPence) / quotedValuePence) * 100)
      : 0;

  res.json({
    entries,
    quotedValuePence,
    actualCostPence,
    grossMarginPct,
    labourCostPence: labourCost,
    materialCostPence: materialCost,
    otherCostPence: otherCost,
  });
});

// POST /v1/jobs/:jobId/costs — add a cost entry
router.post("/v1/jobs/:jobId/costs", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateCostEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const jobId = req.params.jobId as string;

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.id, jobId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (!VALID_KINDS.has(parsed.data.kind)) {
    res.status(400).json({ error: "kind must be labour, material, or other" });
    return;
  }

  // If product provided, look up its cost
  let unitCostPence = parsed.data.unitCostPence ?? 0;
  let productName: string | null = null;
  if (parsed.data.productId) {
    const [product] = await db
      .select({ costPence: productsTable.costPence, name: productsTable.name })
      .from(productsTable)
      .where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.id, parsed.data.productId)));
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    if (parsed.data.unitCostPence === undefined || parsed.data.unitCostPence === 0) {
      unitCostPence = product.costPence;
    }
    productName = product.name;
  }

  // If labour and userId provided, look up their default hourly rate
  let userName: string | null = null;
  if (parsed.data.userId) {
    const [member] = await db
      .select({ defaultHourlyRatePence: membershipsTable.defaultHourlyRatePence, name: usersTable.name })
      .from(membershipsTable)
      .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, parsed.data.userId)));
    if (member) {
      userName = member.name;
      if (
        parsed.data.kind === "labour" &&
        (parsed.data.unitCostPence === undefined || parsed.data.unitCostPence === 0) &&
        member.defaultHourlyRatePence
      ) {
        unitCostPence = member.defaultHourlyRatePence;
      }
    }
  }

  const quantity = parsed.data.quantity ?? 1;
  const totalCostPence = computeTotal(quantity, unitCostPence);

  const [entry] = await db
    .insert(jobCostEntriesTable)
    .values({
      tenantId,
      jobId,
      kind: parsed.data.kind,
      description: parsed.data.description,
      quantity: String(quantity),
      unitCostPence,
      totalCostPence,
      productId: parsed.data.productId ?? null,
      userId: parsed.data.userId ?? null,
      createdByUserId: req.auth!.user.id,
    })
    .returning();

  res.status(201).json(serializeEntry(entry, userName, productName));
});

// PATCH /v1/jobs/:jobId/costs/:costId — update a cost entry
router.patch("/v1/jobs/:jobId/costs/:costId", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateCostEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const jobId = req.params.jobId as string;
  const costId = req.params.costId as string;

  const existing = await loadEntry(tenantId, jobId, costId);
  if (!existing) {
    res.status(404).json({ error: "Cost entry not found" });
    return;
  }

  if (parsed.data.kind && !VALID_KINDS.has(parsed.data.kind)) {
    res.status(400).json({ error: "kind must be labour, material, or other" });
    return;
  }

  const updates: Partial<typeof jobCostEntriesTable.$inferInsert> = {};
  if (parsed.data.kind !== undefined) updates.kind = parsed.data.kind;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.productId !== undefined) updates.productId = parsed.data.productId;
  if (parsed.data.userId !== undefined) updates.userId = parsed.data.userId;

  const newQuantity = parsed.data.quantity ?? parseFloat(existing.e.quantity);
  const newUnitCost = parsed.data.unitCostPence ?? existing.e.unitCostPence;
  updates.quantity = String(newQuantity);
  updates.unitCostPence = newUnitCost;
  updates.totalCostPence = computeTotal(newQuantity, newUnitCost);

  const [updated] = await db
    .update(jobCostEntriesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(jobCostEntriesTable.id, costId))
    .returning();

  const row = await loadEntry(tenantId, jobId, updated.id);
  if (!row) {
    res.status(500).json({ error: "Failed to reload entry" });
    return;
  }
  res.json(serializeEntry(row.e, row.userName ?? null, row.productName ?? null));
});

// DELETE /v1/jobs/:jobId/costs/:costId — delete a cost entry
router.delete("/v1/jobs/:jobId/costs/:costId", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const jobId = req.params.jobId as string;
  const costId = req.params.costId as string;

  const [existing] = await db
    .select({ id: jobCostEntriesTable.id })
    .from(jobCostEntriesTable)
    .where(
      and(
        eq(jobCostEntriesTable.tenantId, tenantId),
        eq(jobCostEntriesTable.jobId, jobId),
        eq(jobCostEntriesTable.id, costId),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Cost entry not found" });
    return;
  }

  await db.delete(jobCostEntriesTable).where(eq(jobCostEntriesTable.id, costId));
  res.status(204).end();
});

export default router;
