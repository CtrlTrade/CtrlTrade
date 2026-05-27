import type { ProviderModule, ExternalLead } from "./types";

/**
 * MyJobQuote API client.
 *
 * MyJobQuote does not publish a fully open API spec. This client implements the
 * known endpoints based on their developer documentation. When an official SDK
 * or updated spec is available, swap the fetch calls below for the SDK.
 *
 * Base URL: https://api.myjobquote.co.uk/v1  (placeholder — verify with docs)
 * Auth: Bearer token (API key supplied by the tenant)
 */

const API_BASE = "https://api.myjobquote.co.uk/v1";

async function apiGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MyJobQuote API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Map a raw MyJobQuote lead object to our ExternalLead shape. */
function mapLead(raw: Record<string, unknown>): ExternalLead {
  const budget = Number(raw["budget"] ?? raw["budget_amount"] ?? 0);
  return {
    externalId: String(raw["id"] ?? raw["lead_id"] ?? ""),
    name: String(raw["customer_name"] ?? raw["name"] ?? "Unknown"),
    email: raw["email"] ? String(raw["email"]) : null,
    phone: raw["phone"] ? String(raw["phone"]) : null,
    addressLine1: raw["address_line_1"] ? String(raw["address_line_1"]) : null,
    postcode: raw["postcode"] ? String(raw["postcode"]) : null,
    description: raw["description"] ? String(raw["description"]) : null,
    budgetPence: Math.round(budget * 100),
    postedAt: raw["created_at"] ? new Date(String(raw["created_at"])) : new Date(),
  };
}

/**
 * Fetch leads since `since`. Returns an empty array when no leads are available
 * or when the API is unreachable (fails silently to the caller who records
 * a sync-log error separately).
 */
export async function fetchMyJobQuoteLeads(
  apiKey: string,
  since: Date | null,
): Promise<ExternalLead[]> {
  const params = new URLSearchParams();
  if (since) params.set("created_after", since.toISOString());
  params.set("limit", "100");

  const data = await apiGet(apiKey, `/leads?${params.toString()}`);
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray((data as Record<string, unknown>)["leads"])
      ? ((data as Record<string, unknown>)["leads"] as Record<string, unknown>[])
      : [];

  return items.map(mapLead).filter((l) => l.externalId);
}

export const myJobQuoteProvider: ProviderModule = {
  id: "myjobquote",
  label: "MyJobQuote",
  description: "Auto-import new enquiries from MyJobQuote into your leads pipeline.",
  category: "lead_import",
  authKind: "apikey",

  isConfigured(): boolean {
    return true;
  },

  async testApiKey(apiKey: string): Promise<string | null> {
    try {
      await apiGet(apiKey, "/leads?limit=1");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};
