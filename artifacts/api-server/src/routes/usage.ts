import { Router, type IRouter } from "express";
import { requireTenant } from "../middlewares/auth";
import { tenantUsageForWindow } from "../lib/usage";
import { GetTenantUsageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/usage", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await tenantUsageForWindow(tenantId, start, now);
  const parsed = GetTenantUsageResponse.parse({
    tenantId,
    periodStart: start.toISOString(),
    periodEnd: now.toISOString(),
    rows,
  });
  res.json(parsed);
});

export default router;
