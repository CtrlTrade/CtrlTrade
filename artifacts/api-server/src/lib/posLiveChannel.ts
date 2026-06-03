import type { Response } from "express";
import type { PosAuthContext } from "./posAuth";
import { validateLicenceForOpen } from "./posLicence";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// POS live push channel — in-process SSE connection registry.
//
// IMPORTANT (single-instance limitation): this registry lives in the memory of
// THIS Express process only. A till connects to one instance; if the API is
// ever scaled to multiple instances behind a load balancer, a licence mutation
// handled on instance A cannot reach a till connected to instance B, so its
// pushed event would be lost. To support horizontal scaling, replace this
// in-memory registry with a shared pub/sub fan-out (e.g. Postgres LISTEN/NOTIFY
// or Redis) so every instance can deliver the broadcast. The client-side
// polling fallback guarantees convergence regardless, so this push channel is
// purely an additive UX accelerator — never the security boundary (the server
// still re-validates the licence on every mutating request).
// ---------------------------------------------------------------------------

export interface PosLiveConnection {
  res: Response;
  auth: PosAuthContext;
}

/** Connections keyed by licence key (the token's licence binding). */
const byLicence = new Map<string, Set<PosLiveConnection>>();

/** Write a single named SSE event frame to a connection. */
export function sendPosLiveEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Register a live connection for its licence key. Returns an unregister
 * function the route should call on connection close.
 */
export function registerPosLiveConnection(conn: PosLiveConnection): () => void {
  const key = conn.auth.licenceKey;
  if (!key) return () => {};
  let set = byLicence.get(key);
  if (!set) {
    set = new Set();
    byLicence.set(key, set);
  }
  set.add(conn);
  return () => {
    const s = byLicence.get(key);
    if (!s) return;
    s.delete(conn);
    if (s.size === 0) byLicence.delete(key);
  };
}

/** Number of live connections (optionally for a single licence key). */
export function posLiveConnectionCount(licenceKey?: string): number {
  if (licenceKey) return byLicence.get(licenceKey)?.size ?? 0;
  let total = 0;
  for (const s of byLicence.values()) total += s.size;
  return total;
}

/**
 * Broadcast a "licence-change" event to every till bound to a licence key.
 *
 * Each connection's effective mode is re-resolved from the server source of
 * truth (the same `validateLicenceForOpen` used at login and on every mutating
 * request) using that connection's own token binding, so the pushed payload
 * carries the freshly resolved mode for that specific till. Clients still
 * re-fetch `/v1/pos/me` to obtain the full authoritative session.
 */
export async function broadcastLicenceChange(licenceKey: string | null | undefined): Promise<void> {
  if (!licenceKey) return;
  const set = byLicence.get(licenceKey);
  if (!set || set.size === 0) return;
  for (const conn of [...set]) {
    try {
      const { auth } = conn;
      if (!auth.licenceKey || !auth.terminalCode || !auth.surface) {
        sendPosLiveEvent(conn.res, "licence-change", { mode: "locked" });
        continue;
      }
      const outcome = await validateLicenceForOpen({
        tenantId: auth.tenant.id,
        licenceKey: auth.licenceKey,
        terminalCode: auth.terminalCode,
        surface: auth.surface,
      });
      sendPosLiveEvent(conn.res, "licence-change", {
        mode: outcome.mode,
        status: outcome.status,
        message: outcome.message,
      });
    } catch (err) {
      logger.error({ err }, "Failed to push licence-change to a POS live connection");
    }
  }
}
