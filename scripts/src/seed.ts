import {
  db,
  tradeCategoriesTable,
  tenantsTable,
  membershipsTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { TRADE_CATEGORY_SEED } from "../../artifacts/api-server/src/lib/tradeCategoriesSeed";

async function main() {
  console.log("Seeding trade categories...");
  for (const c of TRADE_CATEGORY_SEED) {
    await db
      .insert(tradeCategoriesTable)
      .values({
        slug: c.slug,
        name: c.name,
        jobTypes: c.jobTypes,
        sortOrder: c.sortOrder,
      })
      .onConflictDoUpdate({
        target: tradeCategoriesTable.slug,
        set: {
          name: c.name,
          jobTypes: c.jobTypes,
          sortOrder: c.sortOrder,
        },
      });
  }
  console.log(`Seeded ${TRADE_CATEGORY_SEED.length} trade categories.`);

  const email = "admin@ctrltrade.io";
  const existing = await db.execute(
    sql`SELECT id FROM users WHERE email = ${email}`,
  );
  if (existing.rows.length === 0) {
    const password = "ChangeMe123!";
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(usersTable).values({
      email,
      name: "Super Admin",
      passwordHash,
      isSuperAdmin: true,
    });
    console.log(`Created super admin user.`);
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
  } else {
    console.log(`Super admin user already exists (${email}).`);
  }

  // ---- Test tenant + tenant admin (owner) ----
  const tenantSlug = "acme-trades";
  const ownerEmail = "owner@acme-trades.test";
  const ownerPassword = "OwnerPass123!";

  let [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) {
    [tenant] = await db
      .insert(tenantsTable)
      .values({
        name: "Acme Trades Ltd",
        slug: tenantSlug,
        status: "trial",
        country: "GB",
        phone: "+44 20 7946 0000",
        addressLine1: "1 Trade Yard",
        city: "London",
        postcode: "E1 6AN",
        companyNumber: "12345678",
        brandColor: "#FF6A00",
        stripeCustomerId: "cus_test_seed_acme",
        stripeSubscriptionId: "sub_test_seed_acme",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      })
      .returning();
    console.log(`Created test tenant: ${tenant.name} (${tenant.slug}).`);
  } else {
    console.log(`Test tenant already exists (${tenantSlug}).`);
  }

  let [owner] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ownerEmail));
  if (!owner) {
    const hash = await bcrypt.hash(ownerPassword, 10);
    [owner] = await db
      .insert(usersTable)
      .values({
        email: ownerEmail,
        name: "Acme Owner",
        passwordHash: hash,
        isSuperAdmin: false,
      })
      .returning();
    console.log(`Created tenant admin user.`);
    console.log(`  email: ${ownerEmail}`);
    console.log(`  password: ${ownerPassword}`);
  } else {
    console.log(`Tenant admin user already exists (${ownerEmail}).`);
  }

  const existingMembership = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, owner.id));
  if (existingMembership.length === 0) {
    await db.insert(membershipsTable).values({
      tenantId: tenant.id,
      userId: owner.id,
      role: "owner",
      seatType: "control",
    });
    console.log(`Linked tenant admin to ${tenant.name} as owner.`);
  }

  const existingSub = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.tenantId, tenant.id));
  if (existingSub.length === 0) {
    await db.insert(subscriptionsTable).values({
      tenantId: tenant.id,
      stripeCustomerId: "cus_test_seed_acme",
      stripeSubscriptionId: "sub_test_seed_acme",
      status: "trial",
      controlSeats: 2,
      fieldSeats: 5,
      tills: 1,
      currency: "gbp",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
    });
    console.log(`Created mirrored subscription for ${tenant.name}.`);
  }

  console.log("\nSeed complete. Test credentials:");
  console.log(`  Super Admin   -> admin@ctrltrade.io / ChangeMe123!`);
  console.log(`  Tenant Owner  -> ${ownerEmail} / ${ownerPassword}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
