---
name: Electron splash screen font CDN
description: Why the CtrlTradePos Electron build showed a black screen and how to fix it in future.
---

# Electron splash screen blocked by Google Fonts CDN failure

## The rule
For an Expo web build wrapped in Electron, **skip `expo-splash-screen` entirely on web** — gate both `preventAutoHideAsync()` and `hideAsync()` (and the loading `<View>`) on `Platform.OS !== "web"`. The `fontError` handling is only a secondary belt-and-braces fallback; it is NOT sufficient on its own.

## Why
Two compounding causes produced the permanent black screen:
1. `useFonts()` over the Google Fonts CDN returns `[false, Error]` in Electron's `file://` context (CDN unreachable), so `fontsLoaded` never becomes `true`.
2. Even after treating `fontError` as ready, `SplashScreen.hideAsync()` is unreliable in `file://` — the splash module hides the root div with CSS during `preventAutoHideAsync()` and the removal does not reliably fire, so the app stays invisible.

The robust fix is to never engage the splash machinery on web at all; the app then renders immediately with system fallback fonts. `preventAutoHideAsync()` runs at module top-level, so it must be guarded there too — not just the `hideAsync()` effect.

## How to apply
```ts
import { Platform } from "react-native";
if (Platform.OS !== "web") SplashScreen.preventAutoHideAsync();
// ...
const ready = fontsLoaded || !!fontError; // secondary fallback
useEffect(() => {
  if (ready && Platform.OS !== "web") SplashScreen.hideAsync().catch(() => {});
}, [ready]);
if (!ready && Platform.OS !== "web") return <View style={{ flex: 1, backgroundColor: "#010C1E" }} />;
```
Apply in `artifacts/ctrltradepos/app/_layout.tsx` and any Expo app targeting Electron.
