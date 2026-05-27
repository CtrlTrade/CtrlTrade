import React, { useState } from "react";
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

export default function TillScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, isLoading } = useGetCurrentTillSession();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleBar}>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TILL SESSION</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{isOpen ? "OPEN" : "CLOSED"}</Text>
        </View>

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
        ) : (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPEN NEW SESSION</Text>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>LOCATION</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {locations?.map((l) => {
                const active = (locationId ?? activeLocId) === l.id;
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setLocationId(l.id)}
                    style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : "transparent" }]}
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
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />

            {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

            <Pressable
              onPress={() => {
                setError(null);
                if (!activeLocId) { setError("Select a location"); return; }
                open.mutate({ data: { locationId: activeLocId, openingFloatPence: Math.round((parseFloat(float || "0") || 0) * 100) } });
              }}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: open.isPending || pressed ? 0.85 : 1 }]}
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
