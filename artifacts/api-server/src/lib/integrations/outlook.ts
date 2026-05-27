import type { ProviderModule, ProviderTokens } from "./types";

const TENANT = "common";
const AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const SCOPES = ["offline_access", "openid", "email", "profile", "Calendars.ReadWrite"].join(" ");

function clientId(): string | null {
  return process.env["MICROSOFT_CLIENT_ID"] ?? null;
}
function clientSecret(): string | null {
  return process.env["MICROSOFT_CLIENT_SECRET"] ?? null;
}

export const outlookProvider: ProviderModule = {
  id: "outlook",
  label: "Outlook (Microsoft 365)",
  description: "Two-way calendar sync with Outlook via Microsoft Graph.",
  category: "calendar",

  isConfigured(): boolean {
    return Boolean(clientId() && clientSecret());
  },

  buildAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: clientId() ?? "",
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code, redirectUri): Promise<ProviderTokens> {
    const body = new URLSearchParams({
      client_id: clientId() ?? "",
      client_secret: clientSecret() ?? "",
      scope: SCOPES,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Outlook token exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    const who = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const email =
      (who as { mail?: string; userPrincipalName?: string } | null)?.mail ??
      (who as { userPrincipalName?: string } | null)?.userPrincipalName ??
      null;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
      externalAccountId: "primary",
      externalAccountLabel: email,
      scopes: json.scope ?? SCOPES,
    };
  },

  async refresh(refreshToken): Promise<ProviderTokens> {
    const body = new URLSearchParams({
      client_id: clientId() ?? "",
      client_secret: clientSecret() ?? "",
      scope: SCOPES,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Outlook refresh failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
      externalAccountId: null,
      externalAccountLabel: null,
      scopes: json.scope ?? SCOPES,
    };
  },
};

export async function outlookUpsertEvent(args: {
  accessToken: string;
  eventId: string | null;
  subject: string;
  body: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
}): Promise<{ eventId: string }> {
  const payload = {
    subject: args.subject,
    body: args.body ? { contentType: "Text", content: args.body } : undefined,
    location: args.location ? { displayName: args.location } : undefined,
    start: { dateTime: args.start.toISOString(), timeZone: "UTC" },
    end: {
      dateTime: (args.end ?? new Date(args.start.getTime() + 60 * 60 * 1000)).toISOString(),
      timeZone: "UTC",
    },
  };
  const url = args.eventId
    ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(args.eventId)}`
    : `https://graph.microsoft.com/v1.0/me/events`;
  const res = await fetch(url, {
    method: args.eventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Outlook event upsert failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return { eventId: json.id };
}

export async function outlookDeleteEvent(args: { accessToken: string; eventId: string }): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(args.eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Outlook event delete failed: ${res.status}`);
  }
}
