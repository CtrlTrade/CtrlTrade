import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePosSale,
  getListPosSalesQueryKey,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";

interface DraftLine {
  description: string;
  quantity: string;
  unitPrice: string;
}

const TAX_RATE = 0.2;

function emptyLine(): DraftLine {
  return { description: "", quantity: "1", unitPrice: "" };
}

function lineTotal(line: DraftLine): number {
  const qty = parseFloat(line.quantity || "0") || 0;
  const price = parseFloat(line.unitPrice || "0") || 0;
  return qty * price;
}

export default function NewSaleScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ jobReference?: string; customerName?: string; estimatedTotal?: string }>();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);

  const [customerName, setCustomerName] = useState<string>(params.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [lines, setLines] = useState<DraftLine[]>([
    {
      description: params.jobReference ? `Service: ${params.jobReference}` : "",
      quantity: "1",
      unitPrice: params.estimatedTotal ?? "",
    },
  ]);
  const [tender, setTender] = useState<"cash" | "card">("card");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), tax, total };
  }, [lines]);

  const createSale = useCreatePosSale({
    mutation: {
      onSuccess: async (sale) => {
        await queryClient.invalidateQueries({ queryKey: getListPosSalesQueryKey() });
        router.replace({ pathname: "/(app)/receipt/[id]", params: { id: sale.id } });
      },
      onError: (err: Error) => {
        setError(err.message.replace(/^HTTP \d+[^:]*:\s*/, ""));
      },
    },
  });

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const submit = () => {
    setError(null);
    const cleaned = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity || "0") || 0,
        unitPrice: parseFloat(l.unitPrice || "0") || 0,
      }))
      .filter((l) => l.description && l.quantity > 0 && l.unitPrice >= 0);

    if (cleaned.length === 0) {
      setError("Add at least one line item with a description and quantity.");
      return;
    }
    if (totals.total <= 0) {
      setError("Total must be greater than zero.");
      return;
    }

    createSale.mutate({
      data: {
        jobReference: params.jobReference ?? null,
        customerName: customerName.trim() || null,
        customerEmail: customerEmail.trim() || null,
        lines: cleaned,
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        total: totals.total,
        currency: "gbp",
        tender,
        notes: notes.trim() || null,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>NEW SALE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {params.jobReference ? params.jobReference : "WALK-IN"}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: colors.foreground }]}>✕ CANCEL</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CUSTOMER</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
          />
          <TextInput
            value={customerEmail}
            onChangeText={setCustomerEmail}
            placeholder="Email for receipt (optional)"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background, marginTop: 10 }]}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LINE ITEMS</Text>
          {lines.map((line, idx) => (
            <View key={idx} style={[styles.lineRow, { borderColor: colors.border }]}>
              <TextInput
                value={line.description}
                onChangeText={(v) => updateLine(idx, { description: v })}
                placeholder="Description"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.lineDesc, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
              />
              <View style={styles.lineNums}>
                <TextInput
                  value={line.quantity}
                  onChangeText={(v) => updateLine(idx, { quantity: v.replace(/[^0-9.]/g, "") })}
                  placeholder="QTY"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.lineNum, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
                />
                <TextInput
                  value={line.unitPrice}
                  onChangeText={(v) => updateLine(idx, { unitPrice: v.replace(/[^0-9.]/g, "") })}
                  placeholder="PRICE"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.lineNum, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background, flex: 1.2 }]}
                />
                <Text style={[styles.lineTotal, { color: colors.foreground }]}>
                  £{lineTotal(line).toFixed(2)}
                </Text>
                <Pressable onPress={() => removeLine(idx)} disabled={lines.length === 1}>
                  <Text style={[styles.remove, { color: lines.length === 1 ? colors.mutedForeground : colors.destructive }]}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable
            onPress={addLine}
            style={({ pressed }) => [styles.addLine, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.addLineText, { color: colors.primary }]}>+ ADD LINE</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TENDER</Text>
          <View style={styles.tenderRow}>
            {(["card", "cash"] as const).map((opt) => {
              const active = tender === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setTender(opt)}
                  style={({ pressed }) => [
                    styles.tenderBtn,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tenderText,
                      { color: active ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {opt.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 18 }]}>NOTES</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes for the receipt"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background, minHeight: 60, textAlignVertical: "top" },
            ]}
          />
        </View>

        <View style={[styles.totals, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>SUBTOTAL</Text>
            <Text style={[styles.totalsValue, { color: colors.foreground }]}>£{totals.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>VAT (20%)</Text>
            <Text style={[styles.totalsValue, { color: colors.foreground }]}>£{totals.tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsGrand]}>
            <Text style={[styles.totalsLabel, { color: colors.foreground, fontWeight: "700" }]}>TOTAL</Text>
            <Text style={[styles.totalsValue, { color: colors.primary, fontSize: 22 }]}>
              £{totals.total.toFixed(2)}
            </Text>
          </View>
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={createSale.isPending}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: colors.primary, opacity: createSale.isPending || pressed ? 0.85 : 1 },
          ]}
        >
          {createSale.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>CAPTURE SALE</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleBar: {
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  closeText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  scroll: { padding: 20, gap: 16, paddingBottom: 60 },
  section: { borderWidth: 1, borderRadius: 10, padding: 16 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, marginBottom: 12 },
  input: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: MONO_FONT, fontSize: 14,
  },
  lineRow: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, gap: 8 },
  lineDesc: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontFamily: MONO_FONT, fontSize: 14 },
  lineNums: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineNum: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontFamily: MONO_FONT, fontSize: 14, textAlign: "right" },
  lineTotal: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700", minWidth: 80, textAlign: "right" },
  remove: { fontFamily: MONO_FONT, fontSize: 18, paddingHorizontal: 8 },
  addLine: { marginTop: 4, borderWidth: 1, paddingVertical: 10, borderRadius: 6, alignItems: "center" },
  addLineText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  tenderRow: { flexDirection: "row", gap: 10 },
  tenderBtn: { flex: 1, borderWidth: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  tenderText: { fontFamily: MONO_FONT, fontSize: 13, letterSpacing: 2, fontWeight: "700" },
  totals: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalsGrand: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#0A2247" },
  totalsLabel: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  totalsValue: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700" },
  submit: { borderRadius: 8, paddingVertical: 18, alignItems: "center" },
  submitText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
  errorText: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center" },
});
