import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import {
  db,
  marketplaceListingsTable,
  marketplacePostsTable,
  marketplaceApplicationsTable,
  marketplaceReviewsTable,
  tenantsTable,
  customerReviewsTable,
  type MarketplaceListing,
} from "@workspace/db";
import {
  UpsertMyMarketplaceListingBody,
  CreateMarketplacePostBody,
  CreateMarketplaceApplicationBody,
  DecideMarketplaceApplicationBody,
  CreateMarketplaceReviewBody,
} from "@workspace/api-zod";
import { requireTenant } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "listing";
}

async function summarizeListing(l: MarketplaceListing, tenantName: string, brandColor: string | null, logoUrl: string | null) {
  // Aggregate marketplace + customer reviews for star rating
  const [{ avgM, cntM }] = await db.select({
    avgM: sql<number>`coalesce(avg(rating),0)::float`,
    cntM: sql<number>`count(*)::int`,
  }).from(marketplaceReviewsTable).where(eq(marketplaceReviewsTable.listingId, l.id));
  const [{ avgC, cntC }] = await db.select({
    avgC: sql<number>`coalesce(avg(rating),0)::float`,
    cntC: sql<number>`count(*)::int`,
  }).from(customerReviewsTable).where(eq(customerReviewsTable.tenantId, l.tenantId));
  const totalCount = (cntM ?? 0) + (cntC ?? 0);
  const ratingAverage = totalCount > 0
    ? Number((((avgM ?? 0) * (cntM ?? 0) + (avgC ?? 0) * (cntC ?? 0)) / totalCount).toFixed(2))
    : null;
  return {
    id: l.id,
    tenantId: l.tenantId,
    slug: l.slug,
    headline: l.headline,
    listingType: l.listingType,
    categorySlugs: l.categorySlugs ?? [],
    regions: l.regions ?? [],
    serviceArea: l.serviceArea,
    hourlyRatePence: l.hourlyRatePence,
    verified: l.verified,
    status: l.status,
    ratingAverage,
    reviewCount: totalCount,
    tenantName,
    brandColor,
    logoUrl,
  };
}

// ---- Public ---------------------------------------------------------------

router.get("/v1/public/marketplace/listings", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  const category = (req.query.category as string | undefined)?.trim();
  const region = (req.query.region as string | undefined)?.trim();
  const type = (req.query.type as string | undefined)?.trim();

  const conds = [eq(marketplaceListingsTable.status, "published")];
  if (q) conds.push(or(ilike(marketplaceListingsTable.headline, `%${q}%`), ilike(marketplaceListingsTable.bio, `%${q}%`))!);
  if (type) conds.push(eq(marketplaceListingsTable.listingType, type));
  if (category) conds.push(sql`${category} = ANY (${marketplaceListingsTable.categorySlugs})`);
  if (region) conds.push(sql`${region} = ANY (${marketplaceListingsTable.regions})`);

  const rows = await db.select({
    listing: marketplaceListingsTable,
    tenantName: tenantsTable.name,
    brandColor: tenantsTable.brandColor,
    logoUrl: tenantsTable.logoUrl,
  })
  .from(marketplaceListingsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceListingsTable.tenantId))
  .where(and(...conds))
  .orderBy(desc(marketplaceListingsTable.verified), desc(marketplaceListingsTable.publishedAt))
  .limit(60);

  const out = await Promise.all(rows.map(r => summarizeListing(r.listing, r.tenantName, r.brandColor, r.logoUrl)));
  res.json(out.map(o => (o)));
});

