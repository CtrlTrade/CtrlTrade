import {
  db,
  tenantsTable,
  usersTable,
  membershipsTable,
  branchesTable,
  stockLocationsTable,
  productCategoriesTable,
  productsTable,
  branchStockTable,
  customersTable,
  leadsTable,
  quotesTable,
  quoteLineItemsTable,
  jobsTable,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  vehiclesTable,
  timesheetEntriesTable,
  inboxThreadsTable,
  inboxMessagesTable,
  staffNotificationsTable,
  cashDrawersTable,
  tillSessionsTable,
  posTransactionsTable,
  posTransactionItemsTable,
  posLicencesTable,
  posTerminalsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TENANT_SLUG = "acme-trades";

async function main() {
  console.log("=== Acme Trades Ltd — full test data seed ===\n");

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, TENANT_SLUG));

  if (!tenant) {
    console.error(
      `Tenant '${TENANT_SLUG}' not found. Run 'pnpm --filter @workspace/scripts run seed' first.`,
    );
    process.exit(1);
  }

  console.log(`Seeding tenant: ${tenant.name} (${tenant.id})`);
  const tenantId = tenant.id;

  // ── Update tenant to enable POS + mobile workforce ──────────────────────
  await db
    .update(tenantsTable)
    .set({ posEnabled: true, hasMobileWorkforce: true, hasTradeShop: true, vatRegistered: true })
    .where(eq(tenantsTable.id, tenantId));

  // ── 1. BRANCH ───────────────────────────────────────────────────────────
  const existingBranches = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.tenantId, tenantId));

  let branch = existingBranches[0];
  if (!branch) {
    [branch] = await db
      .insert(branchesTable)
      .values({
        tenantId,
        name: "Acme Trades — Shoreditch",
        addressLine1: "1 Trade Yard",
        city: "London",
        postcode: "E1 6AN",
        phone: "+44 20 7946 0001",
        region: "Greater London",
      })
      .returning();
    console.log("Created branch:", branch.name);
  } else {
    console.log("Branch already exists.");
  }

  // ── 2. STOCK LOCATION ───────────────────────────────────────────────────
  const existingLocations = await db
    .select()
    .from(stockLocationsTable)
    .where(eq(stockLocationsTable.tenantId, tenantId));

  let stockLocation = existingLocations[0];
  if (!stockLocation) {
    [stockLocation] = await db
      .insert(stockLocationsTable)
      .values({
        tenantId,
        name: "Shoreditch Shop",
        kind: "shop",
        code: "SHO-01",
        addressLine1: "1 Trade Yard",
        city: "London",
        postcode: "E1 6AN",
        isDefault: true,
      })
      .returning();
    console.log("Created stock location:", stockLocation.name);
  } else {
    console.log("Stock location already exists.");
  }

  // ── 3. STAFF USERS ──────────────────────────────────────────────────────
  const staffDefs = [
    {
      email: "admin@acme-trades.test",
      name: "Sarah Collins",
      password: "AdminPass123!",
      role: "admin" as const,
      seatType: "control" as const,
    },
    {
      email: "field1@acme-trades.test",
      name: "Mike Patel",
      password: "FieldPass123!",
      role: "staff" as const,
      seatType: "field" as const,
    },
    {
      email: "field2@acme-trades.test",
      name: "James Wright",
      password: "FieldPass123!",
      role: "staff" as const,
      seatType: "field" as const,
    },
  ];

  const staffUsers: Array<{ id: string; email: string; name: string }> = [];

  for (const def of staffDefs) {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, def.email));
    if (!user) {
      const hash = await bcrypt.hash(def.password, 10);
      [user] = await db
        .insert(usersTable)
        .values({ email: def.email, name: def.name, passwordHash: hash })
        .returning();
      console.log(`Created user: ${user.email}`);
    } else {
      // Keep password hash in sync with seed definition
      const hash = await bcrypt.hash(def.password, 10);
      await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, def.email));
    }
    staffUsers.push(user);

    const existing = await db
      .select()
      .from(membershipsTable)
      .where(eq(membershipsTable.userId, user.id));
    if (existing.length === 0) {
      await db.insert(membershipsTable).values({
        tenantId,
        userId: user.id,
        role: def.role,
        seatType: def.seatType,
        branchId: branch.id,
      });
      console.log(`  Linked ${user.email} to tenant as ${def.role}`);
    }
  }

  const [adminUser, field1User, field2User] = staffUsers;

  // ── 4. CUSTOMERS ────────────────────────────────────────────────────────
  const customerDefs = [
    { name: "David Thompson", email: "d.thompson@example.co.uk", phone: "+44 7700 900001", addressLine1: "12 Elm Street", city: "Manchester", postcode: "M1 1AE" },
    { name: "Sarah Jenkins", email: "s.jenkins@example.co.uk", phone: "+44 7700 900002", addressLine1: "45 Oak Avenue", city: "Birmingham", postcode: "B1 1BB" },
    { name: "Robert Clarke", email: "r.clarke@example.co.uk", phone: "+44 7700 900003", addressLine1: "8 Maple Road", city: "Leeds", postcode: "LS1 1BA" },
    { name: "Emily Harrison", email: "e.harrison@example.co.uk", phone: "+44 7700 900004", addressLine1: "22 Pine Close", city: "Bristol", postcode: "BS1 1AA" },
    { name: "Thomas Ward", email: "t.ward@example.co.uk", phone: "+44 7700 900005", addressLine1: "3 Cedar Lane", city: "Liverpool", postcode: "L1 1AA" },
    { name: "Fiona Stewart", email: "f.stewart@example.co.uk", phone: "+44 7700 900006", addressLine1: "67 Birch Way", city: "Sheffield", postcode: "S1 1WZ" },
    { name: "Andrew Mitchell", email: "a.mitchell@example.co.uk", phone: "+44 7700 900007", addressLine1: "14 Ash Grove", city: "Edinburgh", postcode: "EH1 1AA" },
    { name: "Louise Baker", email: "l.baker@example.co.uk", phone: "+44 7700 900008", addressLine1: "90 Sycamore Drive", city: "Nottingham", postcode: "NG1 1AW" },
    { name: "Graham Foster", email: "g.foster@example.co.uk", phone: "+44 7700 900009", addressLine1: "5 Walnut Court", city: "Cardiff", postcode: "CF1 1AA" },
    { name: "Natalie Price", email: "n.price@example.co.uk", phone: "+44 7700 900010", addressLine1: "31 Willow Bank", city: "London", postcode: "E2 7QN" },
  ];

  const customers: Array<{ id: string; name: string }> = [];

  for (const def of customerDefs) {
    const existing = await db.execute(
      sql`SELECT id, name FROM customers WHERE tenant_id = ${tenantId} AND email = ${def.email}`,
    );
    if (existing.rows.length > 0) {
      customers.push(existing.rows[0] as { id: string; name: string });
    } else {
      const [c] = await db
        .insert(customersTable)
        .values({ tenantId, ...def, branchId: branch.id })
        .returning();
      customers.push(c);
      console.log("Created customer:", c.name);
    }
  }

  // ── 5. LEADS ────────────────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysHence = (d: number) => new Date(now.getTime() + d * 86400000);

  const existingLeads = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.tenantId, tenantId));

  if (existingLeads.length === 0) {
    await db.insert(leadsTable).values([
      { tenantId, name: "Chris Barker", email: "c.barker@gmail.com", phone: "+44 7700 900020", source: "website", status: "new", title: "New bathroom installation", message: "Looking for a quote on a full bathroom refit.", valuePence: 350000, followUpDueAt: daysHence(2) },
      { tenantId, name: "Jessica Hall", email: "j.hall@hotmail.com", phone: "+44 7700 900021", source: "referral", status: "contacted", title: "Kitchen plumbing upgrade", message: "Need pipework replaced under kitchen units.", valuePence: 120000, firstContactedAt: daysAgo(3) },
      { tenantId, name: "Marcus Green", email: "m.green@gmail.com", phone: "+44 7700 900022", source: "manual", status: "qualified", title: "Consumer unit upgrade", message: "Old fuse board, needs replacing.", valuePence: 85000, firstContactedAt: daysAgo(7) },
      { tenantId, name: "Paula Lewis", email: "p.lewis@btinternet.com", phone: "+44 7700 900023", source: "website", status: "new", title: "Garden landscaping project", message: "Want full garden redesign with patio and lawn.", valuePence: 600000, followUpDueAt: daysHence(5) },
      { tenantId, name: "Kevin Hughes", email: "k.hughes@outlook.com", phone: "+44 7700 900024", source: "referral", status: "lost", title: "Roof repair", message: "Leak in rear extension roof.", valuePence: 45000, lostReason: "Chose another contractor on price." },
    ]);
    console.log("Created 5 leads.");
  } else {
    console.log("Leads already exist, skipping.");
  }

  // ── 6. PRODUCT CATEGORIES ───────────────────────────────────────────────
  const existingCats = await db
    .select()
    .from(productCategoriesTable)
    .where(eq(productCategoriesTable.tenantId, tenantId));

  let catElectrical = existingCats.find((c) => c.name === "Electrical") ?? null;
  let catPlumbing = existingCats.find((c) => c.name === "Plumbing") ?? null;
  let catLabour = existingCats.find((c) => c.name === "Labour") ?? null;

  if (!catElectrical) {
    [catElectrical] = await db.insert(productCategoriesTable).values({ tenantId, name: "Electrical", sortOrder: 1 }).returning();
  }
  if (!catPlumbing) {
    [catPlumbing] = await db.insert(productCategoriesTable).values({ tenantId, name: "Plumbing", sortOrder: 2 }).returning();
  }
  if (!catLabour) {
    [catLabour] = await db.insert(productCategoriesTable).values({ tenantId, name: "Labour", sortOrder: 3 }).returning();
  }
  console.log("Product categories ready.");

  // ── 7. PRODUCTS ─────────────────────────────────────────────────────────
  const productDefs = [
    { sku: "EL-MCB-32A", name: "MCB 32A Single Pole", categoryId: catElectrical!.id, pricePence: 890, costPence: 420, vatRatePct: 20, barcode: "5012345000001", unit: "each" as const },
    { sku: "EL-CU-12WAY", name: "Consumer Unit 12-Way", categoryId: catElectrical!.id, pricePence: 18500, costPence: 9200, vatRatePct: 20, barcode: "5012345000002", unit: "each" as const },
    { sku: "EL-CABLE-6MM", name: "6mm² Twin+Earth Cable (per m)", categoryId: catElectrical!.id, pricePence: 320, costPence: 155, vatRatePct: 20, unit: "m" as const },
    { sku: "EL-SOCKET-DP", name: "Double Socket Switched", categoryId: catElectrical!.id, pricePence: 1250, costPence: 580, vatRatePct: 20, barcode: "5012345000003", unit: "each" as const },
    { sku: "PL-STOPCOCK", name: "15mm Stopcock", categoryId: catPlumbing!.id, pricePence: 1800, costPence: 850, vatRatePct: 20, barcode: "5012345000004", unit: "each" as const },
    { sku: "PL-PIPE-22MM", name: "22mm Copper Pipe (per m)", categoryId: catPlumbing!.id, pricePence: 680, costPence: 310, vatRatePct: 20, unit: "m" as const },
    { sku: "PL-BASIN-TAP", name: "Chrome Basin Mixer Tap", categoryId: catPlumbing!.id, pricePence: 8500, costPence: 3900, vatRatePct: 20, barcode: "5012345000005", unit: "each" as const },
    { sku: "PL-SHOWER-VALVE", name: "Concealed Shower Valve", categoryId: catPlumbing!.id, pricePence: 22000, costPence: 10500, vatRatePct: 20, barcode: "5012345000006", unit: "each" as const },
    { sku: "LAB-ELEC-HR", name: "Electrician Labour (per hr)", categoryId: catLabour!.id, pricePence: 8500, costPence: 4500, vatRatePct: 20, unit: "hr" as const },
    { sku: "LAB-PLUMB-HR", name: "Plumber Labour (per hr)", categoryId: catLabour!.id, pricePence: 7500, costPence: 4000, vatRatePct: 20, unit: "hr" as const },
    { sku: "PL-PTFE-TAPE", name: "PTFE Thread Seal Tape", categoryId: catPlumbing!.id, pricePence: 150, costPence: 60, vatRatePct: 20, barcode: "5012345000007", unit: "each" as const },
    { sku: "EL-FUSE-WIRE", name: "Electrical Insulation Tape", categoryId: catElectrical!.id, pricePence: 200, costPence: 80, vatRatePct: 20, barcode: "5012345000008", unit: "each" as const },
  ];

  const products: Array<{ id: string; sku: string; name: string; pricePence: number }> = [];

  for (const def of productDefs) {
    const existing = await db.execute(
      sql`SELECT id, sku, name, price_pence FROM products WHERE tenant_id = ${tenantId} AND sku = ${def.sku}`,
    );
    if (existing.rows.length > 0) {
      const r = existing.rows[0] as { id: string; sku: string; name: string; price_pence: number };
      products.push({ id: r.id, sku: r.sku, name: r.name, pricePence: r.price_pence });
    } else {
      const [p] = await db
        .insert(productsTable)
        .values({ tenantId, ...def, reorderLevel: 5, reorderQty: 20 })
        .returning();
      products.push({ id: p.id, sku: p.sku, name: p.name, pricePence: p.pricePence });
    }
  }
  console.log(`Products ready (${products.length}).`);

  // ── 8. BRANCH STOCK ─────────────────────────────────────────────────────
  const stockLevels: Record<string, number> = {
    "EL-MCB-32A": 48, "EL-CU-12WAY": 6, "EL-CABLE-6MM": 120,
    "EL-SOCKET-DP": 24, "PL-STOPCOCK": 15, "PL-PIPE-22MM": 80,
    "PL-BASIN-TAP": 8, "PL-SHOWER-VALVE": 4, "LAB-ELEC-HR": 0,
    "LAB-PLUMB-HR": 0, "PL-PTFE-TAPE": 60, "EL-FUSE-WIRE": 40,
  };

  for (const p of products) {
    const qty = stockLevels[p.sku] ?? 10;
    if (qty === 0) continue;
    const existing = await db.execute(
      sql`SELECT id FROM branch_stock WHERE location_id = ${stockLocation.id} AND product_id = ${p.id} AND variant_id IS NULL`,
    );
    if (existing.rows.length > 0) {
      await db.execute(
        sql`UPDATE branch_stock SET qty = ${qty} WHERE location_id = ${stockLocation.id} AND product_id = ${p.id} AND variant_id IS NULL`,
      );
    } else {
      await db.insert(branchStockTable).values({ tenantId, locationId: stockLocation.id, productId: p.id, qty });
    }
  }
  console.log("Branch stock set.");

  // Helper to get product by SKU
  const prod = (sku: string) => products.find((p) => p.sku === sku)!;

  // ── 9. QUOTES ───────────────────────────────────────────────────────────
  const existingQuotes = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.tenantId, tenantId));

  let quotes: Array<{ id: string; number: string; status: string }> = existingQuotes.map((q) => ({ id: q.id, number: q.number, status: q.status }));

  if (existingQuotes.length === 0) {
    const quoteDefs = [
      // Draft
      {
        number: "QT-0001", title: "Consumer Unit Replacement", status: "draft",
        customerId: customers[0].id,
        lineItems: [
          { description: prod("EL-CU-12WAY").name, quantity: 1, unitPricePence: prod("EL-CU-12WAY").pricePence, sortOrder: 0 },
          { description: "Electrician Labour (4hrs)", quantity: 4, unitPricePence: prod("LAB-ELEC-HR").pricePence, sortOrder: 1 },
        ],
      },
      // Sent
      {
        number: "QT-0002", title: "Bathroom Plumbing Refit", status: "sent",
        customerId: customers[1].id,
        sentAt: daysAgo(5),
        lineItems: [
          { description: prod("PL-BASIN-TAP").name, quantity: 2, unitPricePence: prod("PL-BASIN-TAP").pricePence, sortOrder: 0 },
          { description: prod("PL-SHOWER-VALVE").name, quantity: 1, unitPricePence: prod("PL-SHOWER-VALVE").pricePence, sortOrder: 1 },
          { description: "Plumber Labour (6hrs)", quantity: 6, unitPricePence: prod("LAB-PLUMB-HR").pricePence, sortOrder: 2 },
        ],
      },
      // Accepted — will become Job
      {
        number: "QT-0003", title: "Full Rewire — 3 Bed Semi", status: "accepted",
        customerId: customers[2].id,
        sentAt: daysAgo(14), acceptedAt: daysAgo(10),
        lineItems: [
          { description: prod("EL-CABLE-6MM").name, quantity: 50, unitPricePence: prod("EL-CABLE-6MM").pricePence, sortOrder: 0 },
          { description: "Electrician Labour (20hrs)", quantity: 20, unitPricePence: prod("LAB-ELEC-HR").pricePence, sortOrder: 1 },
          { description: prod("EL-MCB-32A").name, quantity: 8, unitPricePence: prod("EL-MCB-32A").pricePence, sortOrder: 2 },
        ],
      },
      // Accepted — will become Job (completed)
      {
        number: "QT-0004", title: "Kitchen Sink Plumbing", status: "accepted",
        customerId: customers[3].id,
        sentAt: daysAgo(30), acceptedAt: daysAgo(25),
        lineItems: [
          { description: prod("PL-PIPE-22MM").name, quantity: 10, unitPricePence: prod("PL-PIPE-22MM").pricePence, sortOrder: 0 },
          { description: prod("PL-STOPCOCK").name, quantity: 1, unitPricePence: prod("PL-STOPCOCK").pricePence, sortOrder: 1 },
          { description: "Plumber Labour (3hrs)", quantity: 3, unitPricePence: prod("LAB-PLUMB-HR").pricePence, sortOrder: 2 },
        ],
      },
      // Declined
      {
        number: "QT-0005", title: "Outdoor Lighting Install", status: "declined",
        customerId: customers[4].id,
        sentAt: daysAgo(20),
        lineItems: [
          { description: prod("EL-SOCKET-DP").name, quantity: 4, unitPricePence: prod("EL-SOCKET-DP").pricePence, sortOrder: 0 },
          { description: "Electrician Labour (2hrs)", quantity: 2, unitPricePence: prod("LAB-ELEC-HR").pricePence, sortOrder: 1 },
        ],
      },
    ];

    for (const def of quoteDefs) {
      const { lineItems, ...quoteValues } = def;
      const [q] = await db
        .insert(quotesTable)
        .values({ tenantId, ...quoteValues, currency: "gbp", depositPct: 0 })
        .returning();
      for (const li of lineItems) {
        await db.insert(quoteLineItemsTable).values({ quoteId: q.id, ...li });
      }
      quotes.push({ id: q.id, number: q.number, status: q.status });
    }
    console.log(`Created ${quoteDefs.length} quotes.`);
  } else {
    console.log("Quotes already exist, skipping.");
  }

  // ── 10. JOBS ────────────────────────────────────────────────────────────
  const existingJobs = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.tenantId, tenantId));

  let jobs: Array<{ id: string; number: string; status: string; customerId: string }> = existingJobs.map((j) => ({ id: j.id, number: j.number, status: j.status, customerId: j.customerId }));

  if (existingJobs.length === 0) {
    const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
    const jobDefs = [
      {
        number: "JOB-0001",
        quoteId: acceptedQuotes[0]?.id,
        customerId: customers[2].id,
        title: "Full Rewire — 3 Bed Semi",
        status: "in_progress",
        scheduledStart: daysAgo(3),
        scheduledEnd: daysHence(2),
        assignedUserId: field1User.id,
        valuePence: 220000,
        addressLine1: "8 Maple Road",
        city: "Leeds",
        postcode: "LS1 1BA",
      },
      {
        number: "JOB-0002",
        quoteId: acceptedQuotes[1]?.id,
        customerId: customers[3].id,
        title: "Kitchen Sink Plumbing",
        status: "completed",
        scheduledStart: daysAgo(22),
        scheduledEnd: daysAgo(22),
        assignedUserId: field2User.id,
        valuePence: 45000,
        completedAt: daysAgo(22),
        signoffName: "Emily Harrison",
        signoffAt: daysAgo(22),
        signoffNote: "Happy with the work done.",
        addressLine1: "22 Pine Close",
        city: "Bristol",
        postcode: "BS1 1AA",
      },
      {
        number: "JOB-0003",
        quoteId: null,
        customerId: customers[4].id,
        title: "Emergency Boiler Pressure Fix",
        status: "scheduled",
        scheduledStart: daysHence(3),
        scheduledEnd: daysHence(3),
        assignedUserId: field2User.id,
        valuePence: 18000,
        addressLine1: "3 Cedar Lane",
        city: "Liverpool",
        postcode: "L1 1AA",
      },
    ];

    for (const def of jobDefs) {
      const [j] = await db
        .insert(jobsTable)
        .values({ tenantId, branchId: branch.id, description: def.title, ...def })
        .returning();
      jobs.push({ id: j.id, number: j.number, status: j.status, customerId: j.customerId });
    }
    console.log(`Created ${jobDefs.length} jobs.`);
  } else {
    console.log("Jobs already exist, skipping.");
  }

  // ── 11. INVOICES + ITEMS ─────────────────────────────────────────────────
  const existingInvoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.tenantId, tenantId));

  let invoices: Array<{ id: string; number: string; status: string; totalPence: number }> = existingInvoices.map((i) => ({ id: i.id, number: i.number, status: i.status, totalPence: i.totalPence }));

  if (existingInvoices.length === 0) {
    const completedJob = jobs.find((j) => j.status === "completed");
    const inProgressJob = jobs.find((j) => j.status === "in_progress");

    const invoiceDefs = [
      // Paid invoice for completed job
      {
        number: "INV-0001",
        customerId: completedJob ? customers.find((c) => c.id === completedJob.customerId)?.id ?? customers[3].id : customers[3].id,
        jobId: completedJob?.id ?? null,
        title: "Kitchen Sink Plumbing",
        status: "paid",
        subtotalPence: 37500,
        taxPence: 7500,
        totalPence: 45000,
        vatRatePct: 20,
        sentAt: daysAgo(20),
        paidAt: daysAgo(15),
        dueAt: daysAgo(10),
        items: [
          { description: "22mm Copper Pipe (10m)", quantity: 10, unitPricePence: 680, sortOrder: 0 },
          { description: "15mm Stopcock", quantity: 1, unitPricePence: 1800, sortOrder: 1 },
          { description: "Plumber Labour (3hrs)", quantity: 3, unitPricePence: 7500, sortOrder: 2 },
        ],
      },
      // Overdue unpaid invoice
      {
        number: "INV-0002",
        customerId: customers[5].id,
        jobId: null,
        title: "Emergency Electrical Fault Finding",
        status: "sent",
        subtotalPence: 16667,
        taxPence: 3333,
        totalPence: 20000,
        vatRatePct: 20,
        sentAt: daysAgo(40),
        dueAt: daysAgo(10),
        items: [
          { description: "Electrician Labour (2hrs)", quantity: 2, unitPricePence: 8500, sortOrder: 0 },
          { description: "Diagnostic call-out fee", quantity: 1, unitPricePence: -333, sortOrder: 1 },
        ],
      },
      // Draft invoice for in-progress job
      {
        number: "INV-0003",
        customerId: customers[2].id,
        jobId: inProgressJob?.id ?? null,
        title: "Full Rewire — 3 Bed Semi (Deposit)",
        status: "draft",
        subtotalPence: 91667,
        taxPence: 18333,
        totalPence: 110000,
        vatRatePct: 20,
        isDeposit: true,
        items: [
          { description: "Deposit 50% — Full Rewire 3 Bed Semi", quantity: 1, unitPricePence: 110000, sortOrder: 0 },
        ],
      },
    ];

    for (const def of invoiceDefs) {
      const { items, ...invValues } = def;
      const [inv] = await db
        .insert(invoicesTable)
        .values({ tenantId, currency: "gbp", ...invValues })
        .returning();
      for (const item of items) {
        await db.insert(invoiceItemsTable).values({ invoiceId: inv.id, ...item });
      }
      invoices.push({ id: inv.id, number: inv.number, status: inv.status, totalPence: inv.totalPence });
    }
    console.log(`Created ${invoiceDefs.length} invoices.`);
  } else {
    console.log("Invoices already exist, skipping.");
  }

  // ── 12. PAYMENT ─────────────────────────────────────────────────────────
  const existingPayments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.tenantId, tenantId));

  if (existingPayments.length === 0) {
    const paidInvoice = invoices.find((i) => i.status === "paid");
    if (paidInvoice) {
      await db.insert(paymentsTable).values({
        tenantId,
        invoiceId: paidInvoice.id,
        amountPence: paidInvoice.totalPence,
        currency: "gbp",
        provider: "manual",
        status: "succeeded",
        receivedAt: daysAgo(15),
      });
      console.log("Created payment for", paidInvoice.number);
    }
  } else {
    console.log("Payments already exist, skipping.");
  }

  // ── 13. VEHICLES ────────────────────────────────────────────────────────
  const existingVehicles = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.tenantId, tenantId));

  let vehicles: Array<{ id: string }> = existingVehicles;

  if (existingVehicles.length === 0) {
    const vehicleDefs = [
      {
        label: "Van 1 — Ford Transit",
        registration: "LT73 ABC",
        make: "Ford",
        model: "Transit Custom",
        year: 2021,
        motDueAt: daysHence(45),
        taxDueAt: daysHence(90),
        serviceDueAt: daysHence(200),
        assignedDriverId: field1User.id,
        status: "active",
      },
      {
        label: "Van 2 — Mercedes Sprinter",
        registration: "SK22 XYZ",
        make: "Mercedes-Benz",
        model: "Sprinter 314",
        year: 2022,
        motDueAt: daysHence(8),
        taxDueAt: daysHence(30),
        serviceDueAt: daysAgo(5),
        assignedDriverId: field2User.id,
        status: "active",
      },
    ];

    for (const def of vehicleDefs) {
      const [v] = await db
        .insert(vehiclesTable)
        .values({ tenantId, ...def })
        .returning();
      vehicles.push(v);
      console.log("Created vehicle:", v.label);
    }
  } else {
    console.log("Vehicles already exist, skipping.");
  }

  // ── 14. TIMESHEET ENTRIES ───────────────────────────────────────────────
  const existingTimesheets = await db
    .select()
    .from(timesheetEntriesTable)
    .where(eq(timesheetEntriesTable.tenantId, tenantId));

  if (existingTimesheets.length === 0) {
    const completedJob = jobs.find((j) => j.status === "completed");
    const inProgressJob = jobs.find((j) => j.status === "in_progress");

    const tsEntries = [
      { userId: field2User.id, jobId: completedJob?.id, date: "2026-05-12", hoursWorked: "3", travelMinutes: 25, mileageMiles: 18, status: "approved", approvedBy: adminUser.id, approvedAt: daysAgo(21), notes: "Completed kitchen plumbing." },
      { userId: field1User.id, jobId: inProgressJob?.id, date: "2026-05-31", hoursWorked: "8", travelMinutes: 40, mileageMiles: 28, status: "submitted", notes: "Day 1 — first fix wiring." },
      { userId: field1User.id, jobId: inProgressJob?.id, date: "2026-06-01", hoursWorked: "6", travelMinutes: 40, mileageMiles: 28, status: "draft", notes: "Day 2 — second fix and sockets." },
    ];

    for (const entry of tsEntries) {
      await db.insert(timesheetEntriesTable).values({ tenantId, ...entry });
    }
    console.log("Created timesheet entries.");
  } else {
    console.log("Timesheet entries already exist, skipping.");
  }

  // ── 15. POS SETUP: CASH DRAWER + TILL SESSION + TRANSACTION ─────────────
  const existingDrawers = await db
    .select()
    .from(cashDrawersTable)
    .where(eq(cashDrawersTable.tenantId, tenantId));

  let cashDrawer = existingDrawers[0] ?? null;
  if (!cashDrawer) {
    [cashDrawer] = await db
      .insert(cashDrawersTable)
      .values({
        tenantId,
        locationId: stockLocation.id,
        name: "Till 1",
        deviceCode: "TIL-001",
        refundApprovalPin: "1234",
      })
      .returning();
    console.log("Created cash drawer:", cashDrawer.name);
  }

  // POS Licence
  const existingLicences = await db
    .select()
    .from(posLicencesTable)
    .where(eq(posLicencesTable.tenantId, tenantId));

  let posLicence = existingLicences[0] ?? null;
  if (!posLicence) {
    [posLicence] = await db
      .insert(posLicencesTable)
      .values({
        tenantId,
        branchId: branch.id,
        licenceKey: "ACME-POS-TEST-0001",
        type: "web",
        status: "active",
        trialEndsAt: daysHence(30),
      })
      .returning();
    console.log("Created POS licence:", posLicence.licenceKey);
  }

  // POS Terminal
  const existingTerminals = await db
    .select()
    .from(posTerminalsTable)
    .where(eq(posTerminalsTable.tenantId, tenantId));

  let posTerminal = existingTerminals[0] ?? null;
  if (!posTerminal) {
    [posTerminal] = await db
      .insert(posTerminalsTable)
      .values({
        tenantId,
        branchId: branch.id,
        licenceId: posLicence.id,
        terminalCode: "POS-001",
        name: "Trade Counter",
        mode: "trade_counter",
        status: "active",
        registeredAt: daysAgo(10),
        lastSeenAt: daysAgo(1),
      })
      .returning();
    console.log("Created POS terminal:", posTerminal.name);
  }

  // Till session (closed)
  const existingSessions = await db
    .select()
    .from(tillSessionsTable)
    .where(eq(tillSessionsTable.tenantId, tenantId));

  let closedSession = existingSessions.find((s) => s.status === "closed") ?? null;

  if (!closedSession) {
    const [session] = await db
      .insert(tillSessionsTable)
      .values({
        tenantId,
        locationId: stockLocation.id,
        cashDrawerId: cashDrawer.id,
        openedByUserId: adminUser.id,
        closedByUserId: adminUser.id,
        openingFloatPence: 10000,
        cashSalesPence: 25000,
        cardSalesPence: 94000,
        tradeSalesPence: 0,
        refundsPence: 0,
        countedCashPence: 35000,
        expectedCashPence: 35000,
        variancePence: 0,
        status: "closed",
        openedAt: daysAgo(1),
        closedAt: daysAgo(1),
        notes: "Clean close, no variance.",
      })
      .returning();
    closedSession = session;
    console.log("Created closed till session.");
  }

  // Open till session (current)
  const openSession = existingSessions.find((s) => s.status === "open") ?? null;
  let currentSession = openSession;
  if (!currentSession) {
    const [session] = await db
      .insert(tillSessionsTable)
      .values({
        tenantId,
        locationId: stockLocation.id,
        cashDrawerId: cashDrawer.id,
        openedByUserId: adminUser.id,
        openingFloatPence: 10000,
        cashSalesPence: 0,
        cardSalesPence: 0,
        tradeSalesPence: 0,
        refundsPence: 0,
        status: "open",
        openedAt: now,
      })
      .returning();
    currentSession = session;
    console.log("Created open till session.");
  }

  // POS Transaction (completed sale)
  const existingTx = await db
    .select()
    .from(posTransactionsTable)
    .where(eq(posTransactionsTable.tenantId, tenantId));

  if (existingTx.length === 0 && closedSession) {
    const txProduct1 = prod("EL-MCB-32A");
    const txProduct2 = prod("PL-PTFE-TAPE");

    const subtotal = txProduct1.pricePence * 2 + txProduct2.pricePence * 3;
    const tax = Math.round(subtotal * 0.2);
    const total = subtotal + tax;

    const [tx] = await db
      .insert(posTransactionsTable)
      .values({
        tenantId,
        tillSessionId: closedSession.id,
        locationId: stockLocation.id,
        userId: adminUser.id,
        kind: "sale",
        number: "TXN-0001",
        customerName: "Trade Customer",
        subtotalPence: subtotal,
        discountPence: 0,
        taxPence: tax,
        totalPence: total,
        currency: "gbp",
        tender: "card",
        cashTakenPence: 0,
        cardTakenPence: total,
        tradeCreditPence: 0,
        changeGivenPence: 0,
        idempotencyKey: "seed-txn-0001",
        createdAt: daysAgo(1),
      })
      .returning();

    await db.insert(posTransactionItemsTable).values([
      {
        transactionId: tx.id,
        tenantId,
        productId: txProduct1.id,
        sku: txProduct1.sku,
        description: txProduct1.name,
        quantity: 2,
        unitPricePence: txProduct1.pricePence,
        discountPence: 0,
        taxPence: Math.round(txProduct1.pricePence * 2 * 0.2),
        totalPence: Math.round(txProduct1.pricePence * 2 * 1.2),
        sortOrder: 0,
      },
      {
        transactionId: tx.id,
        tenantId,
        productId: txProduct2.id,
        sku: txProduct2.sku,
        description: txProduct2.name,
        quantity: 3,
        unitPricePence: txProduct2.pricePence,
        discountPence: 0,
        taxPence: Math.round(txProduct2.pricePence * 3 * 0.2),
        totalPence: Math.round(txProduct2.pricePence * 3 * 1.2),
        sortOrder: 1,
      },
    ]);
    console.log("Created POS transaction:", tx.number);
  } else if (existingTx.length > 0) {
    console.log("POS transactions already exist, skipping.");
  }

  // ── 16. INBOX THREADS + MESSAGES ────────────────────────────────────────
  const existingThreads = await db
    .select()
    .from(inboxThreadsTable)
    .where(eq(inboxThreadsTable.tenantId, tenantId));

  if (existingThreads.length === 0) {
    const inProgressJob = jobs.find((j) => j.status === "in_progress");

    const [thread1] = await db
      .insert(inboxThreadsTable)
      .values({
        tenantId,
        customerId: customers[2].id,
        jobId: inProgressJob?.id ?? null,
        channel: "portal",
        subject: "Rewire progress update",
        lastMessageAt: daysAgo(1),
        lastMessagePreview: "Hi, just checking when you expect to finish?",
        lastDirection: "in",
        unreadCount: 1,
        createdAt: daysAgo(3),
      })
      .returning();

    await db.insert(inboxMessagesTable).values([
      {
        tenantId,
        threadId: thread1.id,
        channel: "portal",
        direction: "out",
        body: "Hi Robert, we started the first fix yesterday. We expect to complete by end of next week.",
        authorUserId: adminUser.id,
        authorLabel: "Sarah Collins",
        readAt: daysAgo(3),
        createdAt: daysAgo(3),
      },
      {
        tenantId,
        threadId: thread1.id,
        channel: "portal",
        direction: "in",
        body: "Hi, just checking when you expect to finish? We have a plasterer booked for next Monday.",
        fromAddr: "r.clarke@example.co.uk",
        readAt: null,
        createdAt: daysAgo(1),
      },
    ]);

    const [thread2] = await db
      .insert(inboxThreadsTable)
      .values({
        tenantId,
        customerId: customers[5].id,
        channel: "email",
        subject: "Overdue invoice query",
        lastMessageAt: daysAgo(8),
        lastMessagePreview: "Please can you resend the invoice? I can't find the email.",
        lastDirection: "in",
        unreadCount: 0,
        createdAt: daysAgo(8),
      })
      .returning();

    await db.insert(inboxMessagesTable).values([
      {
        tenantId,
        threadId: thread2.id,
        channel: "email",
        direction: "in",
        fromAddr: "f.stewart@example.co.uk",
        toAddr: "acme@example.co.uk",
        body: "Please can you resend the invoice? I can't find the original email.",
        readAt: daysAgo(7),
        createdAt: daysAgo(8),
      },
      {
        tenantId,
        threadId: thread2.id,
        channel: "email",
        direction: "out",
        fromAddr: "acme@example.co.uk",
        toAddr: "f.stewart@example.co.uk",
        body: "Hi Fiona, I've resent INV-0002. Please let me know if you have any questions.",
        authorUserId: adminUser.id,
        authorLabel: "Sarah Collins",
        readAt: daysAgo(7),
        createdAt: daysAgo(7),
      },
    ]);

    console.log("Created inbox threads and messages.");
  } else {
    console.log("Inbox threads already exist, skipping.");
  }

  // ── 17. STAFF NOTIFICATIONS ─────────────────────────────────────────────
  const existingNotifs = await db
    .select()
    .from(staffNotificationsTable)
    .where(eq(staffNotificationsTable.tenantId, tenantId));

  if (existingNotifs.length === 0) {
    await db.insert(staffNotificationsTable).values([
      {
        tenantId,
        kind: "invoice_paid",
        title: "Invoice paid",
        message: "INV-0001 (£450.00) has been marked as paid by Emily Harrison.",
        linkPath: "/invoices",
        createdAt: daysAgo(15),
      },
      {
        tenantId,
        kind: "quote_accepted",
        title: "Quote accepted",
        message: "Robert Clarke accepted QT-0003 (Full Rewire — 3 Bed Semi).",
        linkPath: "/quotes",
        createdAt: daysAgo(10),
      },
      {
        tenantId,
        kind: "customer_message",
        title: "New message from Robert Clarke",
        message: "Hi, just checking when you expect to finish? We have a plasterer booked for next Monday.",
        linkPath: "/inbox",
        createdAt: daysAgo(1),
      },
    ]);
    console.log("Created staff notifications.");
  } else {
    console.log("Staff notifications already exist, skipping.");
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n=== Seed complete ===");
  console.log("Tenant:          Acme Trades Ltd");
  console.log("Login:           owner@acme-trades.test / OwnerPass123!");
  console.log("Admin:           admin@acme-trades.test / AdminPass123!");
  console.log("Field staff:     field1@acme-trades.test / FieldPass123!");
  console.log("                 field2@acme-trades.test / FieldPass123!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
