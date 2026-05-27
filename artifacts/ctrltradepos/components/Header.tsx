import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const colors = useColors();
  const { state, signOut } = useAuth();
  const userLabel = state.status === "signed-in" ? state.session.user.name || state.session.user.email : "";
  const tenantLabel = state.status === "signed-in" ? state.session.tenant.name : "";

  return (
    <View style={[styles.bar, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.left}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Text style={[styles.markText, { color: colors.primaryForeground }]}>CT</Text>
        </View>
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
          style={({ pressed }) => [styles.signOut, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.signOutText, { color: colors.foreground }]}>SIGN OUT</Text>
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
  mark: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  markText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 14, letterSpacing: 1 },
  title: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700", letterSpacing: 2 },
  subtitle: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  userBlock: { alignItems: "flex-end", maxWidth: 180 },
  tenant: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 1 },
  user: { fontFamily: MONO_FONT, fontSize: 13, marginTop: 2 },
  signOut: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  signOutText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
});
