import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useListPosTradeAccounts,
  useListPosTransactions,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function BalanceBar({
  balancePence,
  limitPence,
}: {
  balancePence: number;
  limitPence: number;
}) {
  const colors = useColors();
  const used = Math.min(balancePence, limitPence);
  const pct = limitPence > 0 ? used / limitPence : 0;
  const barColor = pct >= 0.9 ? colors.destructive : pct >= 0.7 ? "#f59e0b" : colors.primary;
  return (
    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
}

export default function TradeAccountDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: accounts, isLoading: acctLoading } = useListPosTradeAccounts();
  const { data: transactions, isLoading: txLoading } = useListPosTransactions({
    tradeAccountId: id,
  });

  const account = accounts?.find((a) => a.id === id);
  const isLoading = acctLoading || txLoading;

  const available =
    account ? Math.max(0, account.creditLimitPence - account.balancePence) : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.titleBar, { borderColor: colors.border }]}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TRADE ACCOUNT</Text>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {account?.name ?? "LOADING..."}
          </Text>
        </View>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.close, { color: colors.foreground }]}>✕ BACK</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : !account ? (
        <View style={styles.centre}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>Account not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Account header card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>ACCOUNT CODE</Text>
              <Text style={[styles.cardValue, { color: colors.foreground }]}>{account.accountCode}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>TRADE DISCOUNT</Text>
              <Text style={[styles.cardValue, { color: colors.primary }]}>{account.discountPct}%</Text>
            </View>
            {account.email ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
                  <Text style={[styles.cardValue, { color: colors.foreground }]} numberOfLines={1}>
                    {account.email}
                  </Text>
                </View>
              </>
            ) : null}
            {account.phone ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.cardRow}>
                  <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>PHONE</Text>
                  <Text style={[styles.cardValue, { color: colors.foreground }]}>{account.phone}</Text>
                </View>
              </>
            ) : null}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>PAYMENT TERMS</Text>
              <Text style={[styles.cardValue, { color: colors.foreground }]}>
                {account.paymentTermsDays} DAYS
              </Text>
            </View>
          </View>

          {/* Balance summary */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CREDIT POSITION</Text>

            <View style={styles.balanceRow}>
              <View style={styles.balanceCell}>
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>BALANCE OWED</Text>
                <Text
                  style={[
                    styles.balanceAmount,
                    {
                      color:
                        account.balancePence === 0
                          ? colors.foreground
                          : account.balancePence >= account.creditLimitPence
                          ? colors.destructive
                          : colors.foreground,
                    },
                  ]}
                >
                  {money(account.balancePence)}
                </Text>
              </View>
              <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
              <View style={styles.balanceCell}>
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>CREDIT LIMIT</Text>
                <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
                  {money(account.creditLimitPence)}
                </Text>
              </View>
              <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
              <View style={styles.balanceCell}>
                <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>AVAILABLE</Text>
                <Text
                  style={[
                    styles.balanceAmount,
                    { color: available === 0 ? colors.destructive : colors.primary },
                  ]}
                >
                  {money(available)}
                </Text>
              </View>
            </View>

            <BalanceBar
              balancePence={account.balancePence}
              limitPence={account.creditLimitPence}
            />
            <Text style={[styles.barCaption, { color: colors.mutedForeground }]}>
              {account.creditLimitPence > 0
                ? `${Math.round((account.balancePence / account.creditLimitPence) * 100)}% OF LIMIT USED`
                : "NO CREDIT LIMIT SET"}
            </Text>
          </View>

          {/* Transaction history */}
          <Text style={[styles.historyLabel, { color: colors.mutedForeground }]}>
            TRANSACTION HISTORY
          </Text>

          {txLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : !transactions || transactions.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No transactions on this account yet.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {transactions.map((tx) => {
                const isRefund = tx.kind === "refund";
                const amount = isRefund ? -tx.totalPence : tx.tradeCreditPence ?? tx.totalPence;
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: isRefund ? colors.destructive : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.txTop}>
                        <Text style={[styles.txRef, { color: colors.foreground }]}>
                          {tx.number}
                        </Text>
                        {isRefund && (
                          <View style={[styles.badge, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}22` }]}>
                            <Text style={[styles.badgeText, { color: colors.destructive }]}>REFUND</Text>
                          </View>
                        )}
                        {tx.tender === "trade_account" && !isRefund && (
                          <View style={[styles.badge, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}>
                            <Text style={[styles.badgeText, { color: colors.primary }]}>TRADE CREDIT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.txMeta, { color: colors.mutedForeground }]}>
                        {formatDate(tx.createdAt)}
                        {tx.customerName ? ` · ${tx.customerName}` : ""}
                        {tx.createdByName ? ` · ${tx.createdByName}` : ""}
                      </Text>
                      {tx.items.length > 0 && (
                        <Text
                          style={[styles.txItems, { color: colors.mutedForeground }]}
                          numberOfLines={1}
                        >
                          {tx.items.map((i) => i.description).join(", ")}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isRefund ? colors.destructive : tx.tender === "trade_account" ? colors.foreground : colors.mutedForeground },
                      ]}
                    >
                      {isRefund ? "-" : tx.tender === "trade_account" ? "+" : ""}
                      {money(Math.abs(amount))}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  kicker: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { fontFamily: MONO_FONT, fontSize: 18, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  close: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  cardLabel: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  cardValue: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  divider: { height: 1 },

  sectionLabel: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: 16 },

  balanceRow: { flexDirection: "row", marginBottom: 16 },
  balanceCell: { flex: 1, alignItems: "center", gap: 4 },
  balanceDivider: { width: 1, marginHorizontal: 4 },
  balanceLabel: { fontFamily: MONO_FONT, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  balanceAmount: { fontFamily: MONO_FONT, fontSize: 20, fontWeight: "700" },

  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  barCaption: { fontFamily: MONO_FONT, fontSize: 9, letterSpacing: 1, marginTop: 6, textAlign: "center" },

  historyLabel: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 4,
  },

  txRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
    gap: 12,
  },
  txTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  txRef: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  txMeta: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 0.5, marginTop: 4 },
  txItems: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 0.5, marginTop: 3 },
  txAmount: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700", marginTop: 2 },

  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: MONO_FONT, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },

  empty: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 16 },
});
