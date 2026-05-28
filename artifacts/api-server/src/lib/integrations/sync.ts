import { and, eq, sql } from "drizzle-orm";
import {
  db,
  tenantIntegrationsTable,
  integrationSyncLogsTable,
  invoicesTable,
  invoiceItemsTable,
  customersTable,
  jobsTable,
  leadsTable,
  paymentsTable,
  type TenantIntegration,
} from "@workspace/db";
import { decryptToken, encryptToken } from "../tokenCrypt";
import { logger } from "../logger";
import { logAudit } from "../audit";
import { getProvider } from "./registry";
import { xeroPushContact, xeroPushInvoice, xeroPullInvoiceStatus } from "./xero";
import { googleUpsertEvent, googleDeleteEvent, googlePullCalendarChanges } from "./google";
import { outlookUpsertEvent, outlookDeleteEvent, outlookPullCalendarChanges } from "./outlook";
import { fetchMyJobQuoteLeads } from "./myjobquote";
import { fetchCheckatradeLeads } from "./checkatrade";
import { recordInvoicePayment } from "../../routes/invoices";
import type { DispatchPayload, ProviderId } from "./types";

/** Log a sync attempt to integration_sync_logs. */
export async function recordSync(opts: {
  tenantId: string;
  provider: ProviderId;
  direction: "push" | "pull" | "connect" | "disconnect";
  entityKind?: string | null;
  entityId?: string | null;
  status: "ok" | "error" | "skipped";
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(integrationSyncLogsTable).values({
    tenantId: opts.tenantId,
    provider: opts.provider,
    direction: opts.direction,
    entityKind: opts.entityKind ?? null,
    entityId: opts.entityId ?? null,
    status: opts.status,
    message: opts.message ?? null,
    metadata: opts.metadata ?? null,
  });
}

/** Ensure the integration's access token is valid, refreshing if needed. */
export async function ensureAccessToken(integ: TenantIntegration): Promise<string | null> {
  const provider = getProvider(integ.provider);
  if (!provider) return null;
  const access = decryptToken(integ.accessTokenEnc);
  const refresh = decryptToken(integ.refreshTokenEnc);
  const expiresAt = integ.tokenExpiresAt;
  const stillValid = access && expiresAt && expiresAt.getTime() > Date.now() + 30_000;
  if (stillValid) return access;
  if (!refresh) return access; // best effort with whatever we have
  if (!provider.refresh) return access; // api-key providers don't refresh
  try {
    const fresh = await provider.refresh(refresh);
    await db
      .update(tenantIntegrationsTable)
      .set({
        accessTokenEnc: encryptToken(fresh.accessToken),
        refreshTokenEnc: encryptToken(fresh.refreshToken ?? refresh),
        tokenExpiresAt: fresh.expiresAt,
        status: "connected",
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(tenantIntegrationsTable.id, integ.id));
    return fresh.accessToken;
  } catch (err) {
    logger.warn({ err, integrationId: integ.id }, "Token refresh failed");
    await markError(integ, err);
    return null;
  }
}

export async function markError(integ: TenantIntegration, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  await db
    .update(tenantIntegrationsTable)
    .set({ status: "error", lastError: msg.slice(0, 500), lastErrorAt: new Date() })
    .where(eq(tenantIntegrationsTable.id, integ.id));
  await recordSync({
    tenantId: integ.tenantId,
    provider: integ.provider as ProviderId,
    direction: "push",
    status: "error",
    message: msg.slice(0, 500),
  });
}

async function markOk(integ: TenantIntegration): Promise<void> {
  await db
    .update(tenantIntegrationsTable)
    .set({ status: "connected", lastSyncAt: new Date(), lastError: null, lastErrorAt: null })
    .where(eq(tenantIntegrationsTable.id, integ.id));
}

async function getConnectedIntegration(
  tenantId: string,
  provider: ProviderId,
): Promise<TenantIntegration | null> {
  const [row] = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(and(eq(tenantIntegrationsTable.tenantId, tenantId), eq(tenantIntegrationsTable.provider, provider)));
  return row ?? null;
}

// ----- Xero handlers --------------------------------------------------------
async function syncInvoiceToXero(tenantId: string, invoiceId: string): Promise<void> {
  const integ = await getConnectedIntegration(tenantId, "xero");
  if (!integ || integ.status === "disconnected") return;
  const token = await ensureAccessToken(integ);
  if (!token || !integ.externalAccountId) {
    await recordSync({
      tenantId,
      provider: "xero",
      direction: "push",
      entityKind: "invoice",
      entityId: invoiceId,
      status: "skipped",
      message: "Missing access token or external tenant id",
    });
    return;
  }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv || inv.tenantId !== tenantId) return;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, inv.customerId));
  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, inv.id));
  try {
    // Push contact first (best-effort; ignore errors here since invoice push also creates a contact by name).
    if (customer) {
      try {
        await xeroPushContact({
          accessToken: token,
          xeroTenantId: integ.externalAccountId,
          customer: { name: customer.name, email: customer.email, phone: customer.phone },
        });
      } catch (err) {
        logger.debug({ err }, "Xero contact push (pre-invoice) failed; continuing");
      }
    }
    const result = await xeroPushInvoice({
      accessToken: token,
      xeroTenantId: integ.externalAccountId,
      contactName: customer?.name ?? "Customer",
      contactEmail: customer?.email ?? null,
      invoice: {
        number: inv.number,
        title: inv.title,
        totalPence: inv.totalPence,
        subtotalPence: inv.subtotalPence,
        taxPence: inv.taxPence,
        currency: inv.currency,
        dueAt: inv.dueAt,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPricePence: i.unitPricePence,
        })),
      },
    });
    await recordSync({
      tenantId,
      provider: "xero",
      direction: "push",
      entityKind: "invoice",
      entityId: inv.id,
      status: "ok",
      message: `Pushed invoice ${inv.number} to Xero`,
      metadata: { xeroInvoiceId: result.xeroInvoiceId, status: result.status },
    });
    await markOk(integ);
  } catch (err) {
    await markError(integ, err);
  }
}

