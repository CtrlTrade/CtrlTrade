import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, getAuthToken, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

// Only manage the native splash screen on iOS/Android. On web/Electron the
// expo-splash-screen module hides the root div with CSS, and hideAsync() is
// unreliable in a file:// Electron context — which kept the desktop app blank.
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

function resolveBaseUrl(): string {
  const expoDomain =
    process.env.EXPO_PUBLIC_DOMAIN ??
    (Constants.expoConfig?.extra as { replitDomain?: string } | undefined)?.replitDomain;
  if (expoDomain) {
    const trimmed = expoDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${trimmed}`;
  }
  return "";
}

setBaseUrl(resolveBaseUrl());
setAuthTokenGetter(() => getAuthToken());

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function AuthGate() {
  const { state } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (state.status === "loading") return;
    const first = segments[0] as string | undefined;
    const inApp = first === "(app)";
    const onLogin = first === "login";
    if (state.status === "signed-in" && !inApp) {
      router.replace("/(app)");
    } else if (state.status === "signed-out" && !onLogin) {
      router.replace("/login");
    }
  }, [state.status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#010C1E" } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function ThemedRoot() {
  const colors = useColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
        <StatusBar style="light" />
        <AuthGate />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Treat a font-load error as "ready" — fonts fall back to system defaults.
  // This is critical for the Electron desktop build where the Google Fonts CDN
  // is unreachable (file:// context), which previously kept the app hidden
  // behind the splash screen indefinitely.
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready && Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // On web/Electron, render immediately without gating on the splash screen.
  if (!ready && Platform.OS !== "web") {
    return <View style={{ flex: 1, backgroundColor: "#010C1E" }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemedRoot />
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
