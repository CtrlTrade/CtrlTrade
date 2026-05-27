import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { MONO_FONT } from "@/constants/colors";

export default function LoginScreen() {
  const colors = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      setError(message.replace(/^HTTP \d+[^:]*:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/ctrltrade-icon.png")}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <View>
              <Image
                source={require("@/assets/ctrltrade-logo.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={[styles.brandSubtitle, { color: colors.mutedForeground }]}>
                POS · Field Console
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@company.co"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background },
              ]}
            />

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>
              PASSWORD
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background },
              ]}
            />

            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: submitting || pressed ? 0.85 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  SIGN IN
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            Use your CtrlTrade workspace credentials.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 32, justifyContent: "center", maxWidth: 560, width: "100%", alignSelf: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 40 },
  brandIcon: { width: 56, height: 56, borderRadius: 10 },
  brandLogo: { width: 160, height: 32 },
  brandSubtitle: { fontFamily: MONO_FONT, fontSize: 12, letterSpacing: 2, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 24 },
  label: { fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 16, fontFamily: MONO_FONT,
  },
  error: { marginTop: 16, fontFamily: MONO_FONT, fontSize: 13 },
  button: {
    marginTop: 24, paddingVertical: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  buttonText: { fontFamily: MONO_FONT, fontWeight: "700", fontSize: 14, letterSpacing: 3 },
  footer: { marginTop: 24, textAlign: "center", fontFamily: MONO_FONT, fontSize: 11, letterSpacing: 1 },
});
