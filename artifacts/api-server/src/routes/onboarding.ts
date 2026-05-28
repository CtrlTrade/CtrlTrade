import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, industriesTable, tenantsTable } from "@workspace/db";
import { GetOnboardingResponse, GetIndustryTourResponse } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { getTenantSubscription, getTradeCategorySlugs } from "../lib/serializers";

const router: IRouter = Router();

router.get("/v1/onboarding/industry-tour", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;

  const dismissed = tenant.industryTourDismissedAt !== null && tenant.industryTourDismissedAt !== undefined;

  let industryName: string | null = null;
  let industrySlug: string | null = null;
  if (tenant.industryId) {
    const [ind] = await db
      .select({ name: industriesTable.name, slug: industriesTable.slug })
      .from(industriesTable)
      .where(eq(industriesTable.id, tenant.industryId));
    if (ind) {
      industryName = ind.name;
      industrySlug = ind.slug;
    }
  }

  const enabledModules: string[] = [];
  if (tenant.hasTradeShop) enabledModules.push("Trade Shop");
  if (tenant.hasMobileWorkforce) enabledModules.push("Mobile Workforce");
  if (tenant.appointmentBookingEnabled) enabledModules.push("Appointment Booking");
  if (tenant.multiBranchEnabled) enabledModules.push("Multi-Branch");
  if (tenant.posEnabled) enabledModules.push("Point of Sale");
  if (tenant.aiModulesEnabled && tenant.aiModulesEnabled.length > 0) enabledModules.push("AI Modules");

  const quickActions = buildQuickActions(tenant);

  res.json(
    GetIndustryTourResponse.parse({
      dismissed,
      industryName,
      industrySlug,
      enabledModules,
      quickActions,
    }),
  );
});

router.post("/v1/onboarding/industry-tour/dismiss", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  await db
    .update(tenantsTable)
    .set({ industryTourDismissedAt: new Date() })
    .where(eq(tenantsTable.id, tenantId));
  res.status(204).end();
});

function buildQuickActions(tenant: {
  industryId?: string | null;
  hasTradeShop: boolean;
  hasMobileWorkforce: boolean;
  appointmentBookingEnabled: boolean;
  posEnabled: boolean;
}): Array<{ key: string; label: string; description: string; href: string }> {
  const actions: Array<{ key: string; label: string; description: string; href: string }> = [];

  actions.push({
    key: "create_job",
    label: "Create your first job",
    description: "Start managing work orders, assign staff, and track progress.",
    href: "/app/jobs",
  });

  actions.push({
    key: "view_checklists",
    label: "View your pre-built compliance checklists",
    description: "Industry-specific safety and compliance checklists are ready to use.",
    href: "/app/compliance",
  });

  actions.push({
    key: "add_customer",
    label: "Add your first customer",
    description: "Build your customer database with contact details and job history.",
    href: "/app/customers",
  });

  if (tenant.hasMobileWorkforce) {
    actions.push({
      key: "invite_field_staff",
      label: "Set up your mobile field crew",
      description: "Invite field staff to the mobile app to receive jobs and check in on-site.",
      href: "/app/team",
    });
  } else if (tenant.posEnabled) {
    actions.push({
      key: "configure_pos",
      label: "Configure your Point of Sale",
      description: "Set up products, pricing, and tills for your shop or counter.",
      href: "/app/pos",
    });
  } else if (tenant.appointmentBookingEnabled) {
    actions.push({
      key: "booking_setup",
      label: "Set up appointment booking",
      description: "Configure your booking widget so customers can self-schedule online.",
      href: "/app/settings",
    });
  } else {
    actions.push({
      key: "send_first_quote",
      label: "Send your first quote",
      description: "Use pre-built industry templates to create and send a professional quote.",
      href: "/app/quotes",
    });
  }

  actions.push({
    key: "complete_profile",
    label: "Complete your company profile",
    description: "Add your logo, brand colors, and business details for customer-facing documents.",
    href: "/app/settings",
  });

  return actions.slice(0, 5);
}

router.get("/v1/onboarding", requireTenant, async (req, res): Promise<void> => {
  const tenant = req.auth!.tenant!;
  const sub = await getTenantSubscription(tenant.id);
  const slugs = await getTradeCategorySlugs(tenant.id);

  const items = [
    {
      key: "company_profile",
      label: "Complete your company profile",
      description: "Phone, address, company number — appears on quotes and invoices.",
      complete: Boolean(tenant.phone && tenant.addressLine1 && tenant.city && tenant.postcode),
      href: "/app/settings",
    },
    {
      key: "branding",
      label: "Add your brand color & logo",
      description: "Used on customer-facing quotes, invoices, and the customer portal.",
      complete: Boolean(tenant.brandColor && tenant.logoUrl),
      href: "/app/settings",
    },
    {
      key: "trade_categories",
      label: "Confirm your trade categories",
      description: "Drives the job types and compliance checklists available in CRM.",
      complete: slugs.length > 0,
      href: "/app/settings",
    },
    {
      key: "subscription",
      label: "Subscription started",
      description: "Your 1-month free trial is live. Add seats anytime.",
      complete: Boolean(sub),
      href: "/app",
    },
    {
      key: "invite_team",
      label: "Invite your team",
      description: "Add Control Seats for back office and Field Seats for crew.",
      complete: false,
      href: "/app",
    },
    {
      key: "first_customer",
      label: "Add your first customer",
      description: "Customers, jobs, quotes and invoices land in Layer 2 (coming soon).",
      complete: false,
      href: "/app",
    },
  ];

  const completed = items.filter((i) => i.complete).length;
  const percentComplete = Math.round((completed / items.length) * 100);

  res.json(GetOnboardingResponse.parse({ items, percentComplete }));
});

export default router;
