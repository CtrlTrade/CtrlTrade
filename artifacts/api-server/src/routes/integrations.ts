import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  tenantIntegrationsTable,
  integrationSyncLogsTable,
  integrationCatalogueTable,
  type TenantIntegration,
} from "@workspace/db";
import { requireTenant, requireSuperAdmin } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { logger } from "../lib/logger";
import { encryptToken } from "../lib/tokenCrypt";
import { enqueueJob } from "../lib/queue";
import { getProvider, listProviders } from "../lib/integrations/registry";
import { recordSync } from "../lib/integrations/sync";
import type { ProviderId } from "../lib/integrations/types";
import { getAppBaseUrl } from "../lib/email";

const router: IRouter = Router();

const OAUTH_PROVIDERS: ProviderId[] = ["xero", "google_calendar", "outlook"];
const APIKEY_PROVIDERS: ProviderId[] = ["myjobquote", "checkatrade"];
const VALID_PROVIDERS: ProviderId[] = [...OAUTH_PROVIDERS, ...APIKEY_PROVIDERS];

function callbackUrl(): string {
  return `${getAppBaseUrl().replace(/\/$/, "")}/api/v1/integrations/callback`;
}

async function getCatalogueRow(provider: string) {
  const [row] = await db
    .select()
    .from(integrationCatalogueTable)
    .where(eq(integrationCatalogueTable.provider, provider));
  return row ?? null;
}

async function isProviderEnabled(provider: string): Promise<boolean> {
  const row = await getCatalogueRow(provider);
  if (!row) return true; // default enabled
  return row.enabled;
}

function serializeIntegration(row: TenantIntegration) {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    externalAccountId: row.externalAccountId,
    externalAccountLabel: row.externalAccountLabel,
    scopes: row.scopes,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---- Tenant endpoints ------------------------------------------------------

router.get("/v1/integrations/providers", requireTenant, async (_req, res): Promise<void> => {
  const rows = await Promise.all(
    listProviders().map(async (p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      category: p.category,
      authKind: p.authKind,
      configured: p.isConfigured(),
      enabled: await isProviderEnabled(p.id),
    })),
  );
  res.json(rows);
});

router.get("/v1/integrations", requireTenant, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(eq(tenantIntegrationsTable.tenantId, req.auth!.tenant!.id));
  res.json(rows.map(serializeIntegration));
});

// ---- OAuth connect (Xero, Google, Outlook) ---------------------------------

