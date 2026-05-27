import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetCurrentTillSession, useListPosTransactions } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

export default function EodReportScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: session } = useGetCurrentTillSession();
  const { data: txs } = useListPosTransactions();

  const lastClosed = !session && txs && txs.length > 0;

  const totals = (txs ?? []).reduce(
    (acc, t) => {
      if (t.kind === "sale") {
        acc.sales += t.totalPence;
        acc.cash += t.cashTakenPence ?? 0;
        acc.card += t.cardTakenPence ?? 0;
        acc.trade += t.tradeCreditPence ?? 0;
      } else if (t.kind === "refund") {
        acc.refunds += Math.abs(t.totalPence);
      }
      return acc;
    },
    { sales: 0, cash: 0, card: 0, trade: 0, refunds: 0 },
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>END OF DAY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{lastClosed ? "LAST SESSION" : "CURRENT"}</Text>
        </View>
        <Pressable onPress={() => router.replace("/(app)/products" as any)}>
          <Text style={[styles.close, { color: colors.foreground }]}>✕ DONE</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SALES SUMMARY</Text>
          <Row label="Gross sales" value={`£${(totals.sales / 100).toFixed(2)}`} colors={colors} />
          <Row label="Cash" value={`£${(totals.cash / 100).toFixed(2)}`} colors={colors} />
          <Row label="Card" value={`£${(totals.card / 100).toFixed(2)}`} colors={colors} />
          <Row label="Trade credit" value={`£${(totals.trade / 100).toFixed(2)}`} colors={colors} />
          <Row label="Refunds" value={`£${(totals.refunds / 100).toFixed(2)}`} colors={colors} />
          <Row label="Net" value={`£${((totals.sales - totals.refunds) / 100).toFixed(2)}`} colors={colors} bold />
        </View>

        {session && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPEN TILL SESSION</Text>
            <Row label="Location" value={session.locationName ?? "—"} colors={colors} />
            <Row label="Opened" value={new Date(session.openedAt).toLocaleString()} colors={colors} />
            <Row label="Opening float" value={`£${(session.openingFloatPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Cash sales" value={`£${(session.cashSalesPence / 100).toFixed(2)}`} colors={colors} />
            <Row label="Expected drawer" value={`£${((session.openingFloatPence + session.cashSalesPence - session.refundsPence) / 100).toFixed(2)}`} colors={colors} bold />

            <Pressable
              onPress={() => router.push("/(app)/till" as any)}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>CLOSE TILL & RECONCILE</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, colors, bold }: { label: string; value: string; colors: ReturnType<typeof useColors>; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground, fontSize: bold ? 16 : 13, fontWeight: bold ? "700" : "600" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleBar: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  close: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  scroll: { padding: 16, gap: 14, paddingBottom: 60 },
  section: { borderWidth: 1, borderRadius: 10, padding: 16 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2 },
  rowValue: { fontFamily: MONO_FONT },
  submit: { borderRadius: 8, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  submitText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
});
