import type { Request, Response, NextFunction } from "express";
import { recordUsage } from "../lib/usage";

/**
 * Lightweight per-tenant API usage meter. Counts a single "api_call" usage
 * event for each authenticated request that resolves to a tenant context.
 *
 * - Skips unauthenticated requests and super-admin tools.
 * - Skips read-only health/internal endpoints to keep counts meaningful.
 * - Fires fire-and-forget on response finish so request latency is unchanged.
 */
export function meterApiUsage(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    try {
      const tenantId = req.auth?.tenant?.id;
      if (!tenantId) return;
      // Don't meter the usage endpoints themselves (would create amplification).
      const url = req.url ?? "";
      if (url.startsWith("/v1/usage") || url.startsWith("/v1/admin")) return;
      void recordUsage(tenantId, "api_call", 1, { path: url.split("?")[0], status: res.statusCode });
    } catch {
      // never let metering break a request
    }
  });
  next();
}
