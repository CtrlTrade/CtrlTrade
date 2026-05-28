import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { z } from "zod/v4";
import { db, staffNotificationsTable, membershipsTable } from "@workspace/db";
import { requireTenant } from "../middlewares/auth";

const router: IRouter = Router();

const StaffNotificationItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  message: z.string(),
  linkPath: z.string().nullable().optional(),
  createdAt: z.string(),
});

router.get(
  "/v1/staff-notifications",
  requireTenant,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const rows = await db
      .select()
      .from(staffNotificationsTable)
      .where(eq(staffNotificationsTable.tenantId, tenantId))
      .orderBy(desc(staffNotificationsTable.createdAt))
      .limit(50);
    res.json(
      rows.map((n) =>
        StaffNotificationItemSchema.parse({
          id: n.id,
          kind: n.kind,
          title: n.title,
          message: n.message,
          linkPath: n.linkPath,
          createdAt: n.createdAt.toISOString(),
        }),
      ),
    );
  },
);

router.get(
  "/v1/staff-notifications/unread-count",
  requireTenant,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const userId = req.auth!.user.id;

    const [membership] = await db
      .select({ lastNotificationsViewedAt: membershipsTable.lastNotificationsViewedAt })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.tenantId, tenantId),
          eq(membershipsTable.userId, userId),
        ),
      );

    const lastViewed = membership?.lastNotificationsViewedAt ?? null;

    const whereClause = lastViewed
      ? and(
          eq(staffNotificationsTable.tenantId, tenantId),
          gt(staffNotificationsTable.createdAt, lastViewed),
        )
      : eq(staffNotificationsTable.tenantId, tenantId);

    const [result] = await db
      .select({ total: count() })
      .from(staffNotificationsTable)
      .where(whereClause);

    res.json({ count: result?.total ?? 0 });
  },
);

router.post(
  "/v1/staff-notifications/mark-read",
  requireTenant,
  async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.auth!.tenant!.id;
    const userId = req.auth!.user.id;
    await db
      .update(membershipsTable)
      .set({ lastNotificationsViewedAt: new Date() })
      .where(
        and(
          eq(membershipsTable.tenantId, tenantId),
          eq(membershipsTable.userId, userId),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
