import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetCurrentTillSession } from "@workspace/api-client-react";

import { Header } from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function ActionTile({
  label,
  hint,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: primary ? colors.primary : colors.card,
          borderColor: primary ? colors.primary : colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.tileLabel,
          { color: primary ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.tileHint,
          { color: primary ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {hint}
      </Text>
    </Pressable>
  );
}

export default function PosHomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const { mode } = useAuth();
  const posEnabled = modules?.posEnabled ?? false;
  const { data: session, isLoading: sessionLoading } = useGetCurrentTillSession();
  const { pendingCount, isSyncing, triggerSync } = useOfflineSync();

  const isOpen = !!session;
  const takingsPence = session
    ? session.cashSalesPence + session.cardSalesPence + session.tradeSalesPence
    : 0;

  if (modulesLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!posEnabled) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
        <Header title="CTRLTRADEPOS" subtitle="Trade Counter & Warehouse POS" />
        <View style={styles.centered}>
          <Text style={[styles.disabledTitle, { color: colors.foreground }]}>POS NOT ENABLED</Text>
          <Text style={[styles.disabledBody, { color: colors.mutedForeground }]}>
            CtrlTradePos® is not active for this workspace. Add a till licence in your CtrlTrade
            billing settings to start selling.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLocked = mode === "locked";
  const isReadOnly = mode === "read_only";
  const canSell = isOpen && mode === "full";
  const canOpenTill = mode === "full";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <Header title="POINT OF SALE" subtitle="Trade Counter & Warehouse" />

      {pendingCount > 0 && (
        <Pressable
          onPress={() => router.push("/(app)/sales")}
          style={[styles.syncBanner, { backgroundColor: colors.card, borderColor: colors.primary }]}
        >
          <View style={styles.syncRow}>
            <Text style={[styles.syncDot, { color: colors.primary }]}>●</Text>
            <Text style={[styles.syncText, { color: colors.foreground }]}>
              {isSyncing
                ? `SYNCING ${pendingCount} OFFLINE SALE${pendingCount === 1 ? "" : "S"}…`
                : `${pendingCount} OFFLINE SALE${pendingCount === 1 ? "" : "S"} PENDING SYNC`}
            </Text>
            <Text style={[styles.syncAction, { color: colors.primary }]}>VIEW →</Text>
          </View>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {(isLocked || isReadOnly) && (
          <View style={[styles.modeBanner, { backgroundColor: isLocked ? "#ef444418" : "#f59e0b18", borderColor: isLocked ? "#ef4444" : "#f59e0b" }]}>
            <Text style={[styles.modeBannerText, { color: isLocked ? "#ef4444" : "#b45309" }]}>
              {isLocked
                ? "TILL LOCKED — Licence suspended or revoked. Contact your administrator."
                : "READ-ONLY MODE — Licence expired or read-only. New sales are blocked until renewed."}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => !isLocked && router.push("/(app)/till")}
          style={({ pressed }) => [
            styles.statusCard,
            {
              backgroundColor: colors.card,
              borderColor: isLocked ? "#ef4444" : isOpen ? colors.primary : colors.border,
              opacity: pressed && !isLocked ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.statusRow}>
            <Text style={[styles.statusKicker, { color: colors.mutedForeground }]}>TILL SESSION</Text>
            <View style={[styles.dot, { backgroundColor: isLocked ? "#ef4444" : isOpen ? colors.primary : colors.mutedForeground }]} />
          </View>
          {sessionLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : isLocked ? (
            <>
              <Text style={[styles.statusValue, { color: "#ef4444" }]}>LOCKED</Text>
              <Text style={[styles.statusMeta, { color: colors.mutedForeground }]}>
                Licence suspended or revoked — trading not possible
              </Text>
            </>
          ) : isOpen ? (
            <>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>OPEN</Text>
              <Text style={[styles.statusMeta, { color: colors.mutedForeground }]}>
                {session?.locationName ?? "Till"} · Takings {money(takingsPence)}
                {isReadOnly ? " · Read-only" : ""}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.statusValue, { color: colors.foreground }]}>CLOSED</Text>
              <Text style={[styles.statusMeta, { color: colors.mutedForeground }]}>
                {isReadOnly ? "Read-only mode — cannot open new session" : "Open a till session to start selling"}
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.grid}>
          <ActionTile
            label="SELL"
            hint="Catalogue & checkout"
            primary
            disabled={!canSell}
            onPress={() => router.push("/(app)/products")}
          />
          <ActionTile
            label={isOpen ? "MANAGE TILL" : "OPEN TILL"}
            hint={isOpen ? "Session & cash" : "Set opening float"}
            disabled={!canOpenTill && !isOpen}
            onPress={() => router.push("/(app)/till")}
          />
          <ActionTile
            label="SALES LOG"
            hint="Today's transactions"
            onPress={() => router.push("/(app)/sales")}
          />
          <ActionTile
            label="REFUND"
            hint="Returns & credits"
            disabled={!canSell}
            onPress={() => router.push("/(app)/refund")}
          />
          <ActionTile
            label="END OF DAY"
            hint="Close & reconcile"
            disabled={!isOpen}
            onPress={() => router.push("/(app)/till")}
          />
        </View>

        {!isOpen && !isLocked && !isReadOnly && (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            Open a till session to enable selling, refunds and end-of-day reconciliation.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20, gap: 20 },
  modeBanner: { borderWidth: 1, borderRadius: 8, padding: 12 },
  modeBannerText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, lineHeight: 18 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  disabledTitle: { fontFamily: MONO_FONT, fontSize: 18, letterSpacing: 2, fontWeight: "700" },
  disabledBody: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", lineHeight: 20 },
  syncBanner: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncDot: { fontFamily: MONO_FONT, fontSize: 10 },
  syncText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, flex: 1 },
  syncAction: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  statusCard: { borderWidth: 1, borderRadius: 12, padding: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusKicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusValue: { fontFamily: MONO_FONT, fontSize: 28, fontWeight: "700", letterSpacing: 2, marginTop: 10 },
  statusMeta: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { borderWidth: 1, borderRadius: 12, padding: 18, flexGrow: 1, flexBasis: "47%", minHeight: 92, justifyContent: "space-between" },
  tileLabel: { fontFamily: MONO_FONT, fontSize: 15, letterSpacing: 2, fontWeight: "700" },
  tileHint: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, marginTop: 8 },
  note: { fontFamily: MONO_FONT, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
