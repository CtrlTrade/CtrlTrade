import React, { useEffect, useMemo } from "react";
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
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import type { QueuedTransaction } from "@/lib/offlineQueue";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

type SaleRow =
  | { kind: "synced"; id: string; customerName: string | null; createdAt: string; tender: string; jobReference?: string | null; total: number }
  | { kind: "pending"; clientId: string; item: QueuedTransaction };

export default function SalesLogScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modules, isLoading: modulesLoading } = useModules();
  const salesQuery = useListPosSales();
  const { pendingItems } = useOfflineSync();

  useEffect(() => {
    if (!modulesLoading && !modules?.posEnabled) {
      router.back();
    }
  }, [modulesLoading, modules?.posEnabled, router]);

  const rows = useMemo<SaleRow[]>(() => {
    const pending: SaleRow[] = [...pendingItems]
      .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
      .map((item) => ({ kind: "pending", clientId: item.clientId, item }));

    const synced: SaleRow[] = (salesQuery.data ?? []).map((sale) => ({
      kind: "synced",
      id: sale.id,
      customerName: sale.customerName ?? null,
      createdAt: sale.createdAt,
      tender: sale.tender,
      jobReference: sale.jobReference,
      total: sale.total,
    }));

    return [...pending, ...synced];
  }, [pendingItems, salesQuery.data]);

  const totalPendingPence = useMemo(
    () => pendingItems.reduce((sum, item) => sum + item.payload.items.reduce((s, i) => s + i.unitPricePence * i.quantity, 0), 0),
    [pendingItems],
  );

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
            <Text style={[styles.backText, { color: colors.foreground }]}>← HOME</Text>
          </Pressable>
        }
      />

      {pendingItems.length > 0 && (
        <View style={[styles.pendingBanner, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b" }]}>
          <Text style={[styles.pendingBannerText, { color: "#b45309" }]}>
            {pendingItems.length} SALE{pendingItems.length === 1 ? "" : "S"} PENDING SYNC
            {" "}· £{(totalPendingPence / 100).toFixed(2)} NOT YET CONFIRMED
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {salesQuery.isLoading && pendingItems.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : rows.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No sales captured yet.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((row) => {
              if (row.kind === "pending") {
                const { item } = row;
                const totalPence = item.payload.items.reduce((s, i) => s + i.unitPricePence * i.quantity, 0);
                return (
                  <View
                    key={`pending-${row.clientId}`}
                    style={[styles.row, { backgroundColor: "#f59e0b10", borderColor: "#f59e0b" }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTop}>
                        <Text style={[styles.rowCustomer, { color: colors.foreground }]} numberOfLines={1}>
                          {item.payload.customerName || "Walk-in customer"}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b" }]}>
                          <Text style={[styles.badgeText, { color: "#b45309" }]}>PENDING SYNC</Text>
                        </View>
                      </View>
                      <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                        {formatDateTime(item.queuedAt)} · {item.payload.tender.toUpperCase()}
                        {item.payload.notes ? ` · ${item.payload.notes}` : ""}
                        {item.attempts > 0 ? ` · ${item.attempts} attempt${item.attempts === 1 ? "" : "s"}` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.rowTotal, { color: "#b45309" }]}>
                      £{(totalPence / 100).toFixed(2)}
                    </Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={row.id}
                  onPress={() => router.push({ pathname: "/(app)/receipt/[id]", params: { id: row.id } })}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowCustomer, { color: colors.foreground }]} numberOfLines={1}>
                      {row.customerName || "Walk-in customer"}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                      {formatDateTime(row.createdAt)} · {row.tender.toUpperCase()}
                      {row.jobReference ? ` · ${row.jobReference}` : ""}
                    </Text>
                  </View>
                  <Text style={[styles.rowTotal, { color: colors.primary }]}>
                    £{row.total.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}

            {salesQuery.isLoading && pendingItems.length > 0 && (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            )}
            {salesQuery.isError && (
              <Text style={[styles.error, { color: colors.destructive }]}>
                Could not load synced sales.
              </Text>
            )}
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
  pendingBanner: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  pendingBannerText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderRadius: 10, gap: 12 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowCustomer: { fontFamily: MONO_FONT, fontSize: 15, fontWeight: "700" },
  rowMeta: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1, marginTop: 4 },
  rowTotal: { fontFamily: MONO_FONT, fontSize: 17, fontWeight: "700" },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: MONO_FONT, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  empty: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 40 },
  error: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 12 },
});
