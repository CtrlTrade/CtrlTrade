import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import {
  useJobCheckin,
  useJobCheckout,
  useListJobCheckins,
  useCreateTimesheetEntry,
  getListJobCheckinsQueryKey,
  getListTimesheetsQueryKey,
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

interface TimesheetModalProps {
  visible: boolean;
  jobId: string;
  checkinId: string | null;
  checkinDate: string;
  durationMinutes: number;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}

function TimesheetModal({
  visible,
  jobId,
  checkinId,
  checkinDate,
  durationMinutes,
  onClose,
  colors,
}: TimesheetModalProps) {
  const hours = parseFloat((durationMinutes / 60).toFixed(2));
  const [hoursVal, setHoursVal] = useState(String(hours));
  const [travel, setTravel] = useState("0");
  const [mileage, setMileage] = useState("0");
  const [notes, setNotes] = useState("");
  const createEntry = useCreateTimesheetEntry();
  const qc = useQueryClient();

  function handleSave() {
    createEntry.mutate(
      {
        data: {
          jobId,
          checkinId: checkinId ?? null,
          date: checkinDate.slice(0, 10),
          hoursWorked: parseFloat(hoursVal) || 0,
          travelMinutes: parseInt(travel) || 0,
          mileageMiles: parseInt(mileage) || 0,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTimesheetsQueryKey() });
          onClose();
          Alert.alert("Timesheet saved", "Your entry has been saved as a draft. Submit it for manager approval when ready.");
        },
        onError: (e: any) => {
          Alert.alert("Failed to save", e?.message ?? "Could not create timesheet entry");
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>LOG TIMESHEET ENTRY</Text>
          <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
            Checked out at {fmtTime(new Date().toISOString())} · {fmtDuration(durationMinutes)} on site
          </Text>

          <View style={styles.modalFields}>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>HOURS WORKED</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border }]}
                value={hoursVal}
                onChangeText={setHoursVal}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRAVEL (MINS)</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border }]}
                value={travel}
                onChangeText={setTravel}
                keyboardType="number-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MILEAGE</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border }]}
                value={mileage}
                onChangeText={setMileage}
                keyboardType="number-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={[styles.fieldRow, { alignItems: "flex-start" }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>NOTES</Text>
              <TextInput
                style={[styles.fieldInput, styles.notesInput, { color: colors.foreground, borderColor: colors.border }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.mutedForeground}
                placeholder="Optional notes..."
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, styles.cancelBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={onClose}
            >
              <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>SKIP</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.primary, opacity: pressed || createEntry.isPending ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={createEntry.isPending}
            >
              {createEntry.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>SAVE ENTRY</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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
            {fmtTime(item.checkedInAt)}{" → "}
            {isActive ? <Text style={{ color: colors.primary }}>ACTIVE</Text> : fmtTime(item.checkedOutAt)}
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
  const [timesheetModal, setTimesheetModal] = useState<{
    checkinId: string;
    checkinDate: string;
    durationMinutes: number;
  } | null>(null);

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
        data: { lat: gps?.lat ?? null, lng: gps?.lng ?? null },
      },
      {
        onSuccess: () => invalidate(),
        onError: (e: any) => Alert.alert("Check-in failed", e?.message ?? "Unable to check in"),
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
        data: { lat: gps?.lat ?? null, lng: gps?.lng ?? null },
      },
      {
        onSuccess: (result: any) => {
          invalidate();
          // Prompt timesheet entry after checkout
          const dur = result?.durationMinutes ?? 0;
          setTimesheetModal({
            checkinId: result?.id ?? activeCheckin?.id ?? "",
            checkinDate: result?.checkedOutAt ?? new Date().toISOString(),
            durationMinutes: dur,
          });
        },
        onError: (e: any) => Alert.alert("Check-out failed", e?.message ?? "Unable to check out"),
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

      {timesheetModal && (
        <TimesheetModal
          visible={true}
          jobId={params.jobId ?? ""}
          checkinId={timesheetModal.checkinId}
          checkinDate={timesheetModal.checkinDate}
          durationMinutes={timesheetModal.durationMinutes}
          onClose={() => setTimesheetModal(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
  backBtn: { paddingHorizontal: 4 },
  backText: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 1, fontWeight: "700" },
  address: { fontFamily: MONO_FONT, fontSize: 12, marginBottom: 16 },
  checkinPanel: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 24 },
  checkinStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: MONO_FONT, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  statusSince: { fontFamily: MONO_FONT, fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 12 },
  checkinBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkinBtnText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 13, letterSpacing: 2, color: "#fff" },
  saleBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
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
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalContent: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, gap: 16 },
  modalTitle: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "700", letterSpacing: 2 },
  modalSubtitle: { fontFamily: MONO_FONT, fontSize: 11, marginTop: -8 },
  modalFields: { gap: 12 },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  fieldLabel: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 2, width: 110 },
  fieldInput: { flex: 1, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontFamily: MONO_FONT, fontSize: 14, borderRadius: 6 },
  notesInput: { textAlignVertical: "top", minHeight: 72 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1 },
  modalBtnText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 12, letterSpacing: 2 },
});
