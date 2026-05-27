import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, membershipsTable, usersTable } from "@workspace/db";
import { ListTeamResponse } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/team", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: membershipsTable.role,
      seatType: membershipsTable.seatType,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(eq(membershipsTable.tenantId, tenantId));
  res.json(ListTeamResponse.parse(rows));
});

export default router;
