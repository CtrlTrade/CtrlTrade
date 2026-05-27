import {
  db,
  tradeCategoriesTable,
  usersTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
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

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
