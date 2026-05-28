import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  tenantsTable,
  membershipsTable,
  subscriptionsTable,
  tradeCategoriesTable,
  tenantTradeCategoriesTable,
  industriesTable,
} from "@workspace/db";
import { eq as drizzleEq } from "drizzle-orm";
import {
  SignupBody,
  LoginBody,
  LoginResponse,
  GetSessionResponse,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword, slugify } from "../lib/auth";
import { serializeTenant, serializeUser, getTenantSubscription } from "../lib/serializers";
import { getUncachableStripeClient, isStripeConnected } from "../stripeClient";
import { ensurePriceIds, buildLineItems } from "../lib/stripeSubscription";
import { PRICING } from "../lib/pricing";
import { logAudit } from "../lib/audit";
import { platformReferralLinksTable, platformReferralConversionsTable } from "@workspace/db";

function readRefCookie(req: { headers: { cookie?: string } }): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === "ctrltrade_ref" && v) return decodeURIComponent(v).toUpperCase();
  }
  return null;
}

const router: IRouter = Router();

router.post("/v1/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;

  if (!(await isStripeConnected())) {
    res.status(503).json({
      error: "Stripe is not yet connected. Connect Stripe via the Integrations tab to enable signup.",
    });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, body.ownerEmail));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const priceIds = await ensurePriceIds();

  // 1. Create Stripe customer
  const customer = await stripe.customers.create({
    email: body.ownerEmail,
    name: body.company.name,
    phone: body.company.phone ?? undefined,
    metadata: { signupCompany: body.company.name },
  });

  // 2. Attach payment method
  await stripe.paymentMethods.attach(body.paymentMethodId, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: body.paymentMethodId },
  });

  // 3. Create subscription with 1 month trial
  const items = buildLineItems(
    {
      controlSeats: body.controlSeats,
      fieldSeats: body.fieldSeats,
      tills: body.tills,
    },
    priceIds,
  );
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items,
    trial_period_days: PRICING.trialDays,
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { signupCompany: body.company.name },
  });

  // 4. Create tenant + user + membership + sub mirror in a transaction
  const passwordHash = await hashPassword(body.ownerPassword);

  let baseSlug = slugify(body.company.name);
  let slug = baseSlug;
  for (let i = 1; ; i++) {
    const found = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
    if (found.length === 0) break;
    slug = `${baseSlug}-${i}`;
    if (i > 20) break;
  }

  const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000)
    : null;

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenantsTable)
      .values({
        name: body.company.name,
        slug,
        status: "trial",
        country: body.company.country ?? null,
        phone: body.company.phone ?? null,
        addressLine1: body.company.addressLine1 ?? null,
        city: body.company.city ?? null,
        postcode: body.company.postcode ?? null,
        companyNumber: body.company.companyNumber ?? null,
        website: (body as any).website ?? null,
        contactName: (body as any).contactName ?? null,
        vatNumber: (body as any).vatNumber ?? null,
        businessType: (body as any).businessType ?? null,
        hasTradeShop: (body as any).hasTradeShop ?? false,
        hasMobileWorkforce: (body as any).hasMobileWorkforce ?? false,
        appointmentBookingEnabled: (body as any).appointmentBookingEnabled ?? false,
        multiBranchEnabled: (body as any).multiBranchEnabled ?? false,
        vatRegistered: (body as any).vatRegistered ?? false,
        accountingProvider: (body as any).accountingProvider ?? null,
        aiModulesEnabled: (body as any).aiModulesEnabled ?? [],
        communicationChannels: (body as any).communicationChannels ?? [],
        posEnabled: (body as any).posEnabled ?? false,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        trialEndsAt,
      })
      .returning();

    const [user] = await tx
      .insert(usersTable)
      .values({
        email: body.ownerEmail,
        name: body.ownerName,
        passwordHash,
      })
      .returning();

    const [membership] = await tx
      .insert(membershipsTable)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        role: "owner",
        seatType: "control",
      })
      .returning();

    if (body.tradeCategorySlugs.length > 0) {
      const cats = await tx
        .select()
        .from(tradeCategoriesTable)
        .where(inArray(tradeCategoriesTable.slug, body.tradeCategorySlugs));
      if (cats.length > 0) {
        await tx.insert(tenantTradeCategoriesTable).values(
          cats.map((c) => ({ tenantId: tenant.id, tradeCategoryId: c.id })),
        );
      }
    }

    const industrySlugValue = (body as any).industrySlug as string | null | undefined;
    if (industrySlugValue) {
      const [ind] = await tx.select().from(industriesTable).where(drizzleEq(industriesTable.slug, industrySlugValue));
      if (ind) {
        await tx.update(tenantsTable).set({ industryId: ind.id }).where(drizzleEq(tenantsTable.id, tenant.id));
        (tenant as any).industryId = ind.id;
      }
    }

    await tx.insert(subscriptionsTable).values({
      tenantId: tenant.id,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      status: "trial",
      controlSeats: body.controlSeats,
      fieldSeats: body.fieldSeats,
      tills: body.tills,
      currency: PRICING.currency,
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });

    return { tenant, user, membership };
    });
  } catch (err) {
    req.log.error({ err }, "Signup DB transaction failed; compensating Stripe resources");
    try {
      await stripe.subscriptions.cancel(subscription.id);
    } catch (cancelErr) {
      req.log.error({ err: cancelErr }, "Failed to cancel orphan Stripe subscription");
    }
    try {
      await stripe.customers.del(customer.id);
    } catch (delErr) {
      req.log.error({ err: delErr }, "Failed to delete orphan Stripe customer");
    }
    res.status(500).json({ error: "Signup failed; please try again." });
    return;
  }

  try {
    const { dispatchNotification } = await import("../lib/notifications");
    const { getAppBaseUrl } = await import("../lib/email");
    await dispatchNotification({
      tenantId: result.tenant.id,
      eventKind: "auth.signup_welcome",
      vars: {
        name: result.user.name,
        tenantName: result.tenant.name,
        appUrl: `${getAppBaseUrl()}/app`,
      },
      to: { email: result.user.email, name: result.user.name },
    });
  } catch (err) {
    req.log.error({ err }, "Signup welcome email failed");
  }

  await logAudit({
    tenantId: result.tenant.id,
    actorUserId: result.user.id,
    actorLabel: result.user.email,
    kind: "tenant.created",
    message: `Tenant ${result.tenant.name} created and trial started.`,
    metadata: {
      controlSeats: body.controlSeats,
      fieldSeats: body.fieldSeats,
      tills: body.tills,
    },
  });

  req.session.userId = result.user.id;
  req.session.tenantId = result.tenant.id;

  // Capture platform referral if present
  const refCode = readRefCookie(req);
  if (refCode) {
    try {
      const [link] = await db.select().from(platformReferralLinksTable).where(eq(platformReferralLinksTable.code, refCode));
      if (link) {
        await db.insert(platformReferralConversionsTable).values({
          partnerId: link.partnerId,
          linkId: link.id,
          tenantId: result.tenant.id,
          status: "signed_up",
        }).onConflictDoNothing();
        res.clearCookie("ctrltrade_ref");
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to record platform referral conversion");
    }
  }

  const tenantPayload = await serializeTenant(result.tenant);
  res.status(201).json({
    user: serializeUser(result.user, result.membership),
    tenant: tenantPayload,
  });
});

