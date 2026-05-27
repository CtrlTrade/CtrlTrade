import type { ProviderId, ProviderModule } from "./types";
import { xeroProvider } from "./xero";
import { googleCalendarProvider } from "./google";
import { outlookProvider } from "./outlook";

const ALL: ProviderModule[] = [xeroProvider, googleCalendarProvider, outlookProvider];

export function listProviders(): ProviderModule[] {
  return ALL;
}

export function getProvider(id: string): ProviderModule | null {
  return ALL.find((p) => p.id === id) ?? null;
}

export const PROVIDER_IDS: ProviderId[] = ALL.map((p) => p.id);
