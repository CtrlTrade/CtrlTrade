import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  areaManagersTable,
  usersTable,
  membershipsTable,
  branchesTable,
  type AreaManager,
} from "@workspace/db";
import { requireRole, requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const AreaManagerInput = z.object({
  userId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()),
});

async function serializeAreaManager(am: AreaManager, tenantId: string) {
  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, am.userId)));

  const branches =
    am.branchIds.length > 0
      ? await db
          .select({ id: branchesTable.id, name: branchesTable.name })
          .from(branchesTable)
          .where(and(eq(branchesTable.tenantId, tenantId), inArray(branchesTable.id, am.branchIds)))
      : [];

  return {
    id: am.id,
    userId: am.userId,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    branchIds: am.branchIds,
    branches,
    createdAt: am.createdAt.toISOString(),
    updatedAt: am.updatedAt.toISOString(),
  };
}

router.get("/v1/area-managers", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(areaManagersTable)
    .where(eq(areaManagersTable.tenantId, tenantId))
    .orderBy(areaManagersTable.createdAt);
  const serialized = await Promise.all(rows.map((r) => serializeAreaManager(r, tenantId)));
  res.json(serialized);
});

router.post(
  "/v1/area-managers",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = AreaManagerInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;

    const [membership] = await db
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.tenantId, tenantId), eq(membershipsTable.userId, parsed.data.userId)));
    if (!membership) {
      res.status(400).json({ error: "User is not a member of this tenant" });
      return;
    }

    const [row] = await db
      .insert(areaManagersTable)
      .values({ tenantId, userId: parsed.data.userId, branchIds: parsed.data.branchIds })
      .onConflictDoUpdate({
        target: [areaManagersTable.tenantId, areaManagersTable.userId],
        set: { branchIds: parsed.data.branchIds, updatedAt: new Date() },
      })
      .returning();

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "area_manager.created",
      message: `Area manager assigned: userId=${parsed.data.userId}`,
    });

    res.status(201).json(await serializeAreaManager(row, tenantId));
  },
);

router.get("/v1/area-managers/:id", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .select()
    .from(areaManagersTable)
    .where(and(eq(areaManagersTable.tenantId, tenantId), eq(areaManagersTable.id, req.params.id as string)));
  if (!row) {
    res.status(404).json({ error: "Area manager not found" });
    return;
  }
  res.json(await serializeAreaManager(row, tenantId));
});

router.put(
  "/v1/area-managers/:id",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const parsed = AreaManagerInput.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tenantId = req.auth!.tenant!.id;
    const [existing] = await db
      .select()
      .from(areaManagersTable)
      .where(and(eq(areaManagersTable.tenantId, tenantId), eq(areaManagersTable.id, req.params.id as string)));
    if (!existing) {
      res.status(404).json({ error: "Area manager not found" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    if (parsed.data.branchIds !== undefined) updates.branchIds = parsed.data.branchIds;

    const [updated] = await db
      .update(areaManagersTable)
      .set(updates)
      .where(eq(areaManagersTable.id, existing.id))
      .returning();

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "area_manager.updated",
      message: `Area manager updated: id=${existing.id}`,
    });

    res.json(await serializeAreaManager(updated, tenantId));
  },
);

router.delete(
  "/v1/area-managers/:id",
  requireTenant,
  requireRole("owner", "admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const [existing] = await db
      .select()
      .from(areaManagersTable)
      .where(and(eq(areaManagersTable.tenantId, tenantId), eq(areaManagersTable.id, req.params.id as string)));
    if (!existing) {
      res.status(404).json({ error: "Area manager not found" });
      return;
    }

    await db.delete(areaManagersTable).where(eq(areaManagersTable.id, existing.id));

    await logAudit({
      tenantId,
      actorUserId: req.auth!.user.id,
      actorLabel: req.auth!.user.email,
      kind: "area_manager.deleted",
      message: `Area manager removed: id=${existing.id}`,
    });

    res.status(204).end();
  },
);

export default router;
