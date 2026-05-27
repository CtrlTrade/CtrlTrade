import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import {
  useJobCheckin,
  useJobCheckout,
  useListJobCheckins,
  getListJobCheckinsQueryKey,
} from "@workspace/api-client-react";
import type { JobCheckin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(minutes: number | null | undefined): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface CheckinCardProps {
  item: JobCheckin;
  colors: ReturnType<typeof useColors>;
}

function CheckinCard({ item, colors }: CheckinCardProps) {
  const isActive = !item.checkedOutAt;
  return (
    <View style={[styles.checkinCard, { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border }]}>
      <View style={styles.checkinRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>
            {fmtDate(item.checkedInAt)}
          </Text>
          <Text style={[styles.checkinTime, { color: colors.foreground }]}>
            {fmtTime(item.checkedInAt)} → {isActive ? <Text style={{ color: colors.primary }}>ACTIVE</Text> : fmtTime(item.checkedOutAt)}
          </Text>
          {item.notes ? (
            <Text style={[styles.notesText, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {item.durationMinutes ? (
            <Text style={[styles.duration, { color: colors.foreground }]}>
              {fmtDuration(item.durationMinutes)}
            </Text>
          ) : null}
          {item.checkInLat ? (
            <Text style={[styles.gpsLabel, { color: colors.primary }]}>GPS</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function JobDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    jobReference: string;
    customerName: string;
    address?: string;
    status?: string;
  }>();

  const qc = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);

  const checkinsQuery = useListJobCheckins(params.jobId ?? "");

  const checkinMutation = useJobCheckin();
  const checkoutMutation = useJobCheckout();

  const checkins = checkinsQuery.data ?? [];
  const activeCheckin = checkins.find((c) => !c.checkedOutAt);
  const isCheckedIn = !!activeCheckin;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListJobCheckinsQueryKey(params.jobId ?? "") });
  }, [qc, params.jobId]);

  async function getLocation(): Promise<{ lat: string; lng: string } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return {
        lat: String(loc.coords.latitude),
        lng: String(loc.coords.longitude),
      };
    } catch {
      return null;
    }
  }

  const handleCheckin = async () => {
    if (!params.jobId) return;
    setIsLocating(true);
    const gps = await getLocation();
    setIsLocating(false);
    checkinMutation.mutate(
      {
        jobId: params.jobId,
        data: {
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
        },
      },
      {
        onSuccess: () => {
          invalidate();
        },
        onError: (e: any) => {
          Alert.alert("Check-in failed", e?.message ?? "Unable to check in");
        },
      },
    );
  };

  const handleCheckout = async () => {
    if (!params.jobId) return;
    setIsLocating(true);
    const gps = await getLocation();
    setIsLocating(false);
    checkoutMutation.mutate(
      {
        jobId: params.jobId,
        data: {
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
        },
      },
      {
        onSuccess: () => {
          invalidate();
        },
        onError: (e: any) => {
          Alert.alert("Check-out failed", e?.message ?? "Unable to check out");
        },
      },
    );
  };

  const handleSale = () => {
    router.push({
      pathname: "/(app)/sale",
      params: {
        jobReference: params.jobReference,
        customerName: params.customerName,
      },
    });
  };

  const isMutating = checkinMutation.isPending || checkoutMutation.isPending || isLocating;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <Header
        title={params.jobReference ?? "JOB"}
        subtitle={params.customerName ?? ""}
        right={
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.backText, { color: colors.primary }]}>← JOBS</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {params.address ? (
          <Text style={[styles.address, { color: colors.mutedForeground }]}>{params.address}</Text>
        ) : null}

        <View style={[styles.checkinPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.checkinStatus}>
            <View style={[styles.statusDot, { backgroundColor: isCheckedIn ? colors.primary : colors.mutedForeground }]} />
            <Text style={[styles.statusLabel, { color: colors.foreground }]}>
              {isCheckedIn ? "CHECKED IN" : "NOT CHECKED IN"}
            </Text>
            {isCheckedIn && activeCheckin && (
              <Text style={[styles.statusSince, { color: colors.mutedForeground }]}>
                since {fmtTime(activeCheckin.checkedInAt)}
              </Text>
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={isCheckedIn ? handleCheckout : handleCheckin}
              disabled={isMutating}
              style={({ pressed }) => [
                styles.checkinBtn,
                {
                  backgroundColor: isCheckedIn ? "#EF4444" : colors.primary,
                  opacity: isMutating || pressed ? 0.7 : 1,
                },
              ]}
            >
              {isMutating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.checkinBtnText}>
                  {isCheckedIn ? "CHECK OUT" : "CHECK IN"}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleSale}
              style={({ pressed }) => [
                styles.saleBtn,
                { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.saleBtnText, { color: colors.primary }]}>CAPTURE SALE →</Text>
            </Pressable>
          </View>
        </View>

        {checkinsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : checkins.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>CHECK-IN HISTORY</Text>
            <View style={styles.list}>
              {checkins.map((c) => (
                <CheckinCard key={c.id} item={c} colors={colors} />
              ))}
            </View>
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No check-ins yet for this job.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  backBtn: { paddingHorizontal: 4 },
  backText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, fontWeight: "700" },
  address: { fontFamily: MONO_FONT, fontSize: 12, marginBottom: 16 },
  checkinPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  checkinStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  statusSince: { fontFamily: MONO_FONT, fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 12 },
  checkinBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkinBtnText: {
    fontFamily: MONO_FONT,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 2,
    color: "#fff",
  },
  saleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saleBtnText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 11, letterSpacing: 2 },
  historySection: { marginTop: 8 },
  sectionTitle: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 3, fontWeight: "700", marginBottom: 12 },
  list: { gap: 10 },
  checkinCard: { borderWidth: 1, borderRadius: 8, padding: 12 },
  checkinRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  metaLabel: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, marginBottom: 2 },
  checkinTime: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700" },
  notesText: { fontFamily: MONO_FONT, fontSize: 11, marginTop: 4 },
  duration: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: "700" },
  gpsLabel: { fontFamily: MONO_FONT, fontSize: 9, letterSpacing: 2, marginTop: 2 },
  empty: { fontFamily: MONO_FONT, fontSize: 12, textAlign: "center", marginTop: 32 },
});
