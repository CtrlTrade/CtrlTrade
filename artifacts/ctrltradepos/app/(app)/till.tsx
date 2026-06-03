import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentTillSession,
  useOpenTillSession,
  useCloseTillSession,
  useListPosStockLocations,
  getGetCurrentTillSessionQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";
import { useAuth } from "@/contexts/AuthContext";

export default function TillScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const { mode } = useAuth();
  const qc = useQueryClient();
  const { data: session, isLoading } = useGetCurrentTillSession();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);
  const { data: locations } = useListPosStockLocations();
  const [float, setFloat] = useState("100.00");
  const [counted, setCounted] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useOpenTillSession({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCurrentTillSessionQueryKey() }); router.replace("/(app)/products" as any); },
      onError: (e: Error) => setError(e.message),
    },
  });
  const close = useCloseTillSession({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetCurrentTillSessionQueryKey() }); router.replace("/(app)/eod-report" as any); },
      onError: (e: Error) => setError(e.message),
    },
  });

  if (isLoading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;

  const isOpen = !!session;
  const activeLocId = locationId ?? locations?.find((l) => l.isDefault)?.id ?? locations?.[0]?.id;
  const isLocked = mode === "locked";
  const isReadOnly = mode === "read_only";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleBar}>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TILL SESSION</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{isOpen ? "OPEN" : "CLOSED"}</Text>
        </View>

        {(isLocked || isReadOnly) && (
          <View style={[styles.modeBanner, { backgroundColor: isLocked ? colors.destructive + "18" : "#f59e0b18", borderColor: isLocked ? colors.destructive : "#f59e0b" }]}>
            <Text style={[styles.modeBannerText, { color: isLocked ? colors.destructive : "#b45309" }]}>
              {isLocked
                ? "TILL LOCKED — This licence has been suspended or revoked. Contact your administrator."
                : "READ-ONLY MODE — This licence has expired or is in read-only mode. New sales are blocked until renewed."}
            </Text>
          </View>
        )}

        {isOpen ? (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CURRENT SESSION</Text>
            <Row label="Location" value={session.locationName ?? "—"} colors={colors} />
            <Row label="Opened" value={new Date(session.openedAt).toLocaleString()} colors={colors} />
            <Row label="Opening float" value={`£${(session.openingFloatPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Cash sales" value={`£${(session.cashSalesPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Card sales" value={`£${(session.cardSalesPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Trade sales" value={`£${(session.tradeSalesPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Refunds" value={`£${(session.refundsPence / 100).toFixed(2)}`} colors={colors} />

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 18 }]}>COUNTED CASH</Text>
            <TextInput
              value={counted}
              onChangeText={setCounted}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />

            {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

            <Pressable
              onPress={() => {
                setError(null);
                const amount = Math.round((parseFloat(counted || "0") || 0) * 100);
                close.mutate({ sessionId: session.id, data: { countedCashPence: amount } });
              }}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: close.isPending || pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{close.isPending ? "CLOSING…" : "CLOSE TILL"}</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/(app)/products" as any)} style={[styles.secondary, { borderColor: colors.border }]}>
              <Text style={[styles.secondaryText, { color: colors.foreground }]}>BACK TO TILL</Text>
            </Pressable>
          </View>
        ) : isLocked ? (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
            <Text style={[styles.sectionLabel, { color: colors.destructive }]}>TILL LOCKED</Text>
            <Text style={[styles.lockedBody, { color: colors.mutedForeground }]}>
              This till cannot be opened because the licence is suspended or revoked.
              Please contact your administrator to resolve the licence status.
            </Text>
            <Pressable onPress={() => router.replace("/(app)/index" as any)} style={[styles.secondary, { borderColor: colors.border, marginTop: 16 }]}>
              <Text style={[styles.secondaryText, { color: colors.foreground }]}>GO BACK</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPEN NEW SESSION</Text>
            {isReadOnly && (
              <Text style={[styles.lockedBody, { color: "#b45309", marginBottom: 12 }]}>
                Opening a new till session is not available in read-only mode.
              </Text>
            )}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>LOCATION</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {locations?.map((l) => {
                const active = (locationId ?? activeLocId) === l.id;
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => !isReadOnly && setLocationId(l.id)}
                    style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : "transparent", opacity: isReadOnly ? 0.5 : 1 }]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{l.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>OPENING FLOAT (£)</Text>
            <TextInput
              value={float}
              onChangeText={setFloat}
              keyboardType="decimal-pad"
              editable={!isReadOnly}
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background, opacity: isReadOnly ? 0.5 : 1 }]}
            />

            {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

            <Pressable
              onPress={() => {
                setError(null);
                if (!activeLocId) { setError("Select a location"); return; }
                open.mutate({ data: { locationId: activeLocId, openingFloatPence: Math.round((parseFloat(float || "0") || 0) * 100) } });
              }}
              disabled={isReadOnly}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: isReadOnly || open.isPending || pressed ? (isReadOnly ? 0.4 : 0.85) : 1 }]}
            >
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{open.isPending ? "OPENING…" : "OPEN TILL"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 60 },
  titleBar: { paddingVertical: 6 },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: MONO_FONT, fontSize: 24, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  modeBanner: { borderWidth: 1, borderRadius: 8, padding: 12 },
  modeBannerText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, lineHeight: 18 },
  lockedBody: { fontFamily: MONO_FONT, fontSize: 13, lineHeight: 20 },
  section: { borderWidth: 1, borderRadius: 10, padding: 16 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, marginBottom: 12 },
  fieldLabel: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontFamily: MONO_FONT, fontSize: 18 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2 },
  rowValue: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1 },
  submit: { borderRadius: 8, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  submitText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
  secondary: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  secondaryText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  error: { fontFamily: MONO_FONT, fontSize: 12, textAlign: "center", marginTop: 10 },
});
