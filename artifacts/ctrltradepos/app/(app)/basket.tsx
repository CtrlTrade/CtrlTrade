import React, { useMemo, useState, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePosTransaction,
  useListPosTradeAccounts,
  getListPosTransactionsQueryKey,
  getGetCurrentTillSessionQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useBasket } from "@/lib/basket";
import { useModules } from "@/contexts/ModulesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { enqueue } from "@/lib/offlineQueue";

type Tender = "cash" | "card" | "split" | "trade_account";

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message ?? "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.toLowerCase().includes("network") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT")
  );
}

export default function BasketScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const { mode } = useAuth();
  const readOnly = mode !== "full";
  const qc = useQueryClient();
  const basket = useBasket();
  const { data: tradeAccounts } = useListPosTradeAccounts();
  const { triggerSync, pendingCount } = useOfflineSync();

  useEffect(() => {
    if (!modulesLoading && !modules?.hasTradeShop) {
      router.back();
    }
  }, [modulesLoading, modules?.hasTradeShop, router]);
  const [tender, setTender] = useState<Tender>("card");
  const [cashStr, setCashStr] = useState("");
  const [cardStr, setCardStr] = useState("");
  const [creditStr, setCreditStr] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const totals = useMemo(() => {
    const trade = tradeAccounts?.find((t) => t.id === basket.tradeAccountId);
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    for (const i of basket.items) {
      const gross = i.unitPricePence * i.quantity;
      const tradeDisc = trade ? Math.round(gross * (trade.discountPct / 100)) : 0;
      const net = gross - tradeDisc;
      const vat = Math.round((net * (i.vatRatePct ?? 20)) / 100);
      subtotal += gross;
      discount += tradeDisc;
      tax += vat;
    }
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [basket.items, basket.tradeAccountId, tradeAccounts]);

  const create = useCreatePosTransaction({
    mutation: {
      onSuccess: async (tx) => {
        await qc.invalidateQueries({ queryKey: getListPosTransactionsQueryKey() });
        await qc.invalidateQueries({ queryKey: getGetCurrentTillSessionQueryKey() });
        basket.clear();
        router.replace({ pathname: "/(app)/receipt/[id]", params: { id: tx.id } });
      },
      onError: async (e: Error) => {
        if (isNetworkError(e)) {
          await queueCurrentBasket();
        } else {
          setError(e.message.replace(/^HTTP \d+[^:]*:\s*/, ""));
        }
      },
    },
  });

  async function queueCurrentBasket() {
    const cash = Math.round((parseFloat(cashStr || "0") || 0) * 100);
    const card = Math.round((parseFloat(cardStr || "0") || 0) * 100);
    const credit = Math.round((parseFloat(creditStr || "0") || 0) * 100);
    await enqueue({
      items: basket.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        sku: i.sku,
        description: i.description,
        quantity: i.quantity,
        unitPricePence: i.unitPricePence,
        vatRatePct: i.vatRatePct,
      })),
      tender,
      tradeAccountId: basket.tradeAccountId,
      customerName: customerName.trim() || null,
      customerEmail: customerEmail.trim() || null,
      cashTakenPence: tender === "split" || tender === "cash" ? cash : undefined,
      cardTakenPence: tender === "split" || tender === "card" ? card : undefined,
      tradeCreditPence: tender === "split" || tender === "trade_account" ? credit : undefined,
    });
    basket.clear();
    setQueuedOffline(true);
    triggerSync();
  }

  function submit() {
    setError(null);
    setQueuedOffline(false);
    if (readOnly) {
      setError(
        mode === "locked"
          ? "This till licence is not active. Selling is disabled."
          : "This till is in read-only mode. Selling is disabled.",
      );
      return;
    }
    if (basket.items.length === 0) { setError("Basket is empty"); return; }
    const cash = Math.round((parseFloat(cashStr || "0") || 0) * 100);
    const card = Math.round((parseFloat(cardStr || "0") || 0) * 100);
    const credit = Math.round((parseFloat(creditStr || "0") || 0) * 100);
    create.mutate({
      data: {
        items: basket.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          sku: i.sku,
          description: i.description,
          quantity: i.quantity,
          unitPricePence: i.unitPricePence,
          vatRatePct: i.vatRatePct ?? undefined,
        })),
        tender,
        tradeAccountId: basket.tradeAccountId ?? undefined,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        cashTakenPence: tender === "split" || tender === "cash" ? cash : undefined,
        cardTakenPence: tender === "split" || tender === "card" ? card : undefined,
        tradeCreditPence: tender === "split" || tender === "trade_account" ? credit : undefined,
      },
    });
  }

  if (queuedOffline) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.titleBar, { borderColor: colors.border }]}>
          <View>
            <Text style={[styles.kicker, { color: colors.mutedForeground }]}>BASKET</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>QUEUED OFFLINE</Text>
          </View>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.close, { color: colors.foreground }]}>✕ BACK</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <Text style={[styles.offlineTitle, { color: colors.foreground }]}>SALE QUEUED</Text>
          <Text style={[styles.offlineBody, { color: colors.mutedForeground }]}>
            No connection detected. This sale has been saved locally and will sync automatically when connectivity returns.
          </Text>
          {pendingCount > 0 && (
            <Text style={[styles.offlineBadge, { color: colors.primary }]}>
              {pendingCount} sale{pendingCount === 1 ? "" : "s"} pending sync
            </Text>
          )}
          <Pressable
            onPress={() => router.replace("/(app)/index" as any)}
            style={[styles.submit, { backgroundColor: colors.primary, marginTop: 8 }]}
          >
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>BACK TO TILL</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>BASKET</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{basket.items.length} LINES</Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.close, { color: colors.foreground }]}>✕ BACK</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {readOnly && (
          <View style={[styles.banner, { borderColor: colors.destructive, backgroundColor: colors.card }]}>
            <Text style={[styles.bannerText, { color: colors.destructive }]}>
              {mode === "locked"
                ? "TILL LOCKED — licence not active. Selling is disabled."
                : "READ-ONLY MODE — licence not fully active. Selling is disabled."}
            </Text>
          </View>
        )}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ITEMS</Text>
          {basket.items.map((it, idx) => (
            <View key={idx} style={[styles.lineRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={1}>{it.description}</Text>
                <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>
                  £{(it.unitPricePence / 100).toFixed(2)} × {it.quantity}
                </Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => basket.updateQty(idx, it.quantity - 1)}>
                  <Text style={[styles.qtyBtn, { color: colors.foreground }]}>−</Text>
                </Pressable>
                <Text style={[styles.qty, { color: colors.foreground }]}>{it.quantity}</Text>
                <Pressable onPress={() => basket.updateQty(idx, it.quantity + 1)}>
                  <Text style={[styles.qtyBtn, { color: colors.foreground }]}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.lineTotal, { color: colors.foreground }]}>
                £{((it.unitPricePence * it.quantity) / 100).toFixed(2)}
              </Text>
            </View>
          ))}
          {basket.items.length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontFamily: MONO_FONT, textAlign: "center", padding: 12 }}>Basket is empty</Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>TRADE ACCOUNT</Text>
            {basket.tradeAccountId && (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/trade-account/[id]",
                    params: { id: basket.tradeAccountId! },
                  })
                }
                style={({ pressed }) => [styles.viewAcctBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.viewAcctText, { color: colors.primary }]}>VIEW ACCOUNT →</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pressable
              onPress={() => basket.setTradeAccount(null, null)}
              style={[styles.chip, { borderColor: !basket.tradeAccountId ? colors.primary : colors.border, backgroundColor: !basket.tradeAccountId ? colors.primary : "transparent" }]}
            >
              <Text style={[styles.chipText, { color: !basket.tradeAccountId ? colors.primaryForeground : colors.foreground }]}>NONE</Text>
            </Pressable>
            {tradeAccounts?.map((t) => {
              const active = basket.tradeAccountId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => basket.setTradeAccount(t.id, t.name)}
                  style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : "transparent" }]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                    {t.accountCode} · {t.discountPct}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CUSTOMER (OPTIONAL)</Text>
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
            placeholder="Email for receipt"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background, marginTop: 8 }]}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TENDER</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["card", "cash", "trade_account", "split"] as Tender[]).map((t) => {
              const active = tender === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTender(t)}
                  style={[styles.tenderBtn, { backgroundColor: active ? colors.primary : "transparent", borderColor: active ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.tenderText, { color: active ? colors.primaryForeground : colors.foreground }]}>{t.toUpperCase().replace("_", " ")}</Text>
                </Pressable>
              );
            })}
          </View>

          {tender === "split" && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput value={cashStr} onChangeText={setCashStr} placeholder="Cash £" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]} />
              <TextInput value={cardStr} onChangeText={setCardStr} placeholder="Card £" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]} />
              {basket.tradeAccountId && <TextInput value={creditStr} onChangeText={setCreditStr} placeholder="Trade credit £" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]} />}
            </View>
          )}
        </View>

        <View style={[styles.totals, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Row label="SUBTOTAL" value={`£${(totals.subtotal / 100).toFixed(2)}`} colors={colors} />
          {totals.discount > 0 && <Row label="TRADE DISCOUNT" value={`-£${(totals.discount / 100).toFixed(2)}`} colors={colors} />}
          <Row label="VAT" value={`£${(totals.tax / 100).toFixed(2)}`} colors={colors} />
          <View style={[styles.totalsRow, { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#0A2247" }]}>
            <Text style={[styles.totalsLabel, { color: colors.foreground, fontWeight: "700" }]}>TOTAL</Text>
            <Text style={[styles.totalsValue, { color: colors.primary, fontSize: 22 }]}>£{(totals.total / 100).toFixed(2)}</Text>
          </View>
        </View>

        {error && <Text style={{ color: colors.destructive, textAlign: "center", fontFamily: MONO_FONT }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={create.isPending || basket.items.length === 0 || readOnly}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: colors.primary, opacity: create.isPending || basket.items.length === 0 || readOnly || pressed ? 0.5 : 1 },
          ]}
        >
          {create.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              {readOnly ? "SELLING DISABLED" : `CHARGE £${(totals.total / 100).toFixed(2)}`}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.totalsValue, { color: colors.foreground }]}>{value}</Text>
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
  banner: { borderWidth: 1, borderRadius: 10, padding: 14 },
  bannerText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, fontWeight: "700", textAlign: "center" },
  section: { borderWidth: 1, borderRadius: 10, padding: 14 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, marginBottom: 10 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1 },
  lineDesc: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  lineSub: { fontFamily: MONO_FONT, fontSize: 10, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 },
  qtyBtn: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: "700", paddingHorizontal: 6 },
  qty: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700", minWidth: 22, textAlign: "center" },
  lineTotal: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700", minWidth: 70, textAlign: "right" },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontFamily: MONO_FONT, fontSize: 14 },
  tenderBtn: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8 },
  tenderText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  totals: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  totalsLabel: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  totalsValue: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700" },
  submit: { borderRadius: 8, paddingVertical: 18, alignItems: "center" },
  submitText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
  offlineTitle: { fontFamily: MONO_FONT, fontSize: 22, fontWeight: "700", letterSpacing: 3, textAlign: "center" },
  offlineBody: { fontFamily: MONO_FONT, fontSize: 13, lineHeight: 20, textAlign: "center" },
  offlineBadge: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  viewAcctBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  viewAcctText: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
});
