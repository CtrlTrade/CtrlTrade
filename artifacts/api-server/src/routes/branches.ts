import { Router, type IRouter } from "express";
import { and, eq, count, sum, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  branchesTable,
  jobsTable,
  membershipsTable,
  usersTable,
  invoicesTable,
  type Branch,
} from "@workspace/db";
import { requireRole, requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const BranchInput = z.object({
  name: z.string().min(1),
  addressLine1: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
});

function serializeBranch(b: Branch) {
  return {
    id: b.id,
    name: b.name,
    addressLine1: b.addressLine1,
    city: b.city,
    postcode: b.postcode,
    phone: b.phone,
    region: b.region,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

router.get("/v1/branches", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.tenantId, tenantId))
    .orderBy(branchesTable.name);
  res.json(rows.map(serializeBranch));
});

router.post(
  "/v1/branches",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = BranchInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const [row] = await db
      .insert(branchesTable)
      .values({ tenantId, ...parsed.data })
      .returning();
    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "branch.created",
      message: `Branch created: ${row.name}`,
    });
    res.status(201).json(serializeBranch(row));
  },
);

router.get("/v1/branches/:id", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const branchId = req.params.id as string;

  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.tenantId, tenantId), eq(branchesTable.id, branchId)));
  if (!branch) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  const [jobStats] = await db
    .select({ total: count(), activeJobs: count(sql`CASE WHEN ${jobsTable.status} IN ('scheduled','in_progress') THEN 1 END`) })
    .from(jobsTable)
    .where(and(eq(jobsTable.tenantId, tenantId), eq(jobsTable.branchId, branchId)));

  const [revenueStats] = await db
    .select({ totalPence: sum(invoicesTable.totalPence) })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "paid"),
      sql`${invoicesTable.jobId} IN (SELECT id FROM jobs WHERE branch_id = ${branchId} AND tenant_id = ${tenantId})`,
    ));

  const staffRows = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: membershipsTable.role,
      seatType: membershipsTable.seatType,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(and(
      eq(membershipsTable.tenantId, tenantId),
      eq(membershipsTable.branchId, branchId),
      eq(membershipsTable.status, "active"),
    ));

  res.json({
    ...serializeBranch(branch),
    stats: {
      totalJobs: jobStats?.total ?? 0,
      activeJobs: jobStats?.activeJobs ?? 0,
      revenuePaidPence: Number(revenueStats?.totalPence ?? 0),
      staffCount: staffRows.length,
    },
    staff: staffRows,
  });
});

router.put(
  "/v1/branches/:id",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = BranchInput.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const branchId = req.params.id as string;

    const [existing] = await db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.tenantId, tenantId), eq(branchesTable.id, branchId)));
    if (!existing) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [updated] = await db
      .update(branchesTable)
      .set(parsed.data)
      .where(eq(branchesTable.id, branchId))
      .returning();

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "branch.updated",
      message: `Branch updated: ${updated.name}`,
    });

    res.json(serializeBranch(updated));
  },
);

router.delete(
  "/v1/branches/:id",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const branchId = req.params.id as string;

    const [existing] = await db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.tenantId, tenantId), eq(branchesTable.id, branchId)));
    if (!existing) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    await db.delete(branchesTable).where(eq(branchesTable.id, branchId));

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "branch.deleted",
      message: `Branch deleted: ${existing.name}`,
    });

    res.status(204).end();
  },
);

export default router;