async function pullInvoicePayment(tenantId: string, invoiceId: string): Promise<void> {
  const integ = await getConnectedIntegration(tenantId, "xero");
  if (!integ || integ.status === "disconnected") return;
  const token = await ensureAccessToken(integ);
  if (!token || !integ.externalAccountId) return;
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv || inv.tenantId !== tenantId) return;
  if (inv.status === "paid" || inv.status === "void") return;
  try {
    const result = await xeroPullInvoiceStatus({
      accessToken: token,
      xeroTenantId: integ.externalAccountId,
      invoiceNumber: inv.number,
    });
    if (!result) return;
    if (result.amountPaid > 0) {
      const [existing] = await db
        .select({ s: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.invoiceId, inv.id), eq(paymentsTable.provider, "xero")));
      if (!existing) {
        await db.insert(paymentsTable).values({
          tenantId,
          invoiceId: inv.id,
          amountPence: result.amountPaid,
          currency: inv.currency,
          provider: "xero",
          status: "succeeded",
        });
        if (result.status === "PAID") {
          await db.update(invoicesTable).set({ status: "paid", paidAt: new Date() }).where(eq(invoicesTable.id, inv.id));
        }
        // Re-use the orchestrated path so receipts + audit fire consistently.
        try {
          await recordInvoicePayment({ invoiceId: inv.id, amountPence: 0, currency: inv.currency });
        } catch {
          // best-effort
        }
      }
    }
    await recordSync({
      tenantId,
      provider: "xero",
      direction: "pull",
      entityKind: "invoice",
      entityId: inv.id,
      status: "ok",
      message: `Pulled status ${result.status} for invoice ${inv.number}`,
      metadata: { xeroStatus: result.status, amountPaid: result.amountPaid },
    });
    await markOk(integ);
  } catch (err) {
    await markError(integ, err);
  }
}

