import { Router, type IRouter } from "express";
import { GetExpiryAttentionResponse } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { collectTenantExpiries, EXPIRY_WINDOW_DAYS } from "../lib/expiryDigest";

const router: IRouter = Router();

router.get("/v1/dashboard/expiry-attention", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const items = await collectTenantExpiries(tenantId);
  const expiredCount = items.filter((i) => i.expired).length;
  res.json(
    GetExpiryAttentionResponse.parse({
      windowDays: EXPIRY_WINDOW_DAYS,
      expiredCount,
      expiringCount: items.length - expiredCount,
      items: items.slice(0, 25),
    }),
  );
});

export default router;
