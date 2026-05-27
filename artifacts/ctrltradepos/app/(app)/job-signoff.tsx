import React, { useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import {
  useCompleteJob,
  requestUploadUrl,
  getListPosJobsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

interface Point { x: number; y: number }
interface Stroke { points: Point[] }

function buildPathD(stroke: Stroke): string {
  if (stroke.points.length === 0) return "";
  const [first, ...rest] = stroke.points;
  const parts = [`M ${first.x} ${first.y}`];
  for (const p of rest) {
    parts.push(`L ${p.x} ${p.y}`);
  }
  return parts.join(" ");
}

const CANVAS_W = 340;
const CANVAS_H = 180;

export default function JobSignoffScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { jobId, jobNumber, jobTitle } = useLocalSearchParams<{
    jobId: string;
    jobNumber: string;
    jobTitle: string;
  }>();

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [signerName, setSignerName] = useState("");
  const [workNotes, setWorkNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const completeJob = useCompleteJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPosJobsQueryKey() });
        router.replace("/(app)/");
      },
      onError: (err: Error) => {
        Alert.alert("Error", err.message || "Failed to complete job");
        setBusy(false);
      },
    },
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke({ points: [{ x: locationX, y: locationY }] });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentStroke((prev) =>
          prev ? { points: [...prev.points, { x: locationX, y: locationY }] } : null
        );
      },
      onPanResponderRelease: () => {
        setCurrentStroke((prev) => {
          if (prev && prev.points.length > 0) {
            setStrokes((s) => [...s, prev]);
          }
          return null;
        });
      },
    })
  ).current;

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  const isEmpty = strokes.length === 0 && currentStroke === null;

  function buildSvgContent(w: number, h: number): string {
    const paths = strokesRef.current
      .map(
        (s) =>
          `<path d="${buildPathD(s)}" stroke="black" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:white">${paths}</svg>`;
  }

  async function uploadSignature(): Promise<string> {
    const svgContent = buildSvgContent(CANVAS_W, CANVAS_H);
    const { uploadURL, objectPath } = await requestUploadUrl({
      name: `signoff-${jobId}.svg`,
      size: svgContent.length,
      contentType: "image/svg+xml",
    });
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      body: svgBlob,
      headers: { "Content-Type": "image/svg+xml" },
    });
    if (!uploadRes.ok) throw new Error("Upload failed");
    return `/api/storage/public-objects/${objectPath}`;
  }

  function signatureAsDataUrl(): string {
    const svgContent = buildSvgContent(CANVAS_W, CANVAS_H);
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
  }

  async function handleSubmit() {
    if (!signerName.trim()) {
      Alert.alert("Missing name", "Please enter the customer's name before signing off.");
      return;
    }
    if (isEmpty) {
      Alert.alert("No signature", "Please ask the customer to sign on the pad below.");
      return;
    }
    setBusy(true);
    let signoffImageUrl: string;
    try {
      signoffImageUrl = await uploadSignature();
    } catch {
      signoffImageUrl = signatureAsDataUrl();
    }
    completeJob.mutate({
      jobId,
      data: {
        signoffName: signerName.trim(),
        signoffImageUrl,
        signoffNote: workNotes.trim() || undefined,
      },
    });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} disabled={busy} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={[styles.back, { color: colors.primary }]}>← BACK</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>SIGN OFF JOB</Text>
        </View>

        <View style={[styles.jobInfo, { borderColor: colors.border }]}>
          <Text style={[styles.jobRef, { color: colors.mutedForeground }]}>{jobNumber}</Text>
          <Text style={[styles.jobTitle, { color: colors.foreground }]}>{jobTitle}</Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>WORK DONE NOTES</Text>
          <TextInput
            style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Describe work completed…"
            placeholderTextColor={colors.mutedForeground}
            value={workNotes}
            onChangeText={setWorkNotes}
            multiline
            numberOfLines={3}
            editable={!busy}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>CUSTOMER NAME *</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Full name of signatory"
            placeholderTextColor={colors.mutedForeground}
            value={signerName}
            onChangeText={setSignerName}
            autoCapitalize="words"
            editable={!busy}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.canvasHeader}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>CUSTOMER SIGNATURE *</Text>
            <Pressable onPress={clearCanvas} disabled={busy} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={[styles.clearBtn, { color: colors.primary }]}>CLEAR</Text>
            </Pressable>
          </View>
          <View
            style={[styles.canvas, { borderColor: colors.border }]}
            {...(busy ? {} : panResponder.panHandlers)}
          >
            {isEmpty ? (
              <Text style={styles.canvasHint}>Draw signature here</Text>
            ) : null}
            <Svg width={CANVAS_W} height={CANVAS_H} style={StyleSheet.absoluteFill}>
              {strokes.map((s, i) => (
                <Path
                  key={i}
                  d={buildPathD(s)}
                  stroke="#000000"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentStroke && currentStroke.points.length > 0 && (
                <Path
                  d={buildPathD(currentStroke)}
                  stroke="#000000"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
          <Text style={[styles.canvasFooter, { color: colors.mutedForeground }]}>
            By signing, the customer confirms the work described above has been completed satisfactorily.
          </Text>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={busy}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: busy ? colors.mutedForeground : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>COMPLETE & SIGN OFF</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  back: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  title: { fontFamily: MONO_FONT, fontSize: 16, letterSpacing: 3, fontWeight: "700" },
  jobInfo: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 24 },
  jobRef: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  jobTitle: { fontFamily: MONO_FONT, fontSize: 17, fontWeight: "700" },
  field: { marginBottom: 20 },
  label: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, marginBottom: 8, fontWeight: "700" },
  input: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: MONO_FONT, fontSize: 14, minHeight: 44,
  },
  textArea: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: MONO_FONT, fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  canvasHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  clearBtn: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  canvas: {
    width: CANVAS_W, height: CANVAS_H, borderWidth: 1, borderRadius: 6, backgroundColor: "#FFFFFF",
    overflow: "hidden", justifyContent: "center", alignItems: "center",
  },
  canvasHint: { position: "absolute", color: "#aaa", fontFamily: MONO_FONT, fontSize: 13 },
  canvasFooter: { fontFamily: MONO_FONT, fontSize: 10, letterSpacing: 1, marginTop: 8, lineHeight: 16 },
  submitBtn: {
    borderRadius: 8, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  submitBtnText: { fontFamily: MONO_FONT, fontSize: 14, letterSpacing: 3, fontWeight: "700" },
});