router.post("/v1/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.status === "disabled") {
    res.status(403).json({ error: "Account disabled. Contact your administrator." });
    return;
  }

  // If 2FA is enabled, start a pending challenge instead of a full session
  if (user.totpEnabled) {
    req.session.twoFactorPendingUserId = user.id;
    delete req.session.userId;
    delete req.session.tenantId;
    res.json({ twoFactorRequired: true, user: null, tenant: null, impersonation: null });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  // Pick first ACTIVE tenant membership (if any)
  const memberships = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, user.id));
  const firstMembership = memberships.find((m) => m.status === "active") ?? null;
  let tenantPayload: unknown = null;
  if (firstMembership) {
    const [tenant] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, firstMembership.tenantId));
    if (tenant) {
      tenantPayload = await serializeTenant(tenant);
      req.session.tenantId = tenant.id;

      // Check if tenant requires 2FA but user hasn't enrolled
      if (tenant.require2fa && !user.totpEnabled) {
        req.session.userId = user.id;
        res.json(
          LoginResponse.parse({
            user: serializeUser(user, firstMembership),
            tenant: tenantPayload,
            twoFactorSetupRequired: true,
          }),
        );
        return;
      }
    }
  }
  req.session.userId = user.id;

  res.json(
    LoginResponse.parse({
      user: serializeUser(user, firstMembership),
      tenant: tenantPayload,
    }),
  );
});

router.post("/v1/auth/logout", (req, res): void => {
  req.session?.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

router.get("/v1/auth/me", async (req, res): Promise<void> => {
  if (!req.auth?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  let tenantPayload: unknown = null;
  if (req.auth.tenant) tenantPayload = await serializeTenant(req.auth.tenant);
  res.json({
    user: serializeUser(req.auth.user, req.auth.membership),
    tenant: tenantPayload,
    impersonation: req.auth.impersonation,
  });
});

export default router;
