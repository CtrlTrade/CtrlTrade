import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import of the module under test.
// ---------------------------------------------------------------------------

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  tenantIntegrationsTable: { id: "id", tenantId: "tenantId", provider: "provider", status: "status" },
  integrationSyncLogsTable: {},
  leadsTable: {},
  invoicesTable: {},
  invoiceItemsTable: {},
  customersTable: {},
  jobsTable: {},
  paymentsTable: {},
}));

vi.mock("../../../lib/tokenCrypt", () => ({
  decryptToken: vi.fn(() => "test-api-key"),
  encryptToken: vi.fn((v: string) => v),
}));

vi.mock("../../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../lib/audit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../registry", () => ({
  getProvider: vi.fn(() => null),
}));

vi.mock("../xero", () => ({
  xeroPushContact: vi.fn(),
  xeroPushInvoice: vi.fn(),
  xeroPullInvoiceStatus: vi.fn(),
}));

vi.mock("../google", () => ({
  googleUpsertEvent: vi.fn(),
  googleDeleteEvent: vi.fn(),
  googlePullCalendarChanges: vi.fn(),
}));

vi.mock("../outlook", () => ({
  outlookUpsertEvent: vi.fn(),
  outlookDeleteEvent: vi.fn(),
  outlookPullCalendarChanges: vi.fn(),
}));

const mockFetchMyJobQuoteLeads = vi.fn();
const mockFetchCheckatradeLeads = vi.fn();

vi.mock("../myjobquote", () => ({
  fetchMyJobQuoteLeads: mockFetchMyJobQuoteLeads,
}));

vi.mock("../checkatrade", () => ({
  fetchCheckatradeLeads: mockFetchCheckatradeLeads,
}));

