import type { ProviderModule, ExternalLead } from "./types";

/**
 * Checkatrade API client.
 *
 * Checkatrade provides a partner API for approved trade members. The endpoints
 * below follow their documented structure. When the official SDK ships, swap
 * the fetch calls for it.
 *
 * Base URL: https://api.checkatrade.com/v1  (verify with Checkatrade partner docs)
 * Auth: Bearer token (API key supplied by the tenant)
 */

const API_BASE = "https://api.checkatrade.com/v1";

async function apiGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Checkatrade API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Map a raw Checkatrade enquiry object to our ExternalLead shape. */
function mapLead(raw: Record<string, unknown>): ExternalLead {
  const budget = Number(
    raw["budget_amount"] ?? raw["budget"] ?? raw["estimated_value"] ?? 0,
  );
  return {
    externalId: String(raw["id"] ?? raw["enquiry_id"] ?? ""),
    name: String(
      raw["consumer_name"] ?? raw["customer_name"] ?? raw["name"] ?? "Unknown",
    ),
    email: raw["email"] ? String(raw["email"]) : null,
    phone: raw["phone"] ?? raw["telephone"]
      ? String(raw["phone"] ?? raw["telephone"])
      : null,
    addressLine1: raw["address_line_1"] ?? raw["address"]
      ? String(raw["address_line_1"] ?? raw["address"])
      : null,
    postcode: raw["postcode"] ? String(raw["postcode"]) : null,
    description: raw["description"] ?? raw["job_description"]
      ? String(raw["description"] ?? raw["job_description"])
      : null,
    budgetPence: Math.round(budget * 100),
    postedAt: raw["created_at"] ?? raw["submitted_at"]
      ? new Date(String(raw["created_at"] ?? raw["submitted_at"]))
      : new Date(),
  };
}

/**
 * Fetch enquiries (leads) since `since`. Returns an empty array when no
 * enquiries are available or the API is unreachable.
 */
export async function fetchCheckatradeLeads(
  apiKey: string,
  since: Date | null,
): Promise<ExternalLead[]> {
  const params = new URLSearchParams();
  if (since) params.set("created_after", since.toISOString());
  params.set("limit", "100");

  const data = await apiGet(apiKey, `/enquiries?${params.toString()}`);
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray((data as Record<string, unknown>)["enquiries"])
      ? ((data as Record<string, unknown>)["enquiries"] as Record<string, unknown>[])
      : Array.isArray((data as Record<string, unknown>)["leads"])
        ? ((data as Record<string, unknown>)["leads"] as Record<string, unknown>[])
        : [];

  return items.map(mapLead).filter((l) => l.externalId);
}

export const checkatradeProvider: ProviderModule = {
  id: "checkatrade",
  label: "Checkatrade",
  description: "Auto-import new enquiries from Checkatrade into your leads pipeline.",
  category: "lead_import",
  authKind: "apikey",

  isConfigured(): boolean {
    return true;
  },

  async testApiKey(apiKey: string): Promise<string | null> {
    try {
      await apiGet(apiKey, "/enquiries?limit=1");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};
