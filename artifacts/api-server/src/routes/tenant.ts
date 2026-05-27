import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  tradeCategoriesTable,
  tenantTradeCategoriesTable,
} from "@workspace/db";
import {
  GetTenantResponse,
  UpdateTenantBody,
  UpdateTenantResponse,
  CancelTenantBody,
  CancelTenantResponse,
  SyncTenantFromStripeResponse,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { serializeTenant, serializeSubscription, getTenantSubscription } from "../lib/serializers";
import { logAudit } from "../lib/audit";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { reconcileFromStripeSubscription } from "../lib/stripeReconcile";

const router: IRouter = Router();

router.get("/v1/tenant", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  res.json(GetTenantResponse.parse(await serializeTenant(tenant)));
});

router.patch("/v1/tenant", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpdateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const updates: Record<string, unknown> = {};
  for (const k of ["name", "country", "phone", "addressLine1", "city", "postcode", "brandColor", "logoUrl"] as const) {
    if (parsed.data[k] !== undefined) updates[k] = parsed.data[k];
  }
  if (parsed.data.leadCaptureAllowedOrigins !== undefined) {
    updates.leadCaptureAllowedOrigins = parsed.data.leadCaptureAllowedOrigins
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }
  if (Object.keys(updates).length > 0) {
    await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, tenantId));
  }
  if (parsed.data.tradeCategorySlugs) {
    await db.transaction(async (tx) => {
      await tx
        .delete(tenantTradeCategoriesTable)
        .where(eq(tenantTradeCategoriesTable.tenantId, tenantId));
      if (parsed.data.tradeCategorySlugs!.length > 0) {
        const cats = await tx
          .select()
          .from(tradeCategoriesTable)
          .where(inArray(tradeCategoriesTable.slug, parsed.data.tradeCategorySlugs!));
        if (cats.length > 0) {
          await tx.insert(tenantTradeCategoriesTable).values(
            cats.map((c) => ({ tenantId, tradeCategoryId: c.id })),
          );
        }
      }
    });
  }
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "tenant.updated",
    message: `Tenant profile updated.`,
    metadata: parsed.data as Record<string, unknown>,
  });
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json(UpdateTenantResponse.parse(await serializeTenant(tenant)));
});

router.post("/v1/tenant/cancel", requireTenant, async (req, res): Promise<void> => {
  const parsed = CancelTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tenant = req.auth!.tenant!;
  if (await isStripeConnected()) {
    try {
      const stripe = await getUncachableStripeClient();
      if (tenant.stripeSubscriptionId) {
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
          cancel_at_period_end: true,
          metadata: { cancellationReason: parsed.data.reason },
        });
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to cancel Stripe subscription");
    }
  }
  const now = new Date();
  await db
    .update(tenantsTable)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(tenantsTable.id, tenant.id));
  await logAudit({
    tenantId: tenant.id,
    actorUserId: req.auth!.user.id,
    actorLabel: req.auth!.user.email,
    kind: "tenant.cancelled",
    message: `Tenant cancelled. Reason: ${parsed.data.reason}`,
    metadata: { feedback: parsed.data.feedback },
  });
  res.json(
    CancelTenantResponse.parse({
      tenantId: tenant.id,
      cancelledAt: now.toISOString(),
      exportUrl: `/api/v1/tenant/${tenant.id}/export`,
    }),
  );
});

router.post("/v1/tenant/sync-stripe", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not connected" });
    return;
  }
  if (tenant.stripeSubscriptionId) {
    await reconcileFromStripeSubscription(tenant.stripeSubscriptionId, "manual.sync");
  }
  const sub = await getTenantSubscription(tenant.id);
  if (!sub) {
    res.status(404).json({ error: "No subscription" });
    return;
  }
  res.json(SyncTenantFromStripeResponse.parse(serializeSubscription(sub)));
});

export default router;