// ----- Calendar handlers ----------------------------------------------------
async function syncJobToCalendars(tenantId: string, jobId: string): Promise<void> {
  const integrations = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(eq(tenantIntegrationsTable.tenantId, tenantId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job || job.tenantId !== tenantId) return;
  if (!job.scheduledStart) return; // nothing to sync without a start time
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  for (const integ of integrations) {
    if (integ.provider !== "google_calendar" && integ.provider !== "outlook") continue;
    if (integ.status === "disconnected") continue;
    const token = await ensureAccessToken(integ);
    if (!token) continue;
    const settings = (integ.settings ?? {}) as Record<string, unknown>;
    const eventMap = (settings.eventIds as Record<string, string> | undefined) ?? {};
    const existingEventId = eventMap[job.id] ?? null;
    const subject = `${job.number} — ${job.title}${customer ? ` (${customer.name})` : ""}`;
    const location = [job.addressLine1, job.city, job.postcode].filter(Boolean).join(", ") || null;
    try {
      let eventId: string;
      if (integ.provider === "google_calendar") {
        const result = await googleUpsertEvent({
          accessToken: token,
          calendarId: integ.externalAccountId ?? "primary",
          eventId: existingEventId,
          summary: subject,
          description: job.description,
          location,
          start: job.scheduledStart,
          end: job.scheduledEnd,
        });
        eventId = result.eventId;
      } else {
        const result = await outlookUpsertEvent({
          accessToken: token,
          eventId: existingEventId,
          subject,
          body: job.description,
          location,
          start: job.scheduledStart,
          end: job.scheduledEnd,
        });
        eventId = result.eventId;
      }
      eventMap[job.id] = eventId;
      await db
        .update(tenantIntegrationsTable)
        .set({ settings: { ...settings, eventIds: eventMap } })
        .where(eq(tenantIntegrationsTable.id, integ.id));
      await recordSync({
        tenantId,
        provider: integ.provider as ProviderId,
        direction: "push",
        entityKind: "job",
        entityId: job.id,
        status: "ok",
        message: `Synced job ${job.number} to ${integ.provider}`,
        metadata: { eventId },
      });
      await markOk(integ);
    } catch (err) {
      await markError(integ, err);
    }
  }
}

async function deleteJobFromCalendars(tenantId: string, jobId: string): Promise<void> {
  const integrations = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(eq(tenantIntegrationsTable.tenantId, tenantId));
  for (const integ of integrations) {
    if (integ.provider !== "google_calendar" && integ.provider !== "outlook") continue;
    const settings = (integ.settings ?? {}) as Record<string, unknown>;
    const eventMap = (settings.eventIds as Record<string, string> | undefined) ?? {};
    const eventId = eventMap[jobId];
    if (!eventId) continue;
    const token = await ensureAccessToken(integ);
    if (!token) continue;
    try {
      if (integ.provider === "google_calendar") {
        await googleDeleteEvent({
          accessToken: token,
          calendarId: integ.externalAccountId ?? "primary",
          eventId,
        });
      } else {
        await outlookDeleteEvent({ accessToken: token, eventId });
      }
      delete eventMap[jobId];
      await db
        .update(tenantIntegrationsTable)
        .set({ settings: { ...settings, eventIds: eventMap } })
        .where(eq(tenantIntegrationsTable.id, integ.id));
      await recordSync({
        tenantId,
        provider: integ.provider as ProviderId,
        direction: "push",
        entityKind: "job",
        entityId: jobId,
        status: "ok",
        message: `Deleted calendar event for job`,
      });
    } catch (err) {
      await markError(integ, err);
    }
  }
}

/**
 * Pull external calendar changes back into job schedules.
 *
 * Google:  uses sync tokens stored in `settings.calSyncToken`.
 *          A null/missing token triggers a baseline scan (90-day window) to
 *          establish the first token; no job updates are applied on that
 *          first pass — only the token is captured.
 *          A 410 response invalidates the stored token; the next call starts fresh.
 *
 * Outlook: uses Graph delta links stored in `settings.calDeltaLink`.
 *          A null/missing link triggers a full delta baseline scan with the
 *          same first-pass-only-token semantics.
 *
 * Deleted events surface as a sync-log warning rather than auto-cancelling the job.
 */
async function pullCalendarChanges(tenantId: string, provider: "google_calendar" | "outlook"): Promise<void> {
  const integ = await getConnectedIntegration(tenantId, provider);
  if (!integ || integ.status === "disconnected") return;

  const token = await ensureAccessToken(integ);
  if (!token) {
    await recordSync({
      tenantId,
      provider,
      direction: "pull",
      status: "skipped",
      message: "No valid access token",
    });
    return;
  }

  const settings = (integ.settings ?? {}) as Record<string, unknown>;
  // eventIds: jobId -> externalEventId (built during push)
  const eventIds = (settings.eventIds as Record<string, string> | undefined) ?? {};
  // Invert to externalEventId -> jobId for fast lookup
  const eventToJob: Record<string, string> = {};
  for (const [jobId, eventId] of Object.entries(eventIds)) {
    eventToJob[eventId] = jobId;
  }

  try {
    if (provider === "google_calendar") {
      const syncToken = (settings.calSyncToken as string | null | undefined) ?? null;
      const isFirstPass = !syncToken;

      const { changes, nextSyncToken } = await googlePullCalendarChanges({
        accessToken: token,
        calendarId: integ.externalAccountId ?? "primary",
        syncToken,
      });

      // Persist the new token (or clear it if invalidated so next run re-establishes)
      await db
        .update(tenantIntegrationsTable)
        .set({ settings: { ...settings, calSyncToken: nextSyncToken ?? null } })
        .where(eq(tenantIntegrationsTable.id, integ.id));

      if (isFirstPass) {
        // First pass just establishes the sync token — don't apply historical changes.
        await recordSync({
          tenantId,
          provider,
          direction: "pull",
          status: "ok",
          message: `Google Calendar sync token initialised; ${changes.length} baseline events seen`,
        });
        await markOk(integ);
        return;
      }

      await applyCalendarChanges({ tenantId, provider, eventToJob, changes });
    } else {
      const deltaLink = (settings.calDeltaLink as string | null | undefined) ?? null;
      const isFirstPass = !deltaLink;

      const { changes, nextDeltaLink } = await outlookPullCalendarChanges({
        accessToken: token,
        deltaLink,
      });

      await db
        .update(tenantIntegrationsTable)
        .set({ settings: { ...settings, calDeltaLink: nextDeltaLink ?? null } })
        .where(eq(tenantIntegrationsTable.id, integ.id));

      if (isFirstPass) {
        await recordSync({
          tenantId,
          provider,
          direction: "pull",
          status: "ok",
          message: `Outlook delta link initialised; ${changes.length} baseline events seen`,
        });
        await markOk(integ);
        return;
      }

      await applyCalendarChanges({ tenantId, provider, eventToJob, changes });
    }

    await markOk(integ);
  } catch (err) {
    await markError(integ, err);
  }
}

/** Apply a batch of calendar change records to matching jobs. */
async function applyCalendarChanges(opts: {
  tenantId: string;
  provider: "google_calendar" | "outlook";
  eventToJob: Record<string, string>;
  changes: Array<{ eventId: string; start?: Date; end?: Date; deleted: boolean }>;
}): Promise<void> {
  const { tenantId, provider, eventToJob, changes } = opts;
  let updated = 0;
  let warned = 0;

  for (const change of changes) {
    const jobId = eventToJob[change.eventId];
    if (!jobId) continue; // event not tracked by us — skip

    if (change.deleted) {
      // Surface as a warning; do NOT auto-cancel the job.
      logger.warn(
        { tenantId, provider, eventId: change.eventId, jobId },
        "calendar.pull: external event deleted — job NOT auto-cancelled",
      );
      await recordSync({
        tenantId,
        provider,
        direction: "pull",
        entityKind: "job",
        entityId: jobId,
        status: "ok",
        message: "External calendar event was deleted; job schedule left unchanged (manual review required)",
        metadata: { eventId: change.eventId, externallyDeleted: true },
      });
      warned++;
      continue;
    }

    if (!change.start) continue; // no time data — nothing to update

    // Guard against invalid dates (e.g. unparseable provider values).
    if (isNaN(change.start.getTime())) {
      await recordSync({
        tenantId,
        provider,
        direction: "pull",
        entityKind: "job",
        entityId: jobId,
        status: "error",
        message: "Skipped update: external event returned an invalid start time",
        metadata: { eventId: change.eventId },
      });
      continue;
    }

    await db
      .update(jobsTable)
      .set({
        scheduledStart: change.start,
        scheduledEnd: change.end && !isNaN(change.end.getTime()) ? change.end : null,
        updatedAt: new Date(),
      })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.tenantId, tenantId)));

    await recordSync({
      tenantId,
      provider,
      direction: "pull",
      entityKind: "job",
      entityId: jobId,
      status: "ok",
      message: `Job schedule updated from external ${provider} event`,
      metadata: {
        eventId: change.eventId,
        scheduledStart: change.start.toISOString(),
        scheduledEnd: change.end?.toISOString() ?? null,
      },
    });
    updated++;
  }

  logger.info({ tenantId, provider, updated, warned }, "calendar.pull: finished applying changes");
}

