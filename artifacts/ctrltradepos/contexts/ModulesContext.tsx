import React, { createContext, useContext, useMemo } from "react";
import type { TenantModules } from "@workspace/api-client-react";
import { useAuth } from "./AuthContext";

interface ModulesContextValue {
  modules: TenantModules | null;
  isLoading: boolean;
}

const ModulesContext = createContext<ModulesContextValue>({
  modules: null,
  isLoading: true,
});

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();

  const value = useMemo<ModulesContextValue>(() => {
    // A CtrlTradePos® till authenticates with a licence-key POS token, not a
    // workspace session cookie, so it cannot read GET /v1/tenant/modules
    // (that endpoint requires a tenant session). The POS session payload
    // (/v1/pos/login + /v1/pos/me) already carries the tenant's module flags
    // and is kept fresh by AuthContext's live-sync polling, so we derive the
    // module config from there instead.
    const tenant = state.status === "signed-in" ? state.session.tenant : null;
    if (!tenant) {
      return { modules: null, isLoading: state.status === "loading" };
    }
    const modules: TenantModules = {
      industrySlug: tenant.industrySlug ?? null,
      businessType: tenant.businessType ?? null,
      hasTradeShop: tenant.hasTradeShop,
      hasMobileWorkforce: tenant.hasMobileWorkforce,
      appointmentBookingEnabled: tenant.appointmentBookingEnabled,
      multiBranchEnabled: tenant.multiBranchEnabled,
      vatRegistered: tenant.vatRegistered,
      accountingProvider: tenant.accountingProvider ?? null,
      aiModulesEnabled: tenant.aiModulesEnabled ?? [],
      communicationChannels: tenant.communicationChannels ?? [],
      posEnabled: tenant.posEnabled ?? false,
    };
    return { modules, isLoading: false };
  }, [state]);

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModulesContextValue {
  return useContext(ModulesContext);
}
