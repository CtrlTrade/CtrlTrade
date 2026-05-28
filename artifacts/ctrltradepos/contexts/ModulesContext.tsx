import React, { createContext, useContext } from "react";
import { useGetTenantModules } from "@workspace/api-client-react";
import type { TenantModules } from "@workspace/api-client-react";

interface ModulesContextValue {
  modules: TenantModules | null;
  isLoading: boolean;
}

const ModulesContext = createContext<ModulesContextValue>({
  modules: null,
  isLoading: true,
});

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useGetTenantModules();

  return (
    <ModulesContext.Provider value={{ modules: data ?? null, isLoading }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules(): ModulesContextValue {
  return useContext(ModulesContext);
}
