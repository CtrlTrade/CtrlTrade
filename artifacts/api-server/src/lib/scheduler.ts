import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  auditLogsTable,
  tenantsTable,
  verificationSubmissionsTable,
  verificationDocumentsTable,
  certificatesTable,
  usersTable,
  membershipsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { logAudit } from "./audit";
import {
  collectAllTenantDigests,
  getTenantRecipients,
  renderDigestText,
  renderDigestHtml,
  EXPIRY_WINDOW_DAYS,
  type TenantDigest,
} from "./expiryDigest";
import { dispatchNotification } from "./notifications";

const DIGEST_AUDIT_KIND = "compliance.digest_sent";
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

let timer: NodeJS.Timeout | null = null;

async function lastDigestSentForTenant(tenantId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: auditLogsTable.createdAt })
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.tenantId, tenantId), eq(auditLogsTable.kind, DIGEST_AUDIT_KIND)))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

async function anyDigestSentSince(since: Date): Promise<boolean> {
  const [row] = await db
    .select({ id: auditLogsTable.id })
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.kind, DIGEST_AUDIT_KIND), gte(auditLogsTable.createdAt, since)))
    .limit(1);
  return Boolean(row);
}

export interface DigestRunResult {
  tenantsNotified: number;
  tenantsSkipped: number;
  itemsTotal: number;
}

export async function runExpiryDigestOnce(
  now: Date = new Date(),
  opts: { force?: boolean } = {},
): Promise<DigestRunResult> {
  const digests = await collectAllTenantDigests(now);
  let itemsTotal = 0;
  let tenantsNotified = 0;
  let tenantsSkipped = 0;

  for (const digest of digests) {
    itemsTotal += digest.items.length;
    if (!opts.force) {
      const last = await lastDigestSentForTenant(digest.tenant.id);
      if (last && now.getTime() - last.getTime() < ONE_DAY_MS) {
        tenantsSkipped += 1;
        continue;
      }
    }
    const recipients = await getTenantRecipients(digest.tenant.id);
    if (recipients.length === 0) {
      logger.warn(
        { tenantId: digest.tenant.id },
        "Expiry digest skipped — no owner/admin recipients",
      );
      tenantsSkipped += 1;
      continue;
    }
    await sendDigest(digest, recipients);
    tenantsNotified += 1;
  }

  logger.info(
    { tenantsNotified, tenantsSkipped, itemsTotal, windowDays: EXPIRY_WINDOW_DAYS },
    "Expiry digest run complete",
  );
  return { tenantsNotified, tenantsSkipped, itemsTotal };
}

async function sendDigest(
  digest: TenantDigest,
  recipients: Array<{ userId: string; email: string; name: string }>,
): Promise<void> {
  const subject = `Attention required: ${digest.expiredCount} expired, ${digest.expiringCount} expiring (${digest.tenant.name})`;
  const text = renderDigestText(digest);
  const html = renderDigestHtml(digest);
  try {
    for (const r of recipients) {
      await dispatchNotification({
        tenantId: digest.tenant.id,
        eventKind: "compliance_expiry_digest",
        vars: {
          tenantName: digest.tenant.name,
          expiredCount: digest.expiredCount,
          expiringCount: digest.expiringCount,
          summary: text,
        },
        to: { email: r.email, name: r.name },
        subject,
        text,
        html,
        recipientUserIds: [r.userId],
        metadata: {
          expiredCount: digest.expiredCount,
          expiringCount: digest.expiringCount,
          windowDays: EXPIRY_WINDOW_DAYS,
        },
      });
    }
  } catch (err) {
    // sendEmail already recorded the failed delivery; surface it on the audit
    // log too so the tenant can see why no digest arrived today.
    await logAudit({
      tenantId: digest.tenant.id,
      kind: "compliance.digest_failed",
      actorLabel: "scheduler",
      message: `Failed to send compliance digest: ${String(err)}`,
      metadata: { recipients: recipients.map((r) => r.email) },
    });
    return;
  }
  await logAudit({
    tenantId: digest.tenant.id,
    kind: DIGEST_AUDIT_KIND,
    actorLabel: "scheduler",
    message: `Sent compliance digest to ${recipients.length} recipient(s): ${digest.expiredCount} expired, ${digest.expiringCount} expiring`,
    metadata: {
      recipients: recipients.map((r) => r.email),
      expiredCount: digest.expiredCount,
      expiringCount: digest.expiringCount,
    },
  });
}

