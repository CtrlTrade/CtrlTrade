import type { ProviderModule, ProviderTokens } from "./types";

const AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const SCOPES = [
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings.read",
].join(" ");

function clientId(): string | null {
  return process.env["XERO_CLIENT_ID"] ?? null;
}
function clientSecret(): string | null {
  return process.env["XERO_CLIENT_SECRET"] ?? null;
}

function basicAuth(): string {
  const id = clientId() ?? "";
  const secret = clientSecret() ?? "";
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

async function fetchConnectionInfo(accessToken: string): Promise<{ id: string | null; name: string | null }> {
  try {
    const res = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { id: null, name: null };
    const list = (await res.json()) as Array<{ tenantId: string; tenantName?: string }>;
    const first = Array.isArray(list) ? list[0] : null;
    return { id: first?.tenantId ?? null, name: first?.tenantName ?? null };
  } catch {
    return { id: null, name: null };
  }
}

export const xeroProvider: ProviderModule = {
  id: "xero",
  label: "Xero",
  description: "Two-way accounting sync — push invoices and contacts, pull payment status.",
  category: "accounting",
  authKind: "oauth",

  isConfigured(): boolean {
    return Boolean(clientId() && clientSecret());
  },

  buildAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId() ?? "",
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code, redirectUri): Promise<ProviderTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Xero token exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };
    const info = await fetchConnectionInfo(json.access_token);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
      externalAccountId: info.id,
      externalAccountLabel: info.name,
      scopes: json.scope ?? SCOPES,
    };
  },

  async refresh(refreshToken): Promise<ProviderTokens> {
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Xero refresh failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
      externalAccountId: null,
      externalAccountLabel: null,
      scopes: json.scope ?? SCOPES,
    };
  },
};

/** Push an invoice to Xero. Returns the Xero invoice id. */
export async function xeroPushInvoice(args: {
  accessToken: string;
  xeroTenantId: string;
  contactName: string;
  contactEmail: string | null;
  invoice: {
    number: string;
    title: string;
    totalPence: number;
    subtotalPence: number;
    taxPence: number;
    currency: string;
    dueAt: Date | null;
    items: Array<{ description: string; quantity: number; unitPricePence: number }>;
  };
}): Promise<{ xeroInvoiceId: string | null; status: string }> {
  const payload = {
    Type: "ACCREC",
    Contact: { Name: args.contactName, EmailAddress: args.contactEmail ?? undefined },
    Date: new Date().toISOString().slice(0, 10),
    DueDate: (args.invoice.dueAt ?? new Date()).toISOString().slice(0, 10),
    InvoiceNumber: args.invoice.number,
    Reference: args.invoice.title,
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    CurrencyCode: args.invoice.currency.toUpperCase(),
    LineItems: args.invoice.items.map((i) => ({
      Description: i.description,
      Quantity: i.quantity,
      UnitAmount: i.unitPricePence / 100,
    })),
  };
  const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Xero-tenant-id": args.xeroTenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Xero invoice push failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { Invoices?: Array<{ InvoiceID: string; Status: string }> };
  const inv = json.Invoices?.[0];
  return { xeroInvoiceId: inv?.InvoiceID ?? null, status: inv?.Status ?? "AUTHORISED" };
}

/** Push a contact (customer) to Xero. */
export async function xeroPushContact(args: {
  accessToken: string;
  xeroTenantId: string;
  customer: { name: string; email: string | null; phone: string | null };
}): Promise<{ xeroContactId: string | null }> {
  const payload = {
    Name: args.customer.name,
    EmailAddress: args.customer.email ?? undefined,
    Phones: args.customer.phone
      ? [{ PhoneType: "DEFAULT", PhoneNumber: args.customer.phone }]
      : undefined,
  };
  const res = await fetch("https://api.xero.com/api.xro/2.0/Contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Xero-tenant-id": args.xeroTenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Xero contact push failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { Contacts?: Array<{ ContactID: string }> };
  return { xeroContactId: json.Contacts?.[0]?.ContactID ?? null };
}

/** Pull payment status for a given Xero invoice number. */
export async function xeroPullInvoiceStatus(args: {
  accessToken: string;
  xeroTenantId: string;
  invoiceNumber: string;
}): Promise<{ status: string; amountPaid: number } | null> {
  const url = `https://api.xero.com/api.xro/2.0/Invoices?InvoiceNumbers=${encodeURIComponent(args.invoiceNumber)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Xero-tenant-id": args.xeroTenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    Invoices?: Array<{ Status: string; AmountPaid: number }>;
  };
  const inv = json.Invoices?.[0];
  if (!inv) return null;
  return { status: inv.Status, amountPaid: Math.round((inv.AmountPaid ?? 0) * 100) };
}