router.post("/v1/integrations/:provider/connect", requireTenant, async (req, res): Promise<void> => {
  const provider = String(req.params.provider) as ProviderId;
  if (!OAUTH_PROVIDERS.includes(provider)) {
    res.status(404).json({ error: "Unknown OAuth provider" });
    return;
  }
  if (!(await isProviderEnabled(provider))) {
    res.status(403).json({ error: "Provider disabled by administrator" });
    return;
  }
  const mod = getProvider(provider);
  if (!mod) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  if (!mod.isConfigured()) {
    res.status(503).json({
      error: `${mod.label} OAuth is not configured. Set the required client id and secret.`,
    });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const state = randomBytes(24).toString("hex");
  req.session.integrationOAuth ??= {};
  req.session.integrationOAuth[state] = {
    tenantId,
    provider,
    userId: req.auth!.user.id,
    createdAt: Date.now(),
  };
  const [existing] = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(and(eq(tenantIntegrationsTable.tenantId, tenantId), eq(tenantIntegrationsTable.provider, provider)));
  if (existing) {
    await db
      .update(tenantIntegrationsTable)
      .set({ status: "connecting" })
      .where(eq(tenantIntegrationsTable.id, existing.id));
  } else {
    await db.insert(tenantIntegrationsTable).values({
      tenantId,
      provider,
      status: "connecting",
      connectedByUserId: req.auth!.user.id,
    });
  }
  const authUrl = mod.buildAuthUrl!(state, callbackUrl());
  res.json({ authUrl });
});

// ---- API-key connect (MyJobQuote, Checkatrade) ------------------------------

router.post("/v1/integrations/:provider/apikey", requireTenant, async (req, res): Promise<void> => {
  const provider = String(req.params.provider) as ProviderId;
  if (!APIKEY_PROVIDERS.includes(provider)) {
    res.status(404).json({ error: "Unknown API-key provider" });
    return;
  }
  if (!(await isProviderEnabled(provider))) {
    res.status(403).json({ error: "Provider disabled by administrator" });
    return;
  }
  const mod = getProvider(provider);
  if (!mod) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }
  const syncIntervalMinutes = Number(req.body?.syncIntervalMinutes ?? 15);

  // Test the API key before storing it.
  if (mod.testApiKey) {
    const testError = await mod.testApiKey(apiKey).catch((e: unknown) =>
      e instanceof Error ? e.message : String(e),
    );
    if (testError) {
      res.status(422).json({ error: `API key validation failed: ${testError}` });
      return;
    }
  }

  const tenantId = req.auth!.tenant!.id;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(and(eq(tenantIntegrationsTable.tenantId, tenantId), eq(tenantIntegrationsTable.provider, provider)));

  let row: TenantIntegration;
  if (existing) {
    const [updated] = await db
      .update(tenantIntegrationsTable)
      .set({
        status: "connected",
        accessTokenEnc: encryptToken(apiKey),
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        settings: { syncIntervalMinutes },
        connectedAt: existing.connectedAt ?? now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        connectedByUserId: req.auth!.user.id,
      })
      .where(eq(tenantIntegrationsTable.id, existing.id))
      .returning();
    row = updated!;
  } else {
    const [inserted] = await db
      .insert(tenantIntegrationsTable)
      .values({
        tenantId,
        provider,
        status: "connected",
        accessTokenEnc: encryptToken(apiKey),
        settings: { syncIntervalMinutes },
        connectedAt: now,
        connectedByUserId: req.auth!.user.id,
      })
      .returning();
    row = inserted!;
  }

  await recordSync({
    tenantId,
    provider,
    direction: "connect",
    status: "ok",
    message: `Connected ${mod.label} via API key`,
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "integration.connected",
    message: `${mod.label} connected via API key`,
  });

  // Kick off an immediate sync to verify the key and import initial leads.
  await enqueueJob({
    kind: "integration_sync",
    payload: { tenantId, provider, kind: "leads.pull" },
    singletonKey: `leads.pull.${tenantId}.${provider}`,
  }).catch((err: unknown) => logger.warn({ err }, "Failed to enqueue initial leads.pull"));

  res.json(serializeIntegration(row));
});

// ---- OAuth callback --------------------------------------------------------