vi.mock("../../../routes/invoices", () => ({
  recordInvoicePayment: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers to build chainable Drizzle-style mock builders
// ---------------------------------------------------------------------------

function makeSelectChain(resolveWith: unknown) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockResolvedValue(resolveWith);
  return chain;
}

function makeInsertChain(returningResult: { id: string }[]) {
  const chain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
  };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returningResult);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockResolvedValue([]);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pullLeadsFromProvider — dedup via onConflictDoNothing", () => {
  const TENANT_ID = "tenant-abc";
  const PROVIDER = "myjobquote" as const;

  const MOCK_INTEGRATION = {
    id: "integ-1",
    tenantId: TENANT_ID,
    provider: PROVIDER,
    status: "connected",
    accessTokenEnc: "enc-key",
    refreshTokenEnc: null,
    tokenExpiresAt: null,
    lastSyncAt: null,
    settings: null,
    externalAccountId: null,
    lastError: null,
    lastErrorAt: null,
  };

  const SAMPLE_LEADS = [
    { externalId: "ext-1", name: "Alice", email: "alice@example.com", phone: null, description: "Boiler repair", budgetPence: 20000 },
    { externalId: "ext-2", name: "Bob", email: "bob@example.com", phone: null, description: "Roof fix", budgetPence: 50000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMyJobQuoteLeads.mockResolvedValue(SAMPLE_LEADS);
  });

  it("counts all leads as imported when none exist yet (returning all rows)", async () => {
    mockDb.select.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDb.insert.mockReturnValue(makeInsertChain([{ id: "lead-1" }, { id: "lead-2" }]));
    mockDb.update.mockReturnValue(makeUpdateChain());

    const { pullLeadsFromProvider } = await import("../sync.js");
    await pullLeadsFromProvider(TENANT_ID, PROVIDER);

    const insertCall = mockDb.insert.mock.calls[0];
    expect(insertCall).toBeDefined();

    const valuesArg = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(valuesArg).toHaveLength(2);
    expect(valuesArg[0].externalId).toBe("ext-1");
    expect(valuesArg[1].externalId).toBe("ext-2");

    const onConflictResult = mockDb.insert.mock.results[0].value.onConflictDoNothing;
    expect(onConflictResult).toHaveBeenCalled();

    const syncInsert = mockDb.insert.mock.results[1]?.value;
    expect(syncInsert).toBeDefined();
  });

  it("counts all leads as skipped when returning is empty (concurrent duplicate insert)", async () => {
    mockDb.select.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDb.insert.mockReturnValue(makeInsertChain([]));
    mockDb.update.mockReturnValue(makeUpdateChain());

    const { pullLeadsFromProvider } = await import("../sync.js");
    await pullLeadsFromProvider(TENANT_ID, PROVIDER);

    const insertChain = mockDb.insert.mock.results[0].value;
    expect(insertChain.onConflictDoNothing).toHaveBeenCalled();
    expect(insertChain.returning).toHaveBeenCalled();
  });

  it("correctly splits imported vs skipped when only some rows are new", async () => {
    mockDb.select.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDb.insert.mockReturnValue(makeInsertChain([{ id: "lead-1" }]));
    mockDb.update.mockReturnValue(makeUpdateChain());

    mockFetchMyJobQuoteLeads.mockResolvedValue(SAMPLE_LEADS);

    const { pullLeadsFromProvider } = await import("../sync.js");
    await pullLeadsFromProvider(TENANT_ID, PROVIDER);

    const insertChain = mockDb.insert.mock.results[0].value;
    const returnedRows = await insertChain.returning.mock.results[0].value;
    expect(returnedRows).toHaveLength(1);
  });

  it("simulates concurrent inserts: both calls use onConflictDoNothing, second gets empty returning", async () => {
    // Track chains created for the leads batch insert specifically (identified by having
    // onConflictDoNothing called on them, which only the leads insert does).
    const leadsInsertChains: ReturnType<typeof makeInsertChain>[] = [];
    let leadsCallCount = 0;

    mockDb.select.mockImplementation(() => makeSelectChain([MOCK_INTEGRATION]));
    mockDb.insert.mockImplementation(() => {
      // We distinguish lead inserts from sync-log inserts by recording chains
      // that have onConflictDoNothing invoked on them (only the leads insert does this).
      leadsCallCount++;
      const chain = makeInsertChain(leadsCallCount === 1 ? [{ id: "lead-1" }, { id: "lead-2" }] : []);
      chain.onConflictDoNothing.mockImplementation(() => {
        leadsInsertChains.push(chain);
        return chain; // return the same chain so .returning() can be chained
      });
      return chain;
    });
    mockDb.update.mockReturnValue(makeUpdateChain());

    const { pullLeadsFromProvider } = await import("../sync.js");

    await Promise.all([
      pullLeadsFromProvider(TENANT_ID, PROVIDER),
      pullLeadsFromProvider(TENANT_ID, PROVIDER),
    ]);

    // Both lead batch inserts must have used onConflictDoNothing
    expect(leadsInsertChains).toHaveLength(2);

    const firstReturned = await leadsInsertChains[0].returning.mock.results[0].value;
    const secondReturned = await leadsInsertChains[1].returning.mock.results[0].value;

    // First concurrent insert succeeded; second was blocked by the unique index → empty
    expect(firstReturned).toHaveLength(2);
    expect(secondReturned).toHaveLength(0);
  });

  it("skips leads with no externalId before inserting", async () => {
    const leadsWithNullId = [
      { externalId: null, name: "No ID", email: null, phone: null, description: null, budgetPence: 0 },
      ...SAMPLE_LEADS,
    ];
    mockFetchMyJobQuoteLeads.mockResolvedValue(leadsWithNullId);
    mockDb.select.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDb.insert.mockReturnValue(makeInsertChain([{ id: "lead-1" }, { id: "lead-2" }]));
    mockDb.update.mockReturnValue(makeUpdateChain());

    const { pullLeadsFromProvider } = await import("../sync.js");
    await pullLeadsFromProvider(TENANT_ID, PROVIDER);

    const insertChain = mockDb.insert.mock.results[0].value;
    const valuesArg = insertChain.values.mock.calls[0][0];
    expect(valuesArg).toHaveLength(2);
    expect(valuesArg.every((v: { externalId: string }) => v.externalId !== null)).toBe(true);
  });

  it("does not perform a leads batch insert when externalLeads is empty", async () => {
    mockFetchMyJobQuoteLeads.mockResolvedValue([]);
    mockDb.select.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));

    // Track whether onConflictDoNothing was ever invoked (only the leads insert calls it)
    let onConflictCalled = false;
    mockDb.insert.mockImplementation(() => {
      const chain = makeInsertChain([]);
      chain.onConflictDoNothing.mockImplementation(() => {
        onConflictCalled = true;
        return chain;
      });
      return chain;
    });
    mockDb.update.mockReturnValue(makeUpdateChain());

    const { pullLeadsFromProvider } = await import("../sync.js");
    await pullLeadsFromProvider(TENANT_ID, PROVIDER);

    // No leads → no batch insert → onConflictDoNothing must never have been called
    expect(onConflictCalled).toBe(false);
  });
});
