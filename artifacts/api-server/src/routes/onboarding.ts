import { Router, type IRouter } from "express";
import { GetOnboardingResponse } from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { getTenantSubscription, getTradeCategorySlugs } from "../lib/serializers";

const router: IRouter = Router();

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
