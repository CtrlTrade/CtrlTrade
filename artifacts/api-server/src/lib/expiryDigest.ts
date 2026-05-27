import { and, eq, lte, isNotNull } from "drizzle-orm";
import {
  db,
  certificatesTable,
  vehiclesTable,
  tenantsTable,
  membershipsTable,
  usersTable,
  type Tenant,
  type Certificate,
  type Vehicle,
} from "@workspace/db";
import { getAppBaseUrl } from "./email";

export const EXPIRY_WINDOW_DAYS = 30;

export type ExpiryItemKind =
  | "certificate"
  | "vehicle_mot"
  | "vehicle_tax"
  | "vehicle_service";

export interface ExpiryItem {
  kind: ExpiryItemKind;
  label: string;
  reference: string | null;
  expiresAt: string;
  daysUntil: number;
  expired: boolean;
  recordId: string;
  href: string;
}

export interface TenantDigest {
  tenant: Tenant;
  items: ExpiryItem[];
  expiredCount: number;
  expiringCount: number;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function certificateLabel(c: Certificate): string {
  const holder = c.holderLabel?.trim() || "Unassigned";
  return `${c.kind} — ${holder}`;
}

function vehicleLabel(v: Vehicle): string {
  return `${v.registration} (${v.label})`;
}

export async function collectTenantExpiries(
  tenantId: string,
  now: Date = new Date(),
  windowDays: number = EXPIRY_WINDOW_DAYS,
): Promise<ExpiryItem[]> {
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const certs = await db
    .select()
    .from(certificatesTable)
    .where(
      and(
        eq(certificatesTable.tenantId, tenantId),
        isNotNull(certificatesTable.expiresAt),
        lte(certificatesTable.expiresAt, horizon),
      ),
    );

  const vehicles = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.tenantId, tenantId));

  const items: ExpiryItem[] = [];

  for (const c of certs) {
    if (!c.expiresAt) continue;
    const days = daysBetween(now, c.expiresAt);
    items.push({
      kind: "certificate",
      label: certificateLabel(c),
      reference: c.reference,
      expiresAt: c.expiresAt.toISOString(),
      daysUntil: days,
      expired: days < 0,
      recordId: c.id,
      href: "/app/compliance",
    });
  }

  for (const v of vehicles) {
    const checks: Array<[ExpiryItemKind, Date | null, string]> = [
      ["vehicle_mot", v.motDueAt, "MOT"],
      ["vehicle_tax", v.taxDueAt, "Tax"],
      ["vehicle_service", v.serviceDueAt, "Service"],
    ];
    for (const [kind, due, suffix] of checks) {
      if (!due) continue;
      if (due > horizon) continue;
      const days = daysBetween(now, due);
      items.push({
        kind,
        label: `${vehicleLabel(v)} — ${suffix}`,
        reference: null,
        expiresAt: due.toISOString(),
        daysUntil: days,
        expired: days < 0,
        recordId: v.id,
        href: "/app/fleet",
      });
    }
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return items;
}

export async function collectAllTenantDigests(
  now: Date = new Date(),
  windowDays: number = EXPIRY_WINDOW_DAYS,
): Promise<TenantDigest[]> {
  const tenants = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.status, "active"));

  // Also include trial tenants — they still have crews on the road.
  const trialTenants = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.status, "trial"));

  const all = [...tenants, ...trialTenants];
  const digests: TenantDigest[] = [];
  for (const t of all) {
    const items = await collectTenantExpiries(t.id, now, windowDays);
    if (items.length === 0) continue;
    const expiredCount = items.filter((i) => i.expired).length;
    digests.push({
      tenant: t,
      items,
      expiredCount,
      expiringCount: items.length - expiredCount,
    });
  }
  return digests;
}

export async function getTenantRecipients(
  tenantId: string,
): Promise<Array<{ userId: string; email: string; name: string }>> {
  const rows = await db
    .select({
      userId: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: membershipsTable.role,
    })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(eq(membershipsTable.tenantId, tenantId));
  return rows
    .filter((r) => r.role === "owner" || r.role === "admin")
    .map((r) => ({ userId: r.userId, email: r.email, name: r.name }));
}

export function renderDigestText(digest: TenantDigest): string {
  const lines: string[] = [];
  lines.push(`Compliance & fleet attention required for ${digest.tenant.name}`);
  lines.push("");
  if (digest.expiredCount > 0) {
    lines.push(`${digest.expiredCount} item(s) already expired:`);
    for (const i of digest.items.filter((x) => x.expired)) {
      const ref = i.reference ? ` [${i.reference}]` : "";
      lines.push(
        `  - ${i.label}${ref} — expired ${Math.abs(i.daysUntil)} day(s) ago (${new Date(i.expiresAt).toDateString()})`,
      );
    }
    lines.push("");
  }
  const upcoming = digest.items.filter((x) => !x.expired);
  if (upcoming.length > 0) {
    lines.push(`${upcoming.length} item(s) expiring within ${EXPIRY_WINDOW_DAYS} days:`);
    for (const i of upcoming) {
      const ref = i.reference ? ` [${i.reference}]` : "";
      lines.push(
        `  - ${i.label}${ref} — due in ${i.daysUntil} day(s) (${new Date(i.expiresAt).toDateString()})`,
      );
    }
    lines.push("");
  }
  lines.push("Open CtrlTrade to review and renew these items.");
  return lines.join("\n");
}

export function renderDigestHtml(digest: TenantDigest): string {
  const base = getAppBaseUrl();
  const abs = (path: string) => (base ? `${base}${path}` : path);
  const row = (i: ExpiryItem) => {
    const when = new Date(i.expiresAt).toDateString();
    const status = i.expired
      ? `<span style="color:#b00020;font-weight:bold">Expired ${Math.abs(i.daysUntil)}d ago</span>`
      : `Due in ${i.daysUntil}d`;
    const ref = i.reference ? ` <small style="color:#666">[${i.reference}]</small>` : "";
    const link = abs(i.href);
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee"><a href="${link}" style="color:#111">${i.label}</a>${ref}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${when}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${status}</td></tr>`;
  };
  return `
    <div style="font-family:system-ui,sans-serif;color:#111">
      <h2 style="text-transform:uppercase;letter-spacing:-0.02em">Attention required — ${digest.tenant.name}</h2>
      <p>${digest.expiredCount} expired · ${digest.expiringCount} expiring within ${EXPIRY_WINDOW_DAYS} days.</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th align="left" style="padding:6px 12px;border-bottom:2px solid #111">Item</th><th align="left" style="padding:6px 12px;border-bottom:2px solid #111">Date</th><th align="left" style="padding:6px 12px;border-bottom:2px solid #111">Status</th></tr></thead>
        <tbody>${digest.items.map(row).join("")}</tbody>
      </table>
      <p style="margin-top:16px"><a href="${abs("/app")}">Open CtrlTrade</a> to review and renew.</p>
    </div>
  `;
}