/**
 * Start the daily scheduler. Runs every hour and triggers the digest if no
 * digest has been sent (audit-log-verified) in the last 24h. Per-tenant
 * idempotency is enforced inside `runExpiryDigestOnce` against the audit log,
 * which means restarts and multi-instance deployments will not produce
 * duplicate sends for the same tenant within a 24h window.
 */
export function startScheduler(): void {
  if (timer) return;
  const tick = async (): Promise<void> => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - ONE_DAY_MS);
      if (await anyDigestSentSince(dayAgo)) return;
      await runExpiryDigestOnce(now);
      await runBadgeExpiryCheck(now);
    } catch (err) {
      logger.error({ err }, "Expiry digest scheduler tick failed");
    }
  };
  void tick();
  timer = setInterval(() => {
    void tick();
  }, ONE_HOUR_MS);
  logger.info("Expiry digest scheduler started (daily, audit-log idempotent)");
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// ============================================================================
// Badge expiry re-check — runs as part of the nightly scheduler tick
// Finds verified tenants whose submitted documents have expired, reverts their
// badge to "Under Review" (new pending submission) and notifies them + admins.
// ============================================================================

export async function runBadgeExpiryCheck(now: Date = new Date()): Promise<void> {
  const verifiedTenants = await db
    .select({ id: tenantsTable.id, name: tenantsTable.name })
    .from(tenantsTable)
    .where(eq(tenantsTable.verifiedBadge, true));

  if (verifiedTenants.length === 0) return;

  for (const tenant of verifiedTenants) {
    const [latestApproved] = await db
      .select()
      .from(verificationSubmissionsTable)
      .where(
        and(
          eq(verificationSubmissionsTable.tenantId, tenant.id),
          eq(verificationSubmissionsTable.status, "approved"),
        ),
      )
      .orderBy(desc(verificationSubmissionsTable.reviewedAt))
      .limit(1);

    if (!latestApproved) continue;

    const docs = await db
      .select({ certId: verificationDocumentsTable.certificateId })
      .from(verificationDocumentsTable)
      .where(eq(verificationDocumentsTable.submissionId, latestApproved.id));

    if (docs.length === 0) continue;

    const certIds = docs.map((d) => d.certId);
    const certRows = await db
      .select({ id: certificatesTable.id, kind: certificatesTable.kind, expiresAt: certificatesTable.expiresAt })
      .from(certificatesTable)
      .where(inArray(certificatesTable.id, certIds));

    const anyExpired = certRows.some((c) => c.expiresAt && c.expiresAt < now);

    if (!anyExpired) continue;

    await db
      .update(tenantsTable)
      .set({ verifiedBadge: false, badgeAwardedAt: null })
      .where(eq(tenantsTable.id, tenant.id));

    const [newSub] = await db
      .insert(verificationSubmissionsTable)
      .values({ tenantId: tenant.id })
      .returning();

    if (certIds.length > 0) {
      await db.insert(verificationDocumentsTable).values(
        certIds.map((certId) => ({ submissionId: newSub.id, certificateId: certId })),
      );
    }

    await logAudit({
      tenantId: tenant.id,
      kind: "compliance.badge_flagged",
      actorLabel: "scheduler",
      message: `Verified badge revoked — submitted document(s) have expired. Tenant placed back Under Review.`,
    });

    const recipients = await db
      .select({ userId: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(membershipsTable)
      .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
      .where(
        and(
          eq(membershipsTable.tenantId, tenant.id),
          inArray(membershipsTable.role, ["owner", "admin"]),
        ),
      );

    for (const r of recipients) {
      await dispatchNotification({
        tenantId: tenant.id,
        eventKind: "compliance.badge_flagged",
        vars: { tenantName: tenant.name },
        to: { email: r.email, name: r.name },
        subject: "Action required: Your CtrlTrade Verified badge needs renewal",
        text: `One or more documents submitted for your CtrlTrade Verified badge have expired. Your badge has been temporarily suspended and your documents have been placed back under review. Please renew the expired documents and resubmit for verification.`,
        html: undefined,
        recipientUserIds: [r.userId],
        metadata: { tenantId: tenant.id },
      });
    }

    logger.info({ tenantId: tenant.id, tenantName: tenant.name }, "Badge flagged — expired document(s)");
  }
}
