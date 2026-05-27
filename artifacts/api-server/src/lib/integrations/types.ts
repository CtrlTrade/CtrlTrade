import type { TenantIntegration } from "@workspace/db";

export type ProviderId = "xero" | "google_calendar" | "outlook" | "myjobquote" | "checkatrade";

export type ProviderAuthKind = "oauth" | "apikey";

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
  category: "accounting" | "calendar" | "lead_import";
  authKind: ProviderAuthKind;
  isConfigured(): boolean;
  /** Build authorize URL for the OAuth handshake. Only required for oauth providers. */
  buildAuthUrl?(state: string, redirectUri: string): string;
  /** Exchange the authorization code for access/refresh tokens. Only required for oauth providers. */
  exchangeCode?(code: string, redirectUri: string): Promise<ProviderTokens>;
  /** Refresh an expired access token using the stored refresh token. Only required for oauth providers. */
  refresh?(refreshToken: string): Promise<ProviderTokens>;
  /** Optional: revoke tokens with provider on disconnect (best effort). */
  revoke?(accessToken: string): Promise<void>;
  /** For apikey providers: validate the key is usable. Returns null on success, error message on failure. */
  testApiKey?(apiKey: string): Promise<string | null>;
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
    | "leads.pull"
    | "nightly_reconcile";
  entityId?: string;
  provider?: ProviderId;
}

export interface ExternalLead {
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postcode: string | null;
  description: string | null;
  budgetPence: number;
  postedAt: Date;
}