// ----- Lead import handlers (MyJobQuote & Checkatrade) ----------------------

export async function pullLeadsFromProvider(
  tenantId: string,
  provider: "myjobquote" | "checkatrade",
): Promise<void> {
  const [integ] = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(and(eq(tenantIntegrationsTable.tenantId, tenantId), eq(tenantIntegrationsTable.provider, provider)));

  if (!integ || integ.status !== "connected") {
    logger.debug({ tenantId, provider }, "leads.pull: integration not connected — skipping");
    return;
  }

  const apiKey = decryptToken(integ.accessTokenEnc);
  if (!apiKey) {
    await recordSync({ tenantId, provider, direction: "pull", status: "error", message: "No API key stored" });
    return;
  }

  const since = integ.lastSyncAt ?? null;

  try {
    const externalLeads =
      provider === "myjobquote"
        ? await fetchMyJobQuoteLeads(apiKey, since)
        : await fetchCheckatradeLeads(apiKey, since);

    const validLeads = externalLeads
      .filter((ext) => ext.externalId)
      .map((ext) => ({
        tenantId,
        name: ext.name,
        email: ext.email,
        phone: ext.phone,
        source: provider,
        externalId: ext.externalId!,
        title: ext.description
          ? ext.description.slice(0, 120)
          : `${provider === "myjobquote" ? "MyJobQuote" : "Checkatrade"} enquiry`,
        message: ext.description,
        valuePence: ext.budgetPence,
        score: 0,
        status: "new" as const,
        followUpDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }));

    // Atomic upsert — ON CONFLICT DO NOTHING is safe under concurrent sync jobs
    // because the unique index on (tenant_id, source, external_id) is the guard.
    // The returning clause tells us exactly how many rows were truly inserted vs skipped.
    const inserted =
      validLeads.length > 0
        ? await db.insert(leadsTable).values(validLeads).onConflictDoNothing().returning({ id: leadsTable.id })
        : [];

    const imported = inserted.length;
    const skipped = validLeads.length - imported;

    // Update lastSyncAt
    await db
      .update(tenantIntegrationsTable)
      .set({
        status: "connected",
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(tenantIntegrationsTable.id, integ.id));

    await recordSync({
      tenantId,
      provider,
      direction: "pull",
      entityKind: "lead",
      status: "ok",
      message: `Imported ${imported} new lead(s); ${skipped} duplicate(s) skipped`,
      metadata: { imported, skipped, since: since?.toISOString() ?? null },
    });

    logger.info({ tenantId, provider, imported, skipped }, "leads.pull: finished");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, tenantId, provider }, "leads.pull failed");
    await db
      .update(tenantIntegrationsTable)
      .set({ status: "error", lastError: msg.slice(0, 500), lastErrorAt: new Date() })
      .where(eq(tenantIntegrationsTable.id, integ.id));
    await recordSync({ tenantId, provider, direction: "pull", status: "error", message: msg.slice(0, 500) });
  }
}

