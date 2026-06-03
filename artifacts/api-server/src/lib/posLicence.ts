import crypto from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  branchesTable,
  posLicencesTable,
  posTerminalsTable,
  type PosLicence,
  type PosTerminal,
} from "@workspace/db";
import { PRICING } from "./pricing";

export const LICENCE_STATUSES = [
  "active",
  "trial",
  "suspended",
  "expired",
  "revoked",
  "read_only",
] as const;

export const TERMINAL_MODES = ["trade_counter", "showroom", "warehouse"] as const;
export const LICENCE_TYPES = ["web", "desktop", "hybrid"] as const;

const TILL_PRICE_PENCE = PRICING.till.unitAmount;
const CURRENCY = "gbp";

// Statuses that count as a billable, live till.
const BILLABLE_STATUSES = new Set(["active", "trial", "read_only"]);

/** Generate a human-readable, unique licence key like CTP-7K2F-9QX4-M1A8. */
export function generateLicenceKey(): string {
  const block = () =>
    crypto.randomBytes(3).toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4).padEnd(4, "0");
  return `CTP-${block()}-${block()}-${block()}`;
}

/** Auto-allocate the next terminal code (POS-001, POS-002, …) for a tenant. */
export async function nextTerminalCode(tenantId: string): Promise<string> {
  const rows = await db
    .select({ code: posTerminalsTable.terminalCode })
    .from(posTerminalsTable)
    .where(eq(posTerminalsTable.tenantId, tenantId));
  let max = 0;
  for (const r of rows) {
    const m = /^POS-(\d+)$/.exec(r.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `POS-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Compute the *effective* status of a licence, accounting for elapsed trial /
 * expiry dates without mutating the row. Stored status wins when it is a manual
 * override (suspended / revoked / read_only).
 */
export function effectiveStatus(l: PosLicence, now = new Date()): (typeof LICENCE_STATUSES)[number] {
  const s = l.status as (typeof LICENCE_STATUSES)[number];
  if (s === "revoked" || s === "suspended" || s === "read_only") return s;
  if (s === "trial" && l.trialEndsAt && l.trialEndsAt.getTime() < now.getTime()) return "expired";
  if (l.expiresAt && l.expiresAt.getTime() < now.getTime()) return "expired";
  return s;
}

/** Map an effective status to the till operating mode. */
export function statusToMode(status: (typeof LICENCE_STATUSES)[number]): "full" | "read_only" | "locked" {
  if (status === "active" || status === "trial") return "full";
  if (status === "read_only" || status === "expired") return "read_only";
  return "locked"; // suspended | revoked
}

export function serializeTerminal(t: PosTerminal, branchName?: string | null) {
  return {
    id: t.id,
    tenantId: t.tenantId,
    branchId: t.branchId,
    branchName: branchName ?? null,
    licenceId: t.licenceId,
    terminalCode: t.terminalCode,
    name: t.name,
    mode: t.mode,
    status: t.status,
    registeredAt: t.registeredAt ? t.registeredAt.toISOString() : null,
    lastSeenAt: t.lastSeenAt ? t.lastSeenAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  };
}

export function serializeLicence(
  l: PosLicence,
  branchName: string | null,
  terminals: ReturnType<typeof serializeTerminal>[],
) {
  return {
    id: l.id,
    tenantId: l.tenantId,
    branchId: l.branchId,
    branchName,
    licenceKey: l.licenceKey,
    type: l.type,
    status: effectiveStatus(l),
    trialEndsAt: l.trialEndsAt ? l.trialEndsAt.toISOString() : null,
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
    lastCheckAt: l.lastCheckAt ? l.lastCheckAt.toISOString() : null,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
    terminals,
  };
}

/** Build the full licence-list payload (licences + terminals + billing) for a tenant. */
export async function loadLicenceList(tenantId: string) {
  const [licences, terminals, branches] = await Promise.all([
    db
      .select()
      .from(posLicencesTable)
      .where(eq(posLicencesTable.tenantId, tenantId))
      .orderBy(asc(posLicencesTable.createdAt)),
    db
      .select()
      .from(posTerminalsTable)
      .where(eq(posTerminalsTable.tenantId, tenantId))
      .orderBy(asc(posTerminalsTable.terminalCode)),
    db.select().from(branchesTable).where(eq(branchesTable.tenantId, tenantId)),
  ]);

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const termsByLicence = new Map<string | null, PosTerminal[]>();
  for (const t of terminals) {
    const key = t.licenceId;
    const list = termsByLicence.get(key) ?? [];
    list.push(t);
    termsByLicence.set(key, list);
  }

  const serialised = licences.map((l) =>
    serializeLicence(
      l,
      l.branchId ? branchName.get(l.branchId) ?? null : null,
      (termsByLicence.get(l.id) ?? []).map((t) => serializeTerminal(t, t.branchId ? branchName.get(t.branchId) : null)),
    ),
  );

  const billableTills = licences.filter((l) => BILLABLE_STATUSES.has(effectiveStatus(l))).length;

  return {
    licences: serialised,
    monthlyTotalPence: billableTills * TILL_PRICE_PENCE,
    pricePerTillPence: TILL_PRICE_PENCE,
    currency: CURRENCY,
  };
}

export interface ValidationOutcome {
  valid: boolean;
  status: string;
  mode: "full" | "read_only" | "locked";
  message: string | null;
  licence: ReturnType<typeof serializeLicence> | null;
  terminal: ReturnType<typeof serializeTerminal> | null;
}

/**
 * Validate a licence key for a till open within a tenant. Records the
 * last-check timestamp and bumps the terminal's last-seen when matched.
 */
export async function validateLicenceForOpen(opts: {
  tenantId: string;
  licenceKey: string;
  terminalCode?: string | null;
  surface?: "web" | "desktop";
}): Promise<ValidationOutcome> {
  const [licence] = await db
    .select()
    .from(posLicencesTable)
    .where(and(eq(posLicencesTable.tenantId, opts.tenantId), eq(posLicencesTable.licenceKey, opts.licenceKey)));

  if (!licence) {
    return { valid: false, status: "unknown", mode: "locked", message: "Licence key not recognised for this business.", licence: null, terminal: null };
  }

  const status = effectiveStatus(licence);
  const mode = statusToMode(status);

  // Surface gate: a web-only licence cannot activate a desktop till and vice versa.
  if (opts.surface === "desktop" && licence.type === "web") {
    return { valid: false, status, mode: "locked", message: "This licence is for the Web POS only.", licence: serializeLicence(licence, null, []), terminal: null };
  }
  if (opts.surface === "web" && licence.type === "desktop") {
    return { valid: false, status, mode: "locked", message: "This licence is for the Desktop POS only.", licence: serializeLicence(licence, null, []), terminal: null };
  }

  const now = new Date();
  await db.update(posLicencesTable).set({ lastCheckAt: now }).where(eq(posLicencesTable.id, licence.id));

  let terminal: PosTerminal | undefined;
  if (opts.terminalCode) {
    [terminal] = await db
      .select()
      .from(posTerminalsTable)
      .where(and(eq(posTerminalsTable.tenantId, opts.tenantId), eq(posTerminalsTable.terminalCode, opts.terminalCode)));
    if (terminal) {
      await db.update(posTerminalsTable).set({ lastSeenAt: now }).where(eq(posTerminalsTable.id, terminal.id));
    }
  }

  const valid = mode === "full";
  const message =
    mode === "full"
      ? null
      : mode === "read_only"
        ? status === "expired"
          ? "This till licence has expired. The till is in read-only mode until renewed."
          : "This till is in read-only mode."
        : status === "suspended"
          ? "This till has been suspended. Contact CtrlTrade support."
          : "This licence has been revoked.";

  return {
    valid,
    status,
    mode,
    message,
    licence: serializeLicence({ ...licence, lastCheckAt: now }, null, []),
    terminal: terminal ? serializeTerminal(terminal) : null,
  };
}
