import { and, desc, eq, gte } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
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
import { sendEmail } from "./email";

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
    await sendEmail({
      tenantId: digest.tenant.id,
      template: "compliance_expiry_digest",
      to: recipients.map((r) => ({ email: r.email, name: r.name })),
      subject,
      text,
      html,
      metadata: {
        expiredCount: digest.expiredCount,
        expiringCount: digest.expiringCount,
        windowDays: EXPIRY_WINDOW_DAYS,
      },
    });
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
