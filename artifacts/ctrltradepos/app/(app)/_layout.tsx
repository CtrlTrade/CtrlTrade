import { Stack } from "expo-router";
import React from "react";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#010C1E" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="job-detail" />
      <Stack.Screen name="job-signoff" />
      <Stack.Screen name="sales" />
      <Stack.Screen name="sale" options={{ presentation: "modal" }} />
      <Stack.Screen name="receipt/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="till" options={{ presentation: "modal" }} />
      <Stack.Screen name="products" />
      <Stack.Screen name="basket" options={{ presentation: "modal" }} />
      <Stack.Screen name="refund" options={{ presentation: "modal" }} />
      <Stack.Screen name="eod-report" options={{ presentation: "modal" }} />
    </Stack>
  );
}
