import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, type Tenant } from "@workspace/db";
import {
  GetBrandingResponse,
  UpdateBrandingBody,
  UpdateBrandingResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

export function serializeBranding(t: Tenant) {
  return {
    tenantId: t.id,
    logoUrl: t.logoUrl,
    logoPortalUrl: t.logoPortalUrl,
    logoPosUrl: t.logoPosUrl,
    faviconUrl: t.faviconUrl,
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    surfaceColor: t.surfaceColor,
    brandColor: t.brandColor,
    fontFamily: t.fontFamily,
    brandTemplates: t.brandTemplates ?? null,
  };
}

router.get("/v1/branding", requireTenant, async (req, res): Promise<void> => {
  res.json(GetBrandingResponse.parse(serializeBranding(req.auth!.tenant!)));
});

router.patch("/v1/branding", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateBrandingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const updates: Record<string, unknown> = {};
  for (const k of [
    "logoUrl",
    "logoPortalUrl",
    "logoPosUrl",
    "faviconUrl",
    "primaryColor",
    "accentColor",
    "surfaceColor",
    "brandColor",
    "fontFamily",
    "brandTemplates",
  ] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  if (Object.keys(updates).length > 0) {
    await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, tenantId));
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "branding.updated",
    message: "Branding updated",
    metadata: Object.keys(updates).reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = true;
      return acc;
    }, {}),
  });
  const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json(UpdateBrandingResponse.parse(serializeBranding(t)));
});

export default router;