router.get("/v1/public/marketplace/listings/:slug", async (req, res): Promise<void> => {
  const [row] = await db.select({
    listing: marketplaceListingsTable,
    tenantName: tenantsTable.name,
    brandColor: tenantsTable.brandColor,
    logoUrl: tenantsTable.logoUrl,
  })
  .from(marketplaceListingsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceListingsTable.tenantId))
  .where(and(eq(marketplaceListingsTable.slug, req.params.slug as string), eq(marketplaceListingsTable.status, "published")));
  if (!row) { res.status(404).json({ error: "Listing not found" }); return; }
  const summary = await summarizeListing(row.listing, row.tenantName, row.brandColor, row.logoUrl);
  const reviews = await db.select({
    id: marketplaceReviewsTable.id,
    reviewerTenantId: marketplaceReviewsTable.reviewerTenantId,
    reviewerTenantName: tenantsTable.name,
    rating: marketplaceReviewsTable.rating,
    comment: marketplaceReviewsTable.comment,
    createdAt: marketplaceReviewsTable.createdAt,
  })
  .from(marketplaceReviewsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceReviewsTable.reviewerTenantId))
  .where(eq(marketplaceReviewsTable.listingId, row.listing.id))
  .orderBy(desc(marketplaceReviewsTable.createdAt))
  .limit(50);

  res.json(({
    ...summary,
    bio: row.listing.bio,
    minJobValuePence: row.listing.minJobValuePence,
    contactEmail: row.listing.contactEmail,
    contactPhone: row.listing.contactPhone,
    websiteUrl: row.listing.websiteUrl,
    galleryUrls: row.listing.galleryUrls ?? [],
    createdAt: row.listing.createdAt.toISOString(),
    reviews: reviews.map(rv => ({
      id: rv.id,
      reviewerTenantId: rv.reviewerTenantId,
      reviewerTenantName: rv.reviewerTenantName,
      rating: rv.rating,
      comment: rv.comment,
      createdAt: rv.createdAt.toISOString(),
    })),
  }));
});

// ---- Tenant listing -------------------------------------------------------

router.get("/v1/marketplace/listing", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db.select({
    listing: marketplaceListingsTable,
    tenantName: tenantsTable.name,
    brandColor: tenantsTable.brandColor,
    logoUrl: tenantsTable.logoUrl,
  })
  .from(marketplaceListingsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceListingsTable.tenantId))
  .where(eq(marketplaceListingsTable.tenantId, tenantId));
  if (!row) { res.status(404).json({ error: "No listing yet" }); return; }
  const summary = await summarizeListing(row.listing, row.tenantName, row.brandColor, row.logoUrl);
  const reviews = await db.select({
    id: marketplaceReviewsTable.id,
    reviewerTenantId: marketplaceReviewsTable.reviewerTenantId,
    reviewerTenantName: tenantsTable.name,
    rating: marketplaceReviewsTable.rating,
    comment: marketplaceReviewsTable.comment,
    createdAt: marketplaceReviewsTable.createdAt,
  })
  .from(marketplaceReviewsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceReviewsTable.reviewerTenantId))
  .where(eq(marketplaceReviewsTable.listingId, row.listing.id))
  .orderBy(desc(marketplaceReviewsTable.createdAt));
  res.json(({
    ...summary,
    bio: row.listing.bio,
    minJobValuePence: row.listing.minJobValuePence,
    contactEmail: row.listing.contactEmail,
    contactPhone: row.listing.contactPhone,
    websiteUrl: row.listing.websiteUrl,
    galleryUrls: row.listing.galleryUrls ?? [],
    createdAt: row.listing.createdAt.toISOString(),
    reviews: reviews.map(rv => ({
      id: rv.id, reviewerTenantId: rv.reviewerTenantId, reviewerTenantName: rv.reviewerTenantName,
      rating: rv.rating, comment: rv.comment, createdAt: rv.createdAt.toISOString(),
    })),
  }));
});

router.put("/v1/marketplace/listing", requireTenant, async (req, res): Promise<void> => {
  const parsed = UpsertMyMarketplaceListingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const tenant = req.auth!.tenant!;

  const [existing] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.tenantId, tenantId));
  const values = {
    tenantId,
    headline: parsed.data.headline,
    bio: parsed.data.bio ?? null,
    listingType: parsed.data.listingType,
    categorySlugs: parsed.data.categorySlugs ?? [],
    serviceArea: parsed.data.serviceArea ?? null,
    regions: parsed.data.regions ?? [],
    hourlyRatePence: parsed.data.hourlyRatePence ?? null,
    minJobValuePence: parsed.data.minJobValuePence ?? null,
    contactEmail: parsed.data.contactEmail ?? null,
    contactPhone: parsed.data.contactPhone ?? null,
    websiteUrl: parsed.data.websiteUrl ?? null,
    galleryUrls: parsed.data.galleryUrls ?? [],
    status: parsed.data.status,
    publishedAt: parsed.data.status === "published" && (!existing || existing.status !== "published") ? new Date() : (existing?.publishedAt ?? null),
  };
  let row: MarketplaceListing;
  if (existing) {
    [row] = await db.update(marketplaceListingsTable).set(values).where(eq(marketplaceListingsTable.id, existing.id)).returning();
  } else {
    let slug = slugify(tenant.slug ?? tenant.name);
    // Ensure unique
    const [collide] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.slug, slug));
    if (collide) slug = `${slug}-${tenantId.slice(0,6)}`;
    [row] = await db.insert(marketplaceListingsTable).values({ ...values, slug }).returning();
  }
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "marketplace_listing.upserted", message: `Listing ${row.status}` });
  const summary = await summarizeListing(row, tenant.name, tenant.brandColor, tenant.logoUrl);
  res.json(({
    ...summary,
    bio: row.bio,
    minJobValuePence: row.minJobValuePence,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    websiteUrl: row.websiteUrl,
    galleryUrls: row.galleryUrls ?? [],
    createdAt: row.createdAt.toISOString(),
    reviews: [],
  }));
});

