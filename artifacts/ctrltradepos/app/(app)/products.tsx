import React, { useState, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useListPosProducts, useGetCurrentTillSession } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";
import { useBasket } from "@/lib/basket";

export default function ProductsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: session } = useGetCurrentTillSession();
  const { data: products, isLoading } = useListPosProducts({ search: search || undefined });
  const { items, addItem, clear: _clear } = useBasket();
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const basketTotal = useMemo(
    () => items.reduce((s, i) => s + i.unitPricePence * i.quantity, 0),
    [items],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TILL</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>PRODUCTS</Text>
        </View>
        <Pressable onPress={() => router.push("/(app)/till" as any)} style={[styles.tillBtn, { borderColor: colors.border }]}>
          <Text style={[styles.tillBtnText, { color: session ? colors.primary : colors.destructive }]}>
            {session ? "TILL OPEN" : "OPEN TILL"}
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Scan barcode or search SKU / name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 140 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                addItem({
                  productId: item.id,
                  sku: item.sku,
                  description: item.name,
                  unitPricePence: item.pricePence,
                  vatRatePct: item.vatRatePct,
                  quantity: 1,
                })
              }
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowSku, { color: colors.mutedForeground }]}>{item.sku}</Text>
                <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                {item.trackStock && (
                  <Text style={[styles.rowStock, { color: item.stockHere > 0 ? colors.mutedForeground : colors.destructive }]}>
                    STOCK: {item.stockHere}
                  </Text>
                )}
              </View>
              <Text style={[styles.rowPrice, { color: colors.foreground }]}>£{(item.pricePence / 100).toFixed(2)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 20, fontFamily: MONO_FONT }}>
              No products. Add some in the web control panel.
            </Text>
          }
        />
      )}

      {itemCount > 0 && (
        <Pressable
          onPress={() => router.push("/(app)/basket" as any)}
          style={({ pressed }) => [styles.basketBar, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.basketText, { color: colors.primaryForeground }]}>
            {itemCount} ITEMS — £{(basketTotal / 100).toFixed(2)}
          </Text>
          <Text style={[styles.basketText, { color: colors.primaryForeground }]}>VIEW BASKET →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: MONO_FONT, fontSize: 20, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  tillBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  tillBtnText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontFamily: MONO_FONT, fontSize: 14 },
  row: { borderWidth: 1, borderRadius: 8, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rowSku: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 1 },
  rowName: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700", marginTop: 2 },
  rowStock: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 1, marginTop: 4 },
  rowPrice: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700" },
  basketBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 18, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  basketText: { fontFamily: MONO_FONT, fontSize: 13, letterSpacing: 2, fontWeight: "700" },
});
