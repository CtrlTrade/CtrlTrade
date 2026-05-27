import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const colors = useColors();
  const { state, signOut } = useAuth();
  const userLabel = state.status === "signed-in" ? state.session.user.name || state.session.user.email : "";
  const tenantLabel = state.status === "signed-in" ? state.session.tenant.name : "";

  return (
    <View style={[styles.bar, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.left}>
        <Image
          source={require("@/assets/ctrltrade-icon.png")}
          style={[styles.icon, { borderRadius: colors.radius }]}
          resizeMode="contain"
        />
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.right}>
        {right}
        <View style={styles.userBlock}>
          <Text style={[styles.tenant, { color: colors.mutedForeground }]} numberOfLines={1}>
            {tenantLabel}
          </Text>
          <Text style={[styles.user, { color: colors.foreground }]} numberOfLines={1}>
            {userLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => signOut()}
          style={({ pressed }) => [styles.signOut, { borderColor: colors.primary, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.signOutText, { color: colors.primary }]}>SIGN OUT</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  icon: { width: 40, height: 40 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2, opacity: 0.8 },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  userBlock: { alignItems: "flex-end", maxWidth: 180 },
  tenant: { fontFamily: "Inter_400Regular", fontSize: 10, letterSpacing: 0.5 },
  user: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 },
  signOut: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  signOutText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
});