// ---- Marketplace posts (jobs / supplier requests) -------------------------

router.get("/v1/marketplace/posts", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const scope = (req.query.scope as string | undefined) ?? "all";
  const conds = scope === "mine"
    ? [eq(marketplacePostsTable.tenantId, tenantId)]
    : [eq(marketplacePostsTable.status, "open")];
  const rows = await db.select({
    post: marketplacePostsTable,
    tenantName: tenantsTable.name,
    appCount: sql<number>`(select count(*) from marketplace_applications a where a.post_id = ${marketplacePostsTable.id})::int`,
  })
  .from(marketplacePostsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplacePostsTable.tenantId))
  .where(and(...conds))
  .orderBy(desc(marketplacePostsTable.createdAt))
  .limit(100);
  res.json(rows.map(r => ({
    id: r.post.id,
    tenantId: r.post.tenantId,
    tenantName: r.tenantName,
    kind: r.post.kind,
    title: r.post.title,
    description: r.post.description,
    categorySlugs: r.post.categorySlugs ?? [],
    region: r.post.region,
    budgetPence: r.post.budgetPence,
    status: r.post.status,
    closesAt: r.post.closesAt ? r.post.closesAt.toISOString() : null,
    applicationCount: r.appCount,
    createdAt: r.post.createdAt.toISOString(),
  })));
});

router.post("/v1/marketplace/posts", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateMarketplacePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db.insert(marketplacePostsTable).values({
    tenantId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description,
    categorySlugs: parsed.data.categorySlugs ?? [],
    region: parsed.data.region ?? null,
    budgetPence: parsed.data.budgetPence ?? null,
    status: parsed.data.status ?? "open",
    closesAt: parsed.data.closesAt ?? null,
  }).returning();
  res.status(201).json(({
    id: row.id, tenantId: row.tenantId, tenantName: req.auth!.tenant!.name,
    kind: row.kind, title: row.title, description: row.description,
    categorySlugs: row.categorySlugs ?? [], region: row.region, budgetPence: row.budgetPence,
    status: row.status, closesAt: row.closesAt ? row.closesAt.toISOString() : null,
    applicationCount: 0, createdAt: row.createdAt.toISOString(),
  }));
});

router.patch("/v1/marketplace/posts/:postId", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateMarketplacePostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db.update(marketplacePostsTable).set({
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description,
    categorySlugs: parsed.data.categorySlugs ?? [],
    region: parsed.data.region ?? null,
    budgetPence: parsed.data.budgetPence ?? null,
    status: parsed.data.status ?? "open",
    closesAt: parsed.data.closesAt ?? null,
  }).where(and(eq(marketplacePostsTable.tenantId, tenantId), eq(marketplacePostsTable.id, req.params.postId as string))).returning();
  if (!row) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(({
    id: row.id, tenantId: row.tenantId, tenantName: req.auth!.tenant!.name,
    kind: row.kind, title: row.title, description: row.description,
    categorySlugs: row.categorySlugs ?? [], region: row.region, budgetPence: row.budgetPence,
    status: row.status, closesAt: row.closesAt ? row.closesAt.toISOString() : null,
    applicationCount: 0, createdAt: row.createdAt.toISOString(),
  }));
});

// ---- Applications --------------------------------------------------------

router.get("/v1/marketplace/posts/:postId/applications", requireTenant, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenant!.id;
  const [post] = await db.select().from(marketplacePostsTable).where(eq(marketplacePostsTable.id, req.params.postId as string));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await db.select({
    app: marketplaceApplicationsTable,
    applicantTenantName: tenantsTable.name,
  })
  .from(marketplaceApplicationsTable)
  .innerJoin(tenantsTable, eq(tenantsTable.id, marketplaceApplicationsTable.applicantTenantId))
  .where(eq(marketplaceApplicationsTable.postId, post.id))
  .orderBy(desc(marketplaceApplicationsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.app.id, postId: r.app.postId, applicantTenantId: r.app.applicantTenantId,
    applicantTenantName: r.applicantTenantName, ownerTenantId: r.app.ownerTenantId,
    listingId: r.app.listingId, message: r.app.message, bidPence: r.app.bidPence,
    status: r.app.status, decidedAt: r.app.decidedAt ? r.app.decidedAt.toISOString() : null,
    createdAt: r.app.createdAt.toISOString(),
  })));
});