router.get("/v1/integrations/callback", async (req, res): Promise<void> => {
  const state = String(req.query.state ?? "");
  const code = String(req.query.code ?? "");
  const err = req.query.error ? String(req.query.error) : null;
  const session = req.session.integrationOAuth?.[state];
  if (!session) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }
  delete req.session.integrationOAuth![state];
  const mod = getProvider(session.provider);
  if (!mod) {
    res.status(400).send("Unknown provider");
    return;
  }
  const baseUrl = getAppBaseUrl().replace(/\/$/, "");
  if (err) {
    await db
      .update(tenantIntegrationsTable)
      .set({ status: "error", lastError: err, lastErrorAt: new Date() })
      .where(and(eq(tenantIntegrationsTable.tenantId, session.tenantId), eq(tenantIntegrationsTable.provider, session.provider)));
    res.redirect(`${baseUrl}/settings?tab=integrations&error=${encodeURIComponent(err)}`);
    return;
  }
  try {
    const tokens = await mod.exchangeCode!(code, callbackUrl());
    await db
      .update(tenantIntegrationsTable)
      .set({
        status: "connected",
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
        externalAccountId: tokens.externalAccountId,
        externalAccountLabel: tokens.externalAccountLabel,
        scopes: tokens.scopes,
        connectedAt: new Date(),
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
      })
      .where(and(eq(tenantIntegrationsTable.tenantId, session.tenantId), eq(tenantIntegrationsTable.provider, session.provider)));
    await recordSync({
      tenantId: session.tenantId,
      provider: session.provider as ProviderId,
      direction: "connect",
      status: "ok",
      message: `Connected ${mod.label}`,
    });
    await logAudit({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      kind: "integration.connected",
      message: `${mod.label} connected (${tokens.externalAccountLabel ?? tokens.externalAccountId ?? "account"})`,
    });
    res.redirect(`${baseUrl}/settings?tab=integrations&connected=${session.provider}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e, provider: session.provider }, "OAuth exchange failed");
    await db
      .update(tenantIntegrationsTable)
      .set({ status: "error", lastError: msg.slice(0, 500), lastErrorAt: new Date() })
      .where(and(eq(tenantIntegrationsTable.tenantId, session.tenantId), eq(tenantIntegrationsTable.provider, session.provider)));
    await recordSync({
      tenantId: session.tenantId,
      provider: session.provider as ProviderId,
      direction: "connect",
      status: "error",
      message: msg.slice(0, 500),
    });
    res.redirect(`${baseUrl}/settings?tab=integrations&error=${encodeURIComponent(msg)}`);
  }
});

router.delete("/v1/integrations/:provider", requireTenant, async (req, res): Promise<void> => {
  const provider = String(req.params.provider) as ProviderId;
  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const [row] = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(and(eq(tenantIntegrationsTable.tenantId, tenantId), eq(tenantIntegrationsTable.provider, provider)));
  if (!row) {
    res.status(404).json({ error: "Not connected" });
    return;
  }
  await db
    .update(tenantIntegrationsTable)
    .set({
      status: "disconnected",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    })
    .where(eq(tenantIntegrationsTable.id, row.id));
  await recordSync({
    tenantId,
    provider,
    direction: "disconnect",
    status: "ok",
    message: `Disconnected ${provider}`,
  });
  await logAudit({
    tenantId,
    actorUserId: req.auth!.user.id,
    kind: "integration.disconnected",
    message: `${provider} disconnected`,
  });
  res.status(204).end();
});

router.post("/v1/integrations/:provider/sync", requireTenant, async (req, res): Promise<void> => {
  const provider = String(req.params.provider) as ProviderId;
  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const tenantId = req.auth!.tenant!.id;

  let syncKind: string;
  if (APIKEY_PROVIDERS.includes(provider)) {
    syncKind = "leads.pull";
  } else if (provider === "xero") {
    syncKind = "invoice.payment_pull";
  } else {
    syncKind = "calendar.pull";
  }

  await enqueueJob({
    kind: "integration_sync",
    payload: { tenantId, provider, kind: syncKind },
    singletonKey: `${syncKind}.${tenantId}.${provider}`,
  });
  res.json({ enqueued: true });
});

router.get("/v1/integrations/:provider/logs", requireTenant, async (req, res): Promise<void> => {
  const provider = String(req.params.provider) as ProviderId;
  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const tenantId = req.auth!.tenant!.id;
  const rows = await db
    .select()
    .from(integrationSyncLogsTable)
    .where(and(eq(integrationSyncLogsTable.tenantId, tenantId), eq(integrationSyncLogsTable.provider, provider)))
    .orderBy(desc(integrationSyncLogsTable.createdAt))
    .limit(50);
  res.json(
    rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      entityKind: r.entityKind,
      entityId: r.entityId,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// ---- Admin catalogue endpoints --------------------------------------------

router.get("/v1/admin/integration-catalogue", requireSuperAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(integrationCatalogueTable);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const list = listProviders().map((p) => {
    const row = byProvider.get(p.id);
    return {
      provider: p.id,
      label: p.label,
      description: p.description,
      category: p.category,
      configured: p.isConfigured(),
      enabled: row?.enabled ?? true,
      minPlan: row?.minPlan ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });
  res.json(list);
});

router.put("/v1/admin/integration-catalogue/:provider", requireSuperAdmin, async (req, res): Promise<void> => {
  const provider = String(req.params.provider);
  if (!VALID_PROVIDERS.includes(provider as ProviderId)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const enabled = Boolean(req.body?.enabled ?? true);
  const minPlan = req.body?.minPlan ? String(req.body.minPlan) : null;
  const [existing] = await db
    .select()
    .from(integrationCatalogueTable)
    .where(eq(integrationCatalogueTable.provider, provider));
  let row;
  if (existing) {
    [row] = await db
      .update(integrationCatalogueTable)
      .set({ enabled, minPlan, updatedByUserId: req.auth!.user.id })
      .where(eq(integrationCatalogueTable.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(integrationCatalogueTable)
      .values({ provider, enabled, minPlan, updatedByUserId: req.auth!.user.id })
      .returning();
  }
  await logAudit({
    actorUserId: req.auth!.user.id,
    actorLabel: `superadmin:${req.auth!.user.email}`,
    kind: "admin.integration_catalogue_changed",
    message: `${provider}: enabled=${enabled}`,
    metadata: { provider, enabled, minPlan },
  });
  res.json({
    provider: row.provider,
    enabled: row.enabled,
    minPlan: row.minPlan,
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
