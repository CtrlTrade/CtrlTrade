import React, { useMemo, useState, useEffect } from "react";
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
import {
  useListPosSales,
  useSendPosReceipt,
} from "@workspace/api-client-react";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";

export default function ReceiptScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const { state } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const salesQuery = useListPosSales();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);
  const sale = useMemo(
    () => (salesQuery.data ?? []).find((s) => s.id === id) ?? null,
    [salesQuery.data, id],
  );

  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState<{ method: "email" | "print"; destination: string | null; at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (sale && sale.customerEmail && !email) setEmail(sale.customerEmail);
  }, [sale, email]);

  const sendReceipt = useSendPosReceipt({
    mutation: {
      onSuccess: (resp) => {
        setError(null);
        setDelivery({
          method: resp.method as "email" | "print",
          destination: resp.destination ?? null,
          at: resp.deliveredAt,
        });
      },
      onError: (err: Error) => setError(err.message.replace(/^HTTP \d+[^:]*:\s*/, "")),
    },
  });

  const sendEmail = () => {
    if (!sale) return;
    if (!email.trim()) {
      setError("Enter an email address to send the receipt.");
      return;
    }
    sendReceipt.mutate({ saleId: sale.id, data: { method: "email", destination: email.trim() } });
  };

  const printReceipt = () => {
    if (!sale) return;
    sendReceipt.mutate({ saleId: sale.id, data: { method: "print", destination: null } });
  };

  if (salesQuery.isLoading || !sale) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  const tenantName = state.status === "signed-in" ? state.session.tenant.name : "CtrlTrade";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>RECEIPT</Text>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {sale.customerName || "WALK-IN"}
          </Text>
        </View>
        <Pressable onPress={() => router.replace("/(app)")} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: colors.foreground }]}>DONE</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.receipt, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.shop, { color: colors.foreground }]}>{tenantName.toUpperCase()}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {new Date(sale.createdAt).toLocaleString()}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            SERVED BY {sale.createdByName.toUpperCase()}
          </Text>
          {sale.jobReference ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>JOB {sale.jobReference}</Text>
          ) : null}

          <View style={[styles.divider, { borderColor: colors.border }]} />

          {sale.lines.map((line, idx) => (
            <View key={idx} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineDesc, { color: colors.foreground }]}>{line.description}</Text>
                <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
                  {line.quantity} × £{line.unitPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.lineAmt, { color: colors.foreground }]}>
                £{(line.quantity * line.unitPrice).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={[styles.divider, { borderColor: colors.border }]} />

          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>SUBTOTAL</Text>
            <Text style={[styles.totalsValue, { color: colors.foreground }]}>£{sale.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>VAT</Text>
            <Text style={[styles.totalsValue, { color: colors.foreground }]}>£{sale.taxAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.foreground, fontWeight: "700" }]}>TOTAL</Text>
            <Text style={[styles.totalsValue, { color: colors.primary, fontSize: 22 }]}>
              £{sale.total.toFixed(2)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>TENDER</Text>
            <Text style={[styles.totalsValue, { color: colors.foreground }]}>{sale.tender.toUpperCase()}</Text>
          </View>
          {sale.notes ? (
            <>
              <View style={[styles.divider, { borderColor: colors.border }]} />
              <Text style={[styles.notes, { color: colors.mutedForeground }]}>{sale.notes}</Text>
            </>
          ) : null}
          <Text style={[styles.thanks, { color: colors.mutedForeground }]}>THANK YOU</Text>
        </View>

        <View style={[styles.actions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EMAIL RECEIPT</Text>
          <View style={styles.emailRow}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="customer@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />
            <Pressable
              onPress={sendEmail}
              disabled={sendReceipt.isPending}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: colors.primary, opacity: sendReceipt.isPending || pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.sendBtnText, { color: colors.primaryForeground }]}>SEND</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={printReceipt}
            disabled={sendReceipt.isPending}
            style={({ pressed }) => [
              styles.printBtn,
              { borderColor: colors.primary, opacity: sendReceipt.isPending || pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.printBtnText, { color: colors.primary }]}>PRINT TO TILL</Text>
          </Pressable>

          {delivery ? (
            <Text style={[styles.success, { color: colors.primary }]}>
              {delivery.method === "email" ? "Emailed" : "Sent to printer"}
              {delivery.destination ? ` · ${delivery.destination}` : ""}
              {" · "}{new Date(delivery.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          ) : null}
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        </View>
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
  closeText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  scroll: { padding: 20, gap: 16, paddingBottom: 60 },
  receipt: { borderWidth: 1, borderRadius: 10, padding: 20 },
  shop: { fontFamily: MONO_FONT, fontSize: 18, letterSpacing: 3, fontWeight: "700", textAlign: "center" },
  meta: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, textAlign: "center", marginTop: 4 },
  divider: { borderTopWidth: 1, borderStyle: "dashed", marginVertical: 14 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 },
  lineDesc: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  lineMeta: { fontFamily: MONO_FONT, fontSize: 11, marginTop: 2 },
  lineAmt: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
  totalsLabel: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2 },
  totalsValue: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700" },
  notes: { fontFamily: MONO_FONT, fontSize: 12, textAlign: "center", fontStyle: "italic" },
  thanks: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 3, textAlign: "center", marginTop: 16 },
  actions: { borderWidth: 1, borderRadius: 10, padding: 16, gap: 12 },
  sectionLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3 },
  emailRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontFamily: MONO_FONT, fontSize: 14 },
  sendBtn: { paddingHorizontal: 18, justifyContent: "center", borderRadius: 6 },
  sendBtnText: { fontFamily: MONO_FONT, fontWeight: "700", letterSpacing: 2 },
  printBtn: { borderWidth: 1, paddingVertical: 14, borderRadius: 6, alignItems: "center" },
  printBtnText: { fontFamily: MONO_FONT, fontWeight: "700", letterSpacing: 2 },
  success: { fontFamily: MONO_FONT, fontSize: 12, textAlign: "center" },
  error: { fontFamily: MONO_FONT, fontSize: 12, textAlign: "center" },
});
