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
import { useRouter } from "expo-router";
import { useListPosJobs } from "@workspace/api-client-react";
import type { PosJob } from "@workspace/api-client-react";

import { Header } from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const tone =
    status === "on_site" ? colors.primary : status === "en_route" ? "#F1A53A" : colors.mutedForeground;
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeText, { color: tone }]}>{status.replace("_", " ").toUpperCase()}</Text>
    </View>
  );
}

function JobCard({ job, onPress, onSignOff }: { job: PosJob; onPress: () => void; onSignOff: () => void }) {
  const colors = useColors();
  const isCompleted = job.status === "completed";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardRef, { color: colors.mutedForeground }]}>{job.reference}</Text>
          <Text style={[styles.cardCustomer, { color: colors.foreground }]} numberOfLines={1}>
            {job.customerName}
          </Text>
          <Text style={[styles.cardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
            {job.address}
          </Text>
        </View>
        <StatusBadge status={job.status} />
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>SCHEDULED</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatTime(job.scheduledFor)}</Text>
        </View>
        <View>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>TYPE</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{job.jobType}</Text>
        </View>
        <View>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>EST. TOTAL</Text>
          <Text style={[styles.metaValue, { color: colors.primary }]}>
            {formatMoney(job.estimatedTotal, job.currency)}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.captureBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.captureBtnText, { color: colors.primary }]}>CAPTURE SALE →</Text>
          </Pressable>
          {!isCompleted && (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onSignOff(); }}
              style={({ pressed }) => [
                styles.signoffBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.signoffBtnText, { color: colors.primaryForeground }]}>SIGN OFF</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function JobsScreen() {
  const colors = useColors();
  const router = useRouter();
  const jobsQuery = useListPosJobs();

  const goSale = (job?: PosJob) => {
    router.push({
      pathname: "/(app)/sale",
      params: job
        ? {
            jobReference: job.reference,
            customerName: job.customerName,
            estimatedTotal: String(job.estimatedTotal),
          }
        : {},
    });
  };

  const goJobDetail = (job: PosJob) => {
    router.push({
      pathname: "/(app)/job-detail",
      params: {
        jobId: job.id,
        jobReference: job.reference,
        customerName: job.customerName,
        address: job.address ?? "",
        status: job.status,
      },
    });
  };

  const goSignOff = (job: PosJob) => {
    router.push({
      pathname: "/(app)/job-signoff",
      params: {
        jobId: job.id,
        jobNumber: job.reference,
        jobTitle: job.customerName,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <Header
        title="TODAY"
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        right={
          <Pressable
            onPress={() => router.push("/(app)/sales")}
            style={({ pressed }) => [
              styles.headerLink,
              { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.headerLinkText, { color: colors.foreground }]}>SALES LOG</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ASSIGNED JOBS</Text>
          <Pressable
            onPress={() => goSale()}
            style={({ pressed }) => [
              styles.newSale,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.newSaleText, { color: colors.primaryForeground }]}>+ NEW SALE</Text>
          </Pressable>
        </View>

        {jobsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : jobsQuery.isError ? (
          <Text style={[styles.error, { color: colors.destructive }]}>
            Unable to load jobs. Pull to retry.
          </Text>
        ) : (
          <View style={styles.list}>
            {(jobsQuery.data ?? []).map((job) => (
              <JobCard key={job.id} job={job} onPress={() => goJobDetail(job)} onSignOff={() => goSignOff(job)} />
            ))}
            {(jobsQuery.data ?? []).length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                No jobs assigned today.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontFamily: MONO_FONT, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
  newSale: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8 },
  newSaleText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 12, letterSpacing: 2 },
  list: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 10, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardRef: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2 },
  cardCustomer: { fontFamily: MONO_FONT, fontSize: 17, marginTop: 4, fontWeight: "700" },
  cardAddress: { fontFamily: MONO_FONT, fontSize: 12, marginTop: 4 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  cardFooter: {
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
  },
  metaLabel: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  metaValue: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  captureBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 },
  captureBtnText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  signoffBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6 },
  signoffBtnText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  empty: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 32 },
  error: { fontFamily: MONO_FONT, fontSize: 13, textAlign: "center", marginTop: 32 },
  headerLink: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  headerLinkText: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
});