async function nightlyLeadImportAll(): Promise<void> {
  for (const provider of ["myjobquote", "checkatrade"] as const) {
    const rows = await db
      .select()
      .from(tenantIntegrationsTable)
      .where(eq(tenantIntegrationsTable.provider, provider));
    for (const integ of rows) {
      if (integ.status !== "connected") continue;
      const settings = (integ.settings ?? {}) as Record<string, unknown>;
      const intervalMinutes = Number(settings["syncIntervalMinutes"] ?? 15);
      const dueAt = new Date((integ.lastSyncAt?.getTime() ?? 0) + intervalMinutes * 60 * 1000);
      if (dueAt > new Date()) continue; // not due yet
      await pullLeadsFromProvider(integ.tenantId, provider).catch((err) =>
        logger.warn({ err, provider, tenantId: integ.tenantId }, "nightly lead import failed"),
      );
    }
  }
}

async function nightlyReconcileAll(): Promise<void> {
  // Pull new leads from MyJobQuote and Checkatrade for all connected tenants.
  await nightlyLeadImportAll().catch((err) =>
    logger.warn({ err }, "nightly reconcile: lead import sweep failed"),
  );

  // Pull payment status for every unpaid invoice in tenants connected to Xero.
  const integs = await db
    .select()
    .from(tenantIntegrationsTable)
    .where(eq(tenantIntegrationsTable.provider, "xero"));
  for (const integ of integs) {
    if (integ.status !== "connected") continue;
    const unpaid = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.tenantId, integ.tenantId), eq(invoicesTable.status, "sent")));
    for (const u of unpaid) {
      await pullInvoicePayment(integ.tenantId, u.id).catch((err) =>
        logger.warn({ err, invoiceId: u.id }, "nightly reconcile: pull failed"),
      );
    }
  }

  // Pull external calendar changes for every connected calendar integration.
  const calIntegProviders = ["google_calendar", "outlook"] as const;
  for (const provider of calIntegProviders) {
    const calIntegrations = await db
      .select()
      .from(tenantIntegrationsTable)
      .where(eq(tenantIntegrationsTable.provider, provider));
    for (const integ of calIntegrations) {
      if (integ.status !== "connected") continue;
      await pullCalendarChanges(integ.tenantId, provider).catch((err) =>
        logger.warn({ err, provider, tenantId: integ.tenantId }, "nightly reconcile: calendar pull failed"),
      );
    }
  }
}

