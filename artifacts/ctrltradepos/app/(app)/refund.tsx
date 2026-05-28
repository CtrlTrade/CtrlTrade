import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPosTransactions,
  useRefundPosTransaction,
  getListPosTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";

export default function RefundScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const qc = useQueryClient();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);
  const { data: transactions, isLoading } = useListPosTransactions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => transactions?.find((t) => t.id === selectedId && t.kind === "sale") ?? null,
    [transactions, selectedId],
  );

  const refund = useRefundPosTransaction({
    mutation: {
      onSuccess: async (tx) => {
        await qc.invalidateQueries({ queryKey: getListPosTransactionsQueryKey() });
        router.replace({ pathname: "/(app)/receipt/[id]", params: { id: tx.id } });
      },
      onError: (e: Error) => setError(e.message.replace(/^HTTP \d+[^:]*:\s*/, "")),
    },
  });

  function submit() {
    setError(null);
    if (!selected) return;
    const items = selected.items
      .map((i) => ({ originalItemId: i.id, quantity: parseInt(qtys[i.id] ?? "0", 10) || 0 }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) { setError("Select items to refund"); return; }
    if (!pin) { setError("Manager PIN required"); return; }
    refund.mutate({
      transactionId: selected.id,
      data: { items, approvalPin: pin, reason: reason.trim() || undefined },
    });
  }

  if (selected) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.titleBar, { borderColor: colors.border }]}>
          <View>
            <Text style={[styles.kicker, { color: colors.mutedForeground }]}>REFUND</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{selected.number}</Text>
          </View>
          <Pressable onPress={() => setSelectedId(null)}>
            <Text style={[styles.close, { color: colors.foreground }]}>✕ CHOOSE OTHER</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT QUANTITIES</Text>
            {selected.items.map((it) => (
              <View key={it.id} style={[styles.lineRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineDesc, { color: colors.foreground }]}>{it.description}</Text>
                  <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>Bought {it.quantity} @ £{(it.unitPricePence / 100).toFixed(2)}</Text>
                </View>
                <TextInput
                  value={qtys[it.id] ?? ""}
                  onChangeText={(v) => setQtys((q) => ({ ...q, [it.id]: v.replace(/[^0-9]/g, "") }))}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
                />
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MANAGER PIN</Text>
            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="4-digit PIN"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 14 }]}>REASON</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. faulty, customer changed mind"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />
          </View>

          {error && <Text style={{ color: colors.destructive, textAlign: "center", fontFamily: MONO_FONT }}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={refund.isPending}
            style={({ pressed }) => [styles.submit, { backgroundColor: colors.destructive, opacity: refund.isPending || pressed ? 0.85 : 1 }]}
          >
            {refund.isPending ? <ActivityIndicator color="#fff" /> : <Text style={[styles.submitText, { color: "#fff" }]}>PROCESS REFUND</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>REFUND</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>SELECT SALE</Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.close, { color: colors.foreground }]}>✕ CANCEL</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={(transactions ?? []).filter((t) => t.kind === "sale")}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedId(item.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowNumber, { color: colors.foreground }]}>{item.number}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleString()} · {item.customerName ?? "Walk-in"}
                </Text>
              </View>
              <Text style={[styles.rowPrice, { color: colors.foreground }]}>£{(item.totalPence / 100).toFixed(2)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 20, fontFamily: MONO_FONT }}>
              No sales found.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleBar: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  close: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  scroll: { padding: 16, gap: 14, paddingBottom: 60 },
  section: { borderWidth: 1, borderRadius: 10, padding: 14 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontFamily: MONO_FONT, fontSize: 14 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  lineDesc: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  lineSub: { fontFamily: MONO_FONT, fontSize: 10, marginTop: 2 },
  qtyInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontFamily: MONO_FONT, fontSize: 14, width: 60, textAlign: "center" },
  submit: { borderRadius: 8, paddingVertical: 18, alignItems: "center", marginTop: 10 },
  submitText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
  row: { borderWidth: 1, borderRadius: 8, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rowNumber: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700" },
  rowSub: { fontFamily: MONO_FONT, fontSize: 10, marginTop: 2 },
  rowPrice: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700" },
});
