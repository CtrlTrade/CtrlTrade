import { useColorScheme } from "react-native";
import { useGetPosBranding, getGetPosBrandingQueryKey } from "@workspace/api-client-react";

import colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  const { state } = useAuth();
  const enabled = state.status === "signed-in";
  const { data: branding } = useGetPosBranding({
    query: { enabled, staleTime: 60_000, queryKey: getGetPosBrandingQueryKey() },
  });
  return {
    ...palette,
    radius: colors.radius,
    background: branding?.surfaceColor ?? palette.background,
    tint: branding?.primaryColor ?? palette.tint,
    primary: branding?.primaryColor ?? palette.tint,
    accent: branding?.accentColor ?? palette.tint,
    brandTemplates: branding?.brandTemplates ?? null,
    logoUrl: branding?.logoPosUrl ?? branding?.logoUrl ?? null,
  };
}