/** Worker dispatcher — entry point from worker.ts. */
export async function handleIntegrationSync(payload: DispatchPayload): Promise<void> {
  if (!payload || !payload.kind) return;
  if (payload.kind === "nightly_reconcile") {
    await nightlyReconcileAll();
    return;
  }
  if (!payload.tenantId) {
    logger.warn({ payload }, "integration_sync: missing tenantId");
    return;
  }
  switch (payload.kind) {
    case "invoice.upsert":
      if (payload.entityId) await syncInvoiceToXero(payload.tenantId, payload.entityId);
      break;
    case "invoice.payment_pull":
      if (payload.entityId) await pullInvoicePayment(payload.tenantId, payload.entityId);
      break;
    case "customer.upsert":
      // Customers are pushed implicitly with invoices; explicit path could be added later.
      break;
    case "job.upsert":
      if (payload.entityId) await syncJobToCalendars(payload.tenantId, payload.entityId);
      break;
    case "job.delete":
      if (payload.entityId) await deleteJobFromCalendars(payload.tenantId, payload.entityId);
      break;
    case "calendar.pull": {
      // Pull external edits back into job schedules.
      // Dispatch targets a specific provider, or both calendar providers when unspecified.
      const calProviders: Array<"google_calendar" | "outlook"> =
        payload.provider === "google_calendar" || payload.provider === "outlook"
          ? [payload.provider]
          : ["google_calendar", "outlook"];
      for (const cp of calProviders) {
        await pullCalendarChanges(payload.tenantId, cp).catch((err) =>
          logger.warn({ err, provider: cp, tenantId: payload.tenantId }, "calendar.pull failed"),
        );
      }
      break;
    }
    case "leads.pull": {
      // Pull new leads from MyJobQuote and/or Checkatrade.
      const leadProviders: Array<"myjobquote" | "checkatrade"> =
        payload.provider === "myjobquote" || payload.provider === "checkatrade"
          ? [payload.provider]
          : ["myjobquote", "checkatrade"];
      for (const lp of leadProviders) {
        await pullLeadsFromProvider(payload.tenantId, lp).catch((err) =>
          logger.warn({ err, provider: lp, tenantId: payload.tenantId }, "leads.pull failed"),
        );
      }
      break;
    }
  }
}

/** Convenience helper for routes to enqueue integration sync jobs. */
export { enqueueJob } from "../queue";

// Re-export for tests / introspection.
export async function logConnect(
  tenantId: string,
  provider: ProviderId,
  status: "ok" | "error",
  message: string,
): Promise<void> {
  await recordSync({ tenantId, provider, direction: "connect", status, message });
  await logAudit({
    tenantId,
    kind: status === "ok" ? "integration.connected" : "integration.connect_failed",
    message: `${provider}: ${message}`,
  });
}
