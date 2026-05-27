import type { ProviderModule, ProviderTokens } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/calendar", "openid", "email", "profile"].join(" ");

function clientId(): string | null {
  return process.env["GOOGLE_CLIENT_ID"] ?? null;
}
function clientSecret(): string | null {
  return process.env["GOOGLE_CLIENT_SECRET"] ?? null;
}

export const googleCalendarProvider: ProviderModule = {
  id: "google_calendar",
  label: "Google Calendar",
  description: "Two-way calendar sync — scheduled jobs flow to and from your Google calendar.",
  category: "calendar",

  isConfigured(): boolean {
    return Boolean(clientId() && clientSecret());
  },

  buildAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId() ?? "",
      redirect_uri: redirectUri,
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code, redirectUri): Promise<ProviderTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId() ?? "",
      client_secret: clientSecret() ?? "",
      redirect_uri: redirectUri,
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    // Resolve user email for label.
    const who = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const email = (who as { email?: string } | null)?.email ?? null;
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId() ?? "",
      client_secret: clientSecret() ?? "",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Google refresh failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
    return {
      accessToken: json.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
      externalAccountId: null,
      externalAccountLabel: null,
      scopes: json.scope ?? SCOPES,
    };
  },

  async revoke(accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: "POST",
      });
    } catch {
      // best-effort
    }
  },
};

/** Upsert a calendar event for a job. Returns the Google event id. */
export async function googleUpsertEvent(args: {
  accessToken: string;
  calendarId: string;
  eventId: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
}): Promise<{ eventId: string }> {
  const calId = encodeURIComponent(args.calendarId || "primary");
  const body = {
    summary: args.summary,
    description: args.description ?? undefined,
    location: args.location ?? undefined,
    start: { dateTime: args.start.toISOString() },
    end: { dateTime: (args.end ?? new Date(args.start.getTime() + 60 * 60 * 1000)).toISOString() },
  };
  const url = args.eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(args.eventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;
  const res = await fetch(url, {
    method: args.eventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google event upsert failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return { eventId: json.id };
}

export async function googleDeleteEvent(args: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const calId = encodeURIComponent(args.calendarId || "primary");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(args.eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${args.accessToken}` } },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google event delete failed: ${res.status}`);
  }
}

export interface CalendarChange {
  eventId: string;
  start?: Date;
  end?: Date;
  deleted: boolean;
}

/**
 * Pull incremental changes from Google Calendar using sync tokens.
 * Pass `syncToken: null` on the first call to establish a baseline token
 * (events older than 90 days are not returned; only the final sync token matters).
 * Returns `nextSyncToken: null` when the token was invalidated (HTTP 410) —
 * the caller should discard the stored token and retry to get a fresh one.
 */
export async function googlePullCalendarChanges(args: {
  accessToken: string;
  calendarId: string;
  syncToken: string | null;
}): Promise<{ changes: CalendarChange[]; nextSyncToken: string | null }> {
  const calId = encodeURIComponent(args.calendarId || "primary");
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;

  type GoogleEvent = {
    id: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };
  type ListResponse = {
    items?: GoogleEvent[];
    nextPageToken?: string;
    nextSyncToken?: string;
  };

  const changes: CalendarChange[] = [];
  let nextSyncToken: string | null = null;
  let pageToken: string | undefined;

  let firstUrl: string;
  if (args.syncToken) {
    firstUrl = `${base}?syncToken=${encodeURIComponent(args.syncToken)}&showDeleted=true`;
  } else {
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    firstUrl = `${base}?timeMin=${encodeURIComponent(timeMin)}&showDeleted=true`;
  }

  let currentUrl = firstUrl;

  do {
    const url = pageToken ? `${firstUrl.split("&pageToken=")[0]}&pageToken=${encodeURIComponent(pageToken)}` : currentUrl;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${args.accessToken}` } });

    if (res.status === 410) {
      return { changes: [], nextSyncToken: null };
    }
    if (!res.ok) throw new Error(`Google calendar list failed: ${res.status} ${await res.text()}`);

    const json = (await res.json()) as ListResponse;

    for (const item of json.items ?? []) {
      const deleted = item.status === "cancelled";
      const start = item.start?.dateTime
        ? new Date(item.start.dateTime)
        : item.start?.date
          ? new Date(item.start.date)
          : undefined;
      const end = item.end?.dateTime
        ? new Date(item.end.dateTime)
        : item.end?.date
          ? new Date(item.end.date)
          : undefined;
      changes.push({ eventId: item.id, start, end, deleted });
    }

    pageToken = json.nextPageToken;
    if (json.nextSyncToken) nextSyncToken = json.nextSyncToken;
  } while (pageToken);

  return { changes, nextSyncToken };
}