router.post("/v1/marketplace/posts/:postId/applications", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateMarketplaceApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const [post] = await db.select().from(marketplacePostsTable).where(eq(marketplacePostsTable.id, req.params.postId as string));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.tenantId === tenantId) { res.status(400).json({ error: "Cannot apply to your own post" }); return; }
  if (post.status !== "open") { res.status(400).json({ error: "Post is not open" }); return; }
  const [listing] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.tenantId, tenantId));
  const [row] = await db.insert(marketplaceApplicationsTable).values({
    postId: post.id,
    listingId: listing?.id ?? null,
    applicantTenantId: tenantId,
    ownerTenantId: post.tenantId,
    message: parsed.data.message,
    bidPence: parsed.data.bidPence ?? null,
  }).returning();
  await logAudit({ tenantId, actorUserId: req.auth!.user.id, kind: "marketplace.application_submitted", message: `Applied to post ${post.title}` });
  res.status(201).json(({
    id: row.id, postId: row.postId, applicantTenantId: row.applicantTenantId,
    applicantTenantName: req.auth!.tenant!.name, ownerTenantId: row.ownerTenantId,
    listingId: row.listingId, message: row.message, bidPence: row.bidPence,
    status: row.status, decidedAt: null, createdAt: row.createdAt.toISOString(),
  }));
});

router.post("/v1/marketplace/applications/:applicationId/decide", requireTenant, async (req, res): Promise<void> => {
  const parsed = DecideMarketplaceApplicationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const [app] = await db.select().from(marketplaceApplicationsTable).where(eq(marketplaceApplicationsTable.id, req.params.applicationId as string));
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  if (app.ownerTenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const [row] = await db.update(marketplaceApplicationsTable).set({
    status: parsed.data.status,
    decidedAt: new Date(),
  }).where(eq(marketplaceApplicationsTable.id, app.id)).returning();
  const [applicant] = await db.select({ name: tenantsTable.name }).from(tenantsTable).where(eq(tenantsTable.id, row.applicantTenantId));
  res.json(({
    id: row.id, postId: row.postId, applicantTenantId: row.applicantTenantId,
    applicantTenantName: applicant?.name ?? "", ownerTenantId: row.ownerTenantId,
    listingId: row.listingId, message: row.message, bidPence: row.bidPence,
    status: row.status, decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
});

// ---- Marketplace reviews (B2B) -------------------------------------------

router.post("/v1/marketplace/listings/:listingId/reviews", requireTenant, async (req, res): Promise<void> => {
  const parsed = CreateMarketplaceReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const tenantId = req.auth!.tenant!.id;
  const listingId = req.params.listingId as string;
  const [listing] = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, listingId));
  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.tenantId === tenantId) { res.status(400).json({ error: "Cannot review your own listing" }); return; }
  // Require an accepted application between reviewer (applicant) and listing owner
  const [accepted] = await db.select().from(marketplaceApplicationsTable).where(and(
    eq(marketplaceApplicationsTable.applicantTenantId, tenantId),
    eq(marketplaceApplicationsTable.ownerTenantId, listing.tenantId),
    eq(marketplaceApplicationsTable.status, "accepted"),
  ));
  const [acceptedReverse] = await db.select().from(marketplaceApplicationsTable).where(and(
    eq(marketplaceApplicationsTable.ownerTenantId, tenantId),
    eq(marketplaceApplicationsTable.applicantTenantId, listing.tenantId),
    eq(marketplaceApplicationsTable.status, "accepted"),
  ));
  if (!accepted && !acceptedReverse) {
    res.status(403).json({ error: "Reviews require a completed marketplace engagement" });
    return;
  }
  try {
    const [row] = await db.insert(marketplaceReviewsTable).values({
      listingId,
      reviewerTenantId: tenantId,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    }).returning();
    res.status(201).json(({
      id: row.id,
      reviewerTenantId: row.reviewerTenantId,
      reviewerTenantName: req.auth!.tenant!.name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    res.status(409).json({ error: "You have already reviewed this listing" });
  }
});

export default router;
