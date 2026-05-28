import React, { useEffect } from "react";
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
import { useListPosSales } from "@workspace/api-client-react";

import { Header } from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useModules } from "@/contexts/ModulesContext";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function SalesLogScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const salesQuery = useListPosSales();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <Header
        title="SALES LOG"
        subtitle="Recent captures"
        right={
          <Pressable
            onPress={() => router.replace("/(app)")}
            style={({ pressed }) => [styles.back, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.backText, { color: colors.foreground }]}>← JOBS</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {salesQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : salesQuery.isError ? (
          <Text style={[styles.error, { color: colors.destructive }]}>
            Unable to load sales.
          </Text>
        ) : (salesQuery.data ?? []).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No sales captured yet.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {(salesQuery.data ?? []).map((sale) => (
              <Pressable
                key={sale.id}
                onPress={() => router.push({ pathname: "/(app)/receipt/[id]", params: { id: sale.id } })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowCustomer, { color: colors.foreground }]} numberOfLines={1}>
                    {sale.customerName || "Walk-in customer"}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                    {formatDateTime(sale.createdAt)} · {sale.tender.toUpperCase()}
                    {sale.jobReference ? ` · ${sale.jobReference}` : ""}
                  </Text>
                </View>
                <Text style={[styles.rowTotal, { color: colors.primary }]}>
                  £{sale.total.toFixed(2)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  backText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderRadius: 10, gap: 12 },
  rowCustomer: { fontFamily: MONO_FONT, fontSize: 15, fontWeight: "700" },
  rowMeta: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, marginTop: 4 },
  rowTotal: { fontFamily: MONO_FONT, fontSize: 17, fontWeight: "700" },
  empty: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 40 },
  error: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 40 },
});
