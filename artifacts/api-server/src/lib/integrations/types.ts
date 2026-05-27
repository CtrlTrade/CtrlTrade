import type { TenantIntegration } from "@workspace/db";

export type ProviderId = "xero" | "google_calendar" | "outlook";

export interface ProviderTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  externalAccountId: string | null;
  externalAccountLabel: string | null;
  scopes: string;
}

export interface ProviderModule {
  id: ProviderId;
  label: string;
  description: string;
  category: "accounting" | "calendar";
  isConfigured(): boolean;
  /** Build authorize URL for the OAuth handshake. */
  buildAuthUrl(state: string, redirectUri: string): string;
  /** Exchange the authorization code for access/refresh tokens. */
  exchangeCode(code: string, redirectUri: string): Promise<ProviderTokens>;
  /** Refresh an expired access token using the stored refresh token. */
  refresh(refreshToken: string): Promise<ProviderTokens>;
  /** Optional: revoke tokens with provider on disconnect (best effort). */
  revoke?(accessToken: string): Promise<void>;
}

export interface DispatchPayload {
  tenantId?: string;
  kind:
    | "invoice.upsert"
    | "invoice.payment_pull"
    | "customer.upsert"
    | "job.upsert"
    | "job.delete"
    | "calendar.pull"
    | "nightly_reconcile";
  entityId?: string;
  provider?: ProviderId;
}
